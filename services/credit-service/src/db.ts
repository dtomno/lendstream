import { Pool } from 'pg';
import { logger } from './logger';

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'credit_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    });

const SCHEMA = 'credit_service';
pool.on('connect', (client) => {
  client.query(`SET search_path TO ${SCHEMA}, public`);
});

export async function initDb(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS credit_assessments (
          id              UUID PRIMARY KEY,
          loan_id         UUID          NOT NULL UNIQUE,
          credit_score    INTEGER       NOT NULL,
          credit_grade    VARCHAR(2)    NOT NULL,
          existing_debts  DECIMAL(12,2) NOT NULL,
          payment_history VARCHAR(20)   NOT NULL,
          created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
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
  throw new Error('[credit-service] Could not connect to database');
}
