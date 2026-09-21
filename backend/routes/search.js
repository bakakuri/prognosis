'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { searchLimiter } = require('../middleware/rateLimiter');
const db = require('../config/database');

router.get('/', searchLimiter, asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ data: { teams: [], leagues: [], matches: [] } });
  const term = `%${q.trim()}%`;
  const [teams, leagues] = await Promise.all([
    db.query(`SELECT id, name, logo, country FROM teams WHERE name ILIKE $1 LIMIT 5`, [term]),
    db.query(`SELECT id, name, logo, country FROM leagues WHERE name ILIKE $1 AND is_active=TRUE LIMIT 5`, [term]),
  ]);
  res.json({ data: { teams: teams.rows, leagues: leagues.rows }, query: q });
}));

module.exports = router;
