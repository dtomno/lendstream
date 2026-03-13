import { Producer } from 'kafkajs';
import { pool } from '../db';
import { logger } from '../logger';

export function startOutboxPoller(producer: Producer): void {
  setInterval(async () => {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM outbox_events
         WHERE published = false
         ORDER BY created_at
         LIMIT 10
         FOR UPDATE SKIP LOCKED`,
      );

      for (const row of result.rows) {
        try {
          let payload: Record<string, unknown>;
          if (typeof row.payload === 'string') {
            payload = JSON.parse(row.payload);
          } else {
            payload = row.payload;
          }

          await producer.send({
            topic: row.topic,
            messages: [
              {
                key: row.aggregate_id,
                value: JSON.stringify(payload),
              },
            ],
          });

          await client.query(
            `UPDATE outbox_events SET published = true, published_at = NOW() WHERE id = $1`,
            [row.id],
          );

          const correlationId = payload.correlationId as string | undefined;
          logger.info('Outbox event published', {
            outboxId: row.id,
            topic: row.topic,
            aggregateId: row.aggregate_id,
            correlationId,
          });
        } catch (rowErr) {
          logger.error('Failed to publish outbox event', {
            outboxId: row.id,
            topic: row.topic,
            aggregateId: row.aggregate_id,
            err: rowErr,
          });
          // Don't rethrow – continue processing remaining rows
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      logger.error('Outbox poller error', { err });
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          logger.error('Outbox poller rollback error', { err: rollbackErr });
        }
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }, 1000);

  logger.info('Outbox poller started (interval: 1000ms)');
}
