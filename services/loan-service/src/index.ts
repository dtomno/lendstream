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

// Trust the first proxy (required on Render/Railway/Heroku so that
// express-rate-limit reads the real client IP from X-Forwarded-For
// instead of treating every request as coming from the same proxy IP)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors(
  process.env.FRONTEND_URL
    ? { origin: process.env.FRONTEND_URL, credentials: true }
    : undefined,
));
app.use(express.json());

// Prometheus metrics middleware (before routes so all requests are timed)
app.use(metricsMiddleware);

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                   // per IP — reasonable for a demo/portfolio app
  standardHeaders: true,
  legacyHeaders: false,
  message: { error_code: 'RATE_LIMITED', error: 'Too many requests. Please wait a moment and try again.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                   // stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error_code: 'RATE_LIMITED', error: 'Too many attempts. Please wait 15 minutes and try again.' },
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
