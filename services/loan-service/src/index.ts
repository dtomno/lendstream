import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDb } from './db';
import { initKafka } from './kafka';
import { router } from './routes';
import { authRouter } from './auth/authRoutes';
import { metricsMiddleware, registry } from './metrics';
import { startOutboxPoller } from './outbox/outboxPoller';
import { swaggerUi, swaggerSpec } from './swagger';
import { logger } from './logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Prometheus metrics middleware (before routes so all requests are timed)
app.use(metricsMiddleware);

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts' },
});

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/loans', generalLimiter, router);

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'loan-service' }));

const PORT = process.env.PORT || 3001;

async function start(): Promise<void> {
  logger.info('Starting loan-service…');

  await initDb();
  const { producer } = await initKafka();
  startOutboxPoller(producer);

  app.listen(PORT, () => {
    logger.info(`loan-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
