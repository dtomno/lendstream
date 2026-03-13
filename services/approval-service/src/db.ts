import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'approval_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

export async function initDb(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS loan_decisions (
          id              UUID PRIMARY KEY,
          loan_id         UUID           NOT NULL UNIQUE,
          decision        VARCHAR(20)    NOT NULL,
          interest_rate   DECIMAL(5,2)   NOT NULL DEFAULT 0,
          approved_amount DECIMAL(12,2)  NOT NULL DEFAULT 0,
          reason          TEXT           NOT NULL,
          risk_level      VARCHAR(20)    NOT NULL,
          credit_score    INTEGER        NOT NULL,
          created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
        )
      `);
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
  throw new Error('[approval-service] Could not connect to database');
}
