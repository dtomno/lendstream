import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'risk_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

export async function initDb(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS risk_assessments (
          id                  UUID PRIMARY KEY,
          loan_id             UUID           NOT NULL UNIQUE,
          credit_score        INTEGER        NOT NULL,
          risk_level          VARCHAR(20)    NOT NULL,
          risk_score          DECIMAL(5,2)   NOT NULL,
          debt_to_income_ratio DECIMAL(12,4) NOT NULL,
          created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
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
      // Widen column if it was created with the old DECIMAL(8,4) precision
      await pool.query(`
        ALTER TABLE risk_assessments
          ALTER COLUMN debt_to_income_ratio TYPE DECIMAL(12,4)
      `).catch(() => { /* no-op if already correct or table doesn't exist yet */ });
      logger.info('Database ready');
      return;
    } catch (err) {
      logger.warn(`DB attempt ${attempt}/10 failed – retrying in 3s…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('[risk-service] Could not connect to database');
}
