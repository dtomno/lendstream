import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, pool } from './db';
import { initKafka } from './kafka';
import { metricsMiddleware, registry } from './metrics';
import { logger } from './logger';

const app = express();
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'account-service' }));

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

app.get('/api/accounts/:loanId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loan_accounts WHERE loan_id = $1', [req.params.loanId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to fetch loan account', { loanId: req.params.loanId, err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/accounts', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loan_accounts ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list loan accounts', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3005;

async function start() {
  logger.info('Starting account-service…');
  await initDb();
  await initKafka();
  app.listen(PORT, () => logger.info(`Listening on port ${PORT}`));
}

start().catch((err) => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
