'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');
const scheduler = require('../jobs/scheduler');
const cache = require('../cache/cache');
const db = require('../config/database');

router.use(adminLimiter);

router.get('/status', asyncHandler(async (req, res) => {
  const dbResult = await db.query(`SELECT
    (SELECT COUNT(*) FROM matches) as matches,
    (SELECT COUNT(*) FROM predictions) as predictions,
    (SELECT COUNT(*) FROM teams) as teams,
    (SELECT COUNT(*) FROM leagues WHERE is_active=TRUE) as leagues`);
  res.json({
    database: dbResult.rows[0],
    cache: cache.getStats(),
    jobs: scheduler.getStatus(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
}));

router.all('/sync/:job', asyncHandler(async (req, res) => {
  const names = {
    'teams':       'teams-sync',
    'fixtures':    'fixtures-sync',
    'results':     'results-sync',
    'live':        'live-sync',
    'standings':   'standings-sync',
    'injuries':    'injuries-sync',
    'predictions': 'predictions-sync',
  };
  const jobName = names[req.params.job] || req.params.job;
  const valid = Object.values(names);
  if (!valid.includes(jobName)) {
    return res.status(400).json({ error: { message: `Unknown job: ${req.params.job}` } });
  }
  await scheduler.runNow(jobName);
  res.json({ message: `Job "${jobName}" triggered`, timestamp: new Date().toISOString() });
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
