import { Kafka, logLevel, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import type { LoanDecisionMadeEvent, LoanAccountCreatedEvent } from './types';
import { logger } from './logger';
import { kafkaEventsTotal } from './metrics';
import { sendToDlq } from './dlq/dlqHandler';

const kafka = new Kafka({
  clientId: 'account-service',
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
  throw new Error(`[account-service] ${label} failed after 10 attempts`);
}

function calcMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return parseFloat((principal / termMonths).toFixed(2));
  const monthlyRate = annualRate / 100 / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return parseFloat(payment.toFixed(2));
}

function generateAccountNumber(loanId: string): string {
  const suffix = loanId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `LN-${Date.now().toString().slice(-6)}-${suffix}`;
}

export async function initKafka(): Promise<void> {
  const producer: Producer = kafka.producer();
  await connectWithRetry(() => producer.connect(), 'Kafka producer connect');
  logger.info('Kafka producer connected');

  const consumer = kafka.consumer({ groupId: 'account-service-group' });
  await connectWithRetry(() => consumer.connect(), 'Kafka consumer connect');
  await consumer.subscribe({ topic: 'loan-decision-made', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message.value?.toString() ?? '{}';
      const event: LoanDecisionMadeEvent = JSON.parse(rawValue);
      const correlationId = event.correlationId;

      // Only create accounts for approved loans
      if (event.decision !== 'APPROVED') {
        logger.info('Skipping non-approved loan', { loanId: event.loanId, decision: event.decision, correlationId });
        return;
      }

      logger.info('Creating account for loan', { loanId: event.loanId, correlationId });

      try {
        const termMonths = 36;
        const monthlyPayment = calcMonthlyPayment(event.approvedAmount, event.interestRate, termMonths);
        const accountNumber = generateAccountNumber(event.loanId);

        await pool.query(
          `INSERT INTO loan_accounts (id, loan_id, account_number, principal, interest_rate, term_months, monthly_payment)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (loan_id) DO NOTHING`,
          [uuidv4(), event.loanId, accountNumber, event.approvedAmount, event.interestRate, termMonths, monthlyPayment],
        );

        const outEvent: LoanAccountCreatedEvent = {
          loanId: event.loanId,
          accountNumber,
          principal: event.approvedAmount,
          interestRate: event.interestRate,
          termMonths,
          monthlyPayment,
          correlationId,
          timestamp: new Date().toISOString(),
        };

        await producer.send({
          topic: 'loan-account-created',
          messages: [{ key: event.loanId, value: JSON.stringify(outEvent) }],
        });

        kafkaEventsTotal.inc({ topic, status: 'success' });
        logger.info('Published loan-account-created', { loanId: event.loanId, accountNumber, correlationId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        kafkaEventsTotal.inc({ topic, status: 'error' });
        logger.error('Failed to create loan account', { loanId: event.loanId, correlationId, error: error.message });
        await sendToDlq(producer, 'account-service', topic, rawValue, error, correlationId);
      }
    },
  });

  logger.info('Kafka consumer listening on loan-decision-made');
}
