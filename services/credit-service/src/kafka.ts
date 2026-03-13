import { Kafka, logLevel, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import { simulateCreditCheck } from './creditEngine';
import type { LoanApplicationSubmittedEvent, CreditCheckCompletedEvent } from './types';
import { logger } from './logger';
import { kafkaEventsTotal } from './metrics';
import { sendToDlq } from './dlq/dlqHandler';

const kafka = new Kafka({
  clientId: 'credit-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9094'],
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
  throw new Error(`[credit-service] ${label} failed after 10 attempts`);
}

export async function initKafka(): Promise<void> {
  const producer: Producer = kafka.producer();
  await connectWithRetry(() => producer.connect(), 'Kafka producer connect');
  logger.info('Kafka producer connected');

  const consumer = kafka.consumer({ groupId: 'credit-service-group' });
  await connectWithRetry(() => consumer.connect(), 'Kafka consumer connect');
  await consumer.subscribe({ topic: 'loan-application-submitted', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message.value?.toString() ?? '{}';
      const event: LoanApplicationSubmittedEvent = JSON.parse(rawValue);
      const correlationId = event.correlationId;

      logger.info('Processing credit check', { loanId: event.loanId, correlationId });

      try {
        // Simulate a short processing delay (realistic async behaviour)
        await new Promise((r) => setTimeout(r, 800));

        const { creditScore, creditGrade, existingDebts, paymentHistory } = simulateCreditCheck(
          event.loanId,
          event.income,
          event.employmentStatus,
          event.amount,
        );

        // Persist to DB
        await pool.query(
          `INSERT INTO credit_assessments (id, loan_id, credit_score, credit_grade, existing_debts, payment_history)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (loan_id) DO NOTHING`,
          [uuidv4(), event.loanId, creditScore, creditGrade, existingDebts, paymentHistory],
        );

        const outEvent: CreditCheckCompletedEvent = {
          loanId: event.loanId,
          applicantName: event.applicantName,
          email: event.email,
          amount: event.amount,
          income: event.income,
          employmentStatus: event.employmentStatus,
          creditScore,
          creditGrade,
          existingDebts,
          paymentHistory,
          correlationId,
          timestamp: new Date().toISOString(),
        };

        await producer.send({
          topic: 'credit-check-completed',
          messages: [{ key: event.loanId, value: JSON.stringify(outEvent) }],
        });

        kafkaEventsTotal.inc({ topic, status: 'success' });
        logger.info('Published credit-check-completed', { loanId: event.loanId, creditScore, creditGrade, correlationId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        kafkaEventsTotal.inc({ topic, status: 'error' });
        logger.error('Failed to process credit check', { loanId: event.loanId, correlationId, error: error.message });
        await sendToDlq(producer, 'credit-service', topic, rawValue, error, correlationId);
      }
    },
  });

  logger.info('Kafka consumer listening on loan-application-submitted');
}
