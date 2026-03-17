import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb, pool } from './db';
import { initKafka } from './kafka';
import { metricsMiddleware, registry } from './metrics';
import { logger } from './logger';
import { initEmailTransport } from './emailService';

const app = express();
app.use(cors(
  process.env.FRONTEND_URL
    ? { origin: process.env.FRONTEND_URL, credentials: true }
    : undefined,
));
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

app.get('/api/notifications', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list notifications', { err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/notifications/:loanId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE loan_id = $1 ORDER BY created_at DESC',
      [req.params.loanId],
    );
    return res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch notifications for loan', { loanId: req.params.loanId, err });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3006;

async function start() {
  logger.info('Starting notification-service…');
  await initEmailTransport();
  await initDb();
  await initKafka();
  app.listen(PORT, () => logger.info(`Listening on port ${PORT}`));
}

start().catch((err) => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
