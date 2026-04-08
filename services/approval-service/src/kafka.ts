import { Kafka, logLevel, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import { makeDecision } from './approvalEngine';
import type { RiskAssessmentCompletedEvent, LoanDecisionMadeEvent } from './types';
import { logger } from './logger';
import { kafkaEventsTotal } from './metrics';
import { sendToDlq } from './dlq/dlqHandler';

const kafka = new Kafka({
  clientId: 'approval-service',
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
  throw new Error(`[approval-service] ${label} failed after 10 attempts`);
}

export async function initKafka(): Promise<void> {
  const producer: Producer = kafka.producer();
  await connectWithRetry(() => producer.connect(), 'Kafka producer connect');
  logger.info('Kafka producer connected');

  const consumer = kafka.consumer({ groupId: 'approval-service-group' });
  await connectWithRetry(() => consumer.connect(), 'Kafka consumer connect');
  await consumer.subscribe({ topic: 'risk-assessment-completed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message.value?.toString() ?? '{}';
      const event: RiskAssessmentCompletedEvent = JSON.parse(rawValue);
      const correlationId = event.correlationId;

      logger.info('Processing loan decision', { loanId: event.loanId, correlationId });

      try {
        await new Promise((r) => setTimeout(r, 500));

        const { decision, interestRate, approvedAmount, reason } = makeDecision(
          event.riskLevel,
          event.creditScore,
          event.amount,
        );

        await pool.query(
          `INSERT INTO loan_decisions (id, loan_id, decision, interest_rate, approved_amount, reason, risk_level, credit_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (loan_id) DO NOTHING`,
          [uuidv4(), event.loanId, decision, interestRate, approvedAmount, reason, event.riskLevel, event.creditScore],
        );

        const outEvent: LoanDecisionMadeEvent = {
          loanId: event.loanId,
          decision,
          interestRate,
          approvedAmount,
          reason,
          applicantEmail: event.email,
          applicantName: event.applicantName,
          riskLevel: event.riskLevel,
          creditScore: event.creditScore,
          correlationId,
          timestamp: new Date().toISOString(),
        };

        await producer.send({
          topic: 'loan-decision-made',
          messages: [{ key: event.loanId, value: JSON.stringify(outEvent) }],
        });

        kafkaEventsTotal.inc({ topic, status: 'success' });
        logger.info('Published loan-decision-made', { loanId: event.loanId, decision, correlationId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        kafkaEventsTotal.inc({ topic, status: 'error' });
        logger.error('Failed to process loan decision', { loanId: event.loanId, correlationId, error: error.message });
        await sendToDlq(producer, 'approval-service', topic, rawValue, error, correlationId);
      }
    },
  });

  logger.info('Kafka consumer listening on risk-assessment-completed');
}
