import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'notifications_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

export async function initDb(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id               UUID PRIMARY KEY,
          loan_id          UUID,
          recipient_email  VARCHAR(255) NOT NULL,
          recipient_name   VARCHAR(255) NOT NULL,
          type             VARCHAR(50)  NOT NULL,
          subject          TEXT         NOT NULL,
          message          TEXT         NOT NULL,
          channel          VARCHAR(20)  NOT NULL DEFAULT 'EMAIL',
          status           VARCHAR(20)  NOT NULL DEFAULT 'SENT',
          created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);
      // Idempotent migration: drop NOT NULL on loan_id if it still exists from earlier schema
      await pool.query(`ALTER TABLE notifications ALTER COLUMN loan_id DROP NOT NULL`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS dlq_events (
          id               UUID PRIMARY KEY,
          original_topic   VARCHAR(200) NOT NULL,
          correlation_id   TEXT,
          payload          JSONB NOT NULL,
          error_message    TEXT NOT NULL,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      logger.info('Database ready');
      return;
    } catch (err) {
      logger.warn(`DB attempt ${attempt}/10 failed – retrying in 3s…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('[notification-service] Could not connect to database');
}
