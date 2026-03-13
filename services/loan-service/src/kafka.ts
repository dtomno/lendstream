import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { pool } from './db';
import { logger } from './logger';
import { kafkaEventsTotal } from './metrics';
import type { LoanDecisionMadeEvent, LoanApplicationSubmittedEvent } from './types';

const kafka = new Kafka({
  clientId: 'loan-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9094'],
  logLevel: logLevel.WARN,
});

let producer: Producer;

async function connectWithRetry(fn: () => Promise<void>, label: string): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      logger.warn(`${label} attempt ${attempt}/10 failed – retrying in 5s…`, { attempt, err });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`${label} failed after 10 attempts`);
}

async function publishToDlq(dlqProducer: Producer, originalTopic: string, payload: unknown, errorMessage: string): Promise<void> {
  try {
    const correlationId = (payload as any)?.correlationId ?? null;

    // Persist to dlq_events table for durability
    await pool.query(
      `INSERT INTO dlq_events (original_topic, correlation_id, payload, error_message)
       VALUES ($1, $2, $3, $4)`,
      [originalTopic, correlationId, JSON.stringify(payload), errorMessage],
    );

    // Also send to Kafka DLQ topic
    await dlqProducer.send({
      topic: 'loan-service.DLQ',
      messages: [
        {
          value: JSON.stringify({
            originalTopic,
            correlationId,
            payload,
            errorMessage,
            failedAt: new Date().toISOString(),
          }),
        },
      ],
    });

    kafkaEventsTotal.inc({ topic: 'loan-service.DLQ', status: 'published' });
    logger.warn('Event sent to DLQ', { originalTopic, correlationId, errorMessage });
  } catch (dlqErr) {
    logger.error('Failed to send event to DLQ', { originalTopic, dlqErr });
  }
}

export async function initKafka(): Promise<{ producer: Producer }> {
  producer = kafka.producer();
  await connectWithRetry(() => producer.connect(), 'Kafka producer connect');
  logger.info('Kafka producer connected');

  const consumer: Consumer = kafka.consumer({ groupId: 'loan-service-group' });
  await connectWithRetry(() => consumer.connect(), 'Kafka consumer connect');
  await consumer.subscribe({ topic: 'loan-decision-made', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      let event: LoanDecisionMadeEvent | undefined;
      try {
        event = JSON.parse(message.value?.toString() ?? '{}') as LoanDecisionMadeEvent;

        logger.info('Decision received', {
          loanId: event.loanId,
          decision: event.decision,
          correlationId: event.correlationId,
        });

        await pool.query(
          `UPDATE loan_applications SET status = $1, updated_at = NOW() WHERE id = $2`,
          [event.decision, event.loanId],
        );

        kafkaEventsTotal.inc({ topic: 'loan-decision-made', status: 'success' });
      } catch (err: any) {
        kafkaEventsTotal.inc({ topic: 'loan-decision-made', status: 'error' });
        logger.error('Error processing loan-decision-made event', { err, raw: message.value?.toString() });
        await publishToDlq(producer, 'loan-decision-made', event ?? message.value?.toString(), err.message ?? String(err));
      }
    },
  });

  logger.info('Kafka consumer listening on loan-decision-made');

  return { producer };
}

export async function publishLoanApplicationSubmitted(
  event: LoanApplicationSubmittedEvent,
  correlationId: string,
): Promise<void> {
  const payload: LoanApplicationSubmittedEvent = { ...event, correlationId };

  await producer.send({
    topic: 'loan-application-submitted',
    messages: [{ key: event.loanId, value: JSON.stringify(payload) }],
  });

  kafkaEventsTotal.inc({ topic: 'loan-application-submitted', status: 'published' });
  logger.info('Published loan-application-submitted', { loanId: event.loanId, correlationId });
}
