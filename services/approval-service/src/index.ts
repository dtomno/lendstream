import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, pool } from './db';
import { initKafka } from './kafka';
import { metricsMiddleware, registry } from './metrics';
import { logger } from './logger';

const app = express();
app.use(cors(
  process.env.FRONTEND_URL
    ? { origin: process.env.FRONTEND_URL, credentials: true }
    : undefined,
));
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'approval-service' }));

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

app.get('/api/decisions/:loanId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loan_decisions WHERE loan_id = $1', [req.params.loanId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Decision not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to fetch loan decision', { loanId: req.params.loanId, err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/decisions', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loan_decisions ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list loan decisions', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3004;

async function start() {
  logger.info('Starting approval-service…');
  await initDb();
  await initKafka();
  app.listen(PORT, () => logger.info(`Listening on port ${PORT}`));
}

start().catch((err) => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
