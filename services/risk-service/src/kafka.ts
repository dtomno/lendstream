import { Kafka, logLevel, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import { assessRisk } from './riskEngine';
import type { CreditCheckCompletedEvent, RiskAssessmentCompletedEvent } from './types';
import { logger } from './logger';
import { kafkaEventsTotal } from './metrics';
import { sendToDlq } from './dlq/dlqHandler';

const kafka = new Kafka({
  clientId: 'risk-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9094'],
  ...(process.env.KAFKA_SASL_USERNAME
    ? {
        ssl: {
          ca: process.env.KAFKA_CA_CERT ? [process.env.KAFKA_CA_CERT.replace(/\\n/g, '\n')] : undefined,
        },
        sasl: {
          mechanism: 'scram-sha-256' as const,
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD || '',
        },
      }
    : {}),
  logLevel: logLevel.WARN,
});

async function connectWithRetry(fn: () => Promise<void>, label: string): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      logger.warn(`${label} attempt ${attempt}/10 failed – retrying in 5s…`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`[risk-service] ${label} failed after 10 attempts`);
}

export async function initKafka(): Promise<void> {
  const producer: Producer = kafka.producer();
  await connectWithRetry(() => producer.connect(), 'Kafka producer connect');
  logger.info('Kafka producer connected');

  const consumer = kafka.consumer({ groupId: 'risk-service-group' });
  await connectWithRetry(() => consumer.connect(), 'Kafka consumer connect');
  await consumer.subscribe({ topic: 'credit-check-completed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message.value?.toString() ?? '{}';
      const event: CreditCheckCompletedEvent = JSON.parse(rawValue);
      const correlationId = event.correlationId;

      logger.info('Processing risk assessment', { loanId: event.loanId, correlationId });

      try {
        await new Promise((r) => setTimeout(r, 600));

        const { riskScore, riskLevel, debtToIncomeRatio } = assessRisk(
          event.creditScore,
          event.amount,
          event.income,
          event.existingDebts,
        );

        await pool.query(
          `INSERT INTO risk_assessments (id, loan_id, credit_score, risk_level, risk_score, debt_to_income_ratio)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (loan_id) DO NOTHING`,
          [uuidv4(), event.loanId, event.creditScore, riskLevel, riskScore, debtToIncomeRatio],
        );

        const outEvent: RiskAssessmentCompletedEvent = {
          loanId: event.loanId,
          applicantName: event.applicantName,
          email: event.email,
          amount: event.amount,
          income: event.income,
          employmentStatus: event.employmentStatus,
          creditScore: event.creditScore,
          creditGrade: event.creditGrade,
          riskLevel,
          riskScore,
          debtToIncomeRatio,
          correlationId,
          timestamp: new Date().toISOString(),
        };

        await producer.send({
          topic: 'risk-assessment-completed',
          messages: [{ key: event.loanId, value: JSON.stringify(outEvent) }],
        });

        kafkaEventsTotal.inc({ topic, status: 'success' });
        logger.info('Published risk-assessment-completed', { loanId: event.loanId, riskLevel, riskScore, correlationId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        kafkaEventsTotal.inc({ topic, status: 'error' });
        logger.error('Failed to process risk assessment', { loanId: event.loanId, correlationId, error: error.message });
        await sendToDlq(producer, 'risk-service', topic, rawValue, error, correlationId);
      }
    },
  });

  logger.info('Kafka consumer listening on credit-check-completed');
}
