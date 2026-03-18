import { Pool } from 'pg';
import { logger } from './logger';

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'loans_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    });

// Isolate this service's tables in its own schema when sharing a single DB
const SCHEMA = 'loan_service';
pool.on('connect', (client) => {
  client.query(`SET search_path TO ${SCHEMA}, public`);
});

export async function initDb(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS loan_applications (
          id                UUID          PRIMARY KEY,
          applicant_name    VARCHAR(255)  NOT NULL,
          email             VARCHAR(255)  NOT NULL,
          amount            DECIMAL(12,2) NOT NULL,
          purpose           VARCHAR(500)  NOT NULL,
          income            DECIMAL(12,2) NOT NULL,
          employment_status VARCHAR(50)   NOT NULL,
          status            VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
          user_id           UUID,
          created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
          email         VARCHAR(255)  UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          role          VARCHAR(20)   NOT NULL DEFAULT 'APPLICANT',
          email_verified            BOOLEAN     NOT NULL DEFAULT false,
          verification_token        VARCHAR(64),
          verification_token_expires TIMESTAMPTZ,
          google_id     VARCHAR(255)  UNIQUE,
          created_at    TIMESTAMPTZ   DEFAULT NOW()
        )
      `);

      // Migrate existing users table: add columns if missing
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'loan_service' AND table_name = 'users' AND column_name = 'email_verified'
          ) THEN
            ALTER TABLE users
              ADD COLUMN email_verified             BOOLEAN     NOT NULL DEFAULT false,
              ADD COLUMN verification_token         VARCHAR(64),
              ADD COLUMN verification_token_expires TIMESTAMPTZ;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'loan_service' AND table_name = 'users' AND column_name = 'google_id'
          ) THEN
            ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
          END IF;
          -- Allow password_hash to be NULL for OAuth users
          ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        END
        $$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS outbox_events (
          id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_id UUID        NOT NULL,
          topic        VARCHAR(200) NOT NULL,
          payload      JSONB       NOT NULL,
          published    BOOLEAN     DEFAULT false,
          created_at   TIMESTAMPTZ DEFAULT NOW(),
          published_at TIMESTAMPTZ
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS dlq_events (
          id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          original_topic VARCHAR(200) NOT NULL,
          correlation_id TEXT,
          payload        JSONB       NOT NULL,
          error_message  TEXT        NOT NULL,
          created_at     TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Add user_id column to loan_applications if it doesn't exist yet
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'loan_applications' AND column_name = 'user_id'
          ) THEN
            ALTER TABLE loan_applications ADD COLUMN user_id UUID;
          END IF;
        END
        $$;
      `);

      logger.info('Database ready');
      return;
    } catch (err) {
      logger.warn(`DB attempt ${attempt}/10 failed – retrying in 3s…`, { attempt, err });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not connect to database after 10 attempts');
}
