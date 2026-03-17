import { Kafka, logLevel, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import type { UserRegisteredEvent, LoanDecisionMadeEvent, LoanAccountCreatedEvent } from './types';
import { logger } from './logger';
import { kafkaEventsTotal } from './metrics';
import { sendToDlq } from './dlq/dlqHandler';
import { sendEmail } from './emailService';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9094'],
  logLevel: logLevel.WARN,
});

function buildVerificationEmail(event: UserRegisteredEvent): { subject: string; text: string } {
  const role = event.role === 'LOAN_OFFICER' ? 'Loan Officer' : 'Applicant';
  if (event.verificationUrl) {
    return {
      subject: 'Verify your LendStream email address',
      text: `Welcome to LendStream!\n\nYour account has been created successfully.\n\n  Email: ${event.email}\n  Role:  ${role}\n\nPlease verify your email address by clicking the link below:\n\n${event.verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can safely ignore this email.\n\nBest regards,\nLendStream Team`,
    };
  }
  return {
    subject: 'Welcome to LendStream!',
    text: `Welcome to LendStream!\n\nYour account has been created successfully.\n\n  Email: ${event.email}\n  Role:  ${role}\n\nBest regards,\nLendStream Team`,
  };
}

function buildDecisionEmail(event: LoanDecisionMadeEvent): { subject: string; text: string } {
  if (event.decision === 'APPROVED') {
    return {
      subject: 'Your loan application has been APPROVED',
      text: `Dear ${event.applicantName},\n\nGreat news! Your loan application has been approved.\n\nDetails:\n  - Approved Amount: $${event.approvedAmount.toLocaleString()}\n  - Interest Rate: ${event.interestRate}% p.a.\n  - Term: 36 months\n\n${event.reason}\n\nYour loan account will be set up shortly.\n\nBest regards,\nLendstream Loan Processing Team`,
    };
  }
  return {
    subject: 'Your loan application was not approved',
    text: `Dear ${event.applicantName},\n\nWe regret to inform you that your loan application could not be approved at this time.\n\n${event.reason}\n\nYou may reapply after addressing the above concerns.\n\nBest regards,\nLendstream Loan Processing Team`,
  };
}

function buildAccountEmail(event: LoanAccountCreatedEvent): { subject: string; text: string } {
  return {
    subject: 'Your loan account has been created',
    text: `Your loan account is now active.\n\n  Account Number: ${event.accountNumber}\n  Principal: $${event.principal.toLocaleString()}\n  Interest Rate: ${event.interestRate}% p.a.\n  Term: ${event.termMonths} months\n  Monthly Payment: $${event.monthlyPayment.toLocaleString()}\n\nThank you for choosing us.\n\nBest regards,\nLendstream Loan Processing Team`,
  };
}

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
  throw new Error(`[notification-service] ${label} failed after 10 attempts`);
}

export async function initKafka(): Promise<void> {
  const producer: Producer = kafka.producer();
  await connectWithRetry(() => producer.connect(), 'Kafka producer connect');
  logger.info('Kafka producer connected');

  const consumer = kafka.consumer({ groupId: 'notification-service-group' });
  await connectWithRetry(() => consumer.connect(), 'Kafka consumer connect');
  await consumer.subscribe({ topics: ['user-registered', 'loan-decision-made', 'loan-account-created'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message.value?.toString() ?? '{}';
      const payload = JSON.parse(rawValue);
      const correlationId = payload.correlationId as string | undefined;

      try {
        if (topic === 'user-registered') {
          const event = payload as UserRegisteredEvent;
          const { subject, text } = buildVerificationEmail(event);

          logger.info('Sending verification email', { to: event.email, userId: event.userId, correlationId });

          await sendEmail({ to: event.email, subject, text });

          await pool.query(
            `INSERT INTO notifications (id, loan_id, recipient_email, recipient_name, type, subject, message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidv4(), null, event.email, event.email, 'USER_REGISTERED', subject, text],
          );
        }

        if (topic === 'loan-decision-made') {
          const event = payload as LoanDecisionMadeEvent;
          const { subject, text } = buildDecisionEmail(event);

          logger.info('Sending loan decision email', { to: event.applicantEmail, decision: event.decision, correlationId });

          await sendEmail({ to: event.applicantEmail, subject, text });

          await pool.query(
            `INSERT INTO notifications (id, loan_id, recipient_email, recipient_name, type, subject, message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidv4(), event.loanId, event.applicantEmail, event.applicantName, `LOAN_${event.decision}`, subject, text],
          );
        }

        if (topic === 'loan-account-created') {
          const event = payload as LoanAccountCreatedEvent;
          const { subject, text } = buildAccountEmail(event);

          logger.info('Sending account created notification', { loanId: event.loanId, to: event.applicantEmail, correlationId });

          await sendEmail({ to: event.applicantEmail, subject, text });

          await pool.query(
            `INSERT INTO notifications (id, loan_id, recipient_email, recipient_name, type, subject, message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidv4(), event.loanId, event.applicantEmail, event.applicantName, 'ACCOUNT_CREATED', subject, text],
          );
        }

        kafkaEventsTotal.inc({ topic, status: 'success' });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        kafkaEventsTotal.inc({ topic, status: 'error' });
        logger.error('Failed to process notification', { topic, correlationId, error: error.message });
        await sendToDlq(producer, 'notification-service', topic, rawValue, error, correlationId);
      }
    },
  });

  logger.info('Kafka consumer listening on user-registered, loan-decision-made, loan-account-created');
}
