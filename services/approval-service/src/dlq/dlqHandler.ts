import { Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';
import { logger } from '../logger';

export async function sendToDlq(
  producer: Producer,
  serviceName: string,
  originalTopic: string,
  originalPayload: string,
  error: Error,
  correlationId?: string
): Promise<void> {
  const dlqPayload = {
    id: uuidv4(),
    originalTopic,
    correlationId,
    payload: originalPayload,
    errorMessage: error.message,
    serviceName,
    timestamp: new Date().toISOString(),
  };

  try {
    await producer.send({
      topic: `${serviceName}.DLQ`,
      messages: [{ key: correlationId || uuidv4(), value: JSON.stringify(dlqPayload) }],
    });

    await pool.query(
      `INSERT INTO dlq_events (id, original_topic, correlation_id, payload, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [dlqPayload.id, originalTopic, correlationId, originalPayload, error.message]
    );

    logger.warn('Message sent to DLQ', { serviceName, originalTopic, correlationId, error: error.message });
  } catch (dlqError) {
    logger.error('Failed to send message to DLQ', { dlqError, originalPayload });
  }
}
