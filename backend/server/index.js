'use strict';

require('../config/env'); // Must be first — validates environment

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const env = require('../config/env');
const logger = require('../utils/logger');
const db = require('../config/database');
const scheduler = require('../jobs/scheduler');
const { notFound, errorHandler } = require('../middleware/errorHandler');
const { defaultLimiter } = require('../middleware/rateLimiter');
const routes = require('../routes/index');

const app = express();

// ─── Security ──────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: env.SECURITY.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// ─── Request Processing ────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Rate Limiting ─────────────────────────────────────────
app.use('/api/', defaultLimiter);

// ─── Request Logger ────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      logger.debug('HTTP', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });
  next();
});

// ─── Health Check ──────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const dbOk = await db.testConnection().catch(() => false);
  const status = dbOk ? 'healthy' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.round(process.uptime()),
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 + Error Handlers ──────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Startup ───────────────────────────────────────────────
async function start() {
  // Test DB connection
  const dbOk = await db.testConnection();
  if (!dbOk) {
    logger.error('Server: database connection failed — check DATABASE_URL in .env');
    if (env.IS_PRODUCTION) process.exit(1);
  }

  // Start sync scheduler
  try {
    await scheduler.init();
  } catch (err) {
    logger.error('Server: scheduler initialization failed', { error: err.message });
  }

  // Start HTTP server
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`PredictX API running`, {
      url: `http://localhost:${env.PORT}`,
      env: env.NODE_ENV,
    });
  });

  // ─── Graceful Shutdown ─────────────────────────────────
  async function shutdown(signal) {
    logger.info(`Server: ${signal} received — shutting down gracefully`);
    scheduler.stopAll();
    server.close(async () => {
      await db.close();
      logger.info('Server: shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Server: forced shutdown after timeout');
      process.exit(1);
    }, 15000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    if (env.IS_PRODUCTION) process.exit(1);
  });

  return server;
}

start().catch(err => {
  logger.error('Server: failed to start', { error: err.message });
  process.exit(1);
});

module.exports = app;
