'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');
const scheduler = require('../jobs/scheduler');
const provider = require('../providers/football/provider-manager');
const cache = require('../cache/cache');
const db = require('../config/database');

router.use(adminLimiter);

router.get('/status', asyncHandler(async (req, res) => {
  const [providerStatus, dbResult, providerHealth] = await Promise.all([
    provider.getStatus(),
    db.query(`SELECT COUNT(*) as matches, (SELECT COUNT(*) FROM predictions) as predictions,
              (SELECT COUNT(*) FROM teams) as teams, (SELECT COUNT(*) FROM leagues WHERE is_active=TRUE) as leagues FROM matches`),
    Promise.resolve(provider.getProviderHealth()),
  ]);
  res.json({
    provider: providerStatus,
    providerHealth,
    database: dbResult.rows[0],
    cache: cache.getStats(),
    jobs: scheduler.getStatus(),
    uptime: process.uptime(),
  });
}));

router.post('/sync/:job', asyncHandler(async (req, res) => {
  await scheduler.runNow(req.params.job);
  res.json({ message: `Job "${req.params.job}" triggered` });
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT * FROM provider_logs ORDER BY logged_at DESC LIMIT 100`
  );
  res.json({ data: result.rows });
}));

router.post('/cache/flush', asyncHandler(async (req, res) => {
  cache.flush();
  res.json({ message: 'Cache flushed' });
}));

module.exports = router;
