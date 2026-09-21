'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');
const cache = require('../cache/cache');
const { todayUTC } = require('../utils/date');

router.get('/', asyncHandler(async (req, res) => {
  const { date, confidence, league, limit = 20 } = req.query;
  const targetDate = date || todayUTC();
  const cacheKey = `predictions:${targetDate}:${confidence||'all'}:${league||'all'}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  let where = `WHERE DATE(m.date) = $1`; const params = [targetDate];
  if (confidence) { params.push(confidence); where += ` AND p.confidence = $${params.length}`; }
  if (league) { params.push(league); where += ` AND m.league_id = $${params.length}`; }
  params.push(parseInt(limit));
  const result = await db.query(
    `SELECT p.*, m.date, m.status_code, m.home_goals, m.away_goals,
     ht.name as home_name, ht.logo as home_logo,
     at.name as away_name, at.logo as away_logo,
     l.name as league_name, l.logo as league_logo, l.country
     FROM predictions p JOIN matches m ON p.match_id=m.id
     JOIN teams ht ON m.home_team_id=ht.id JOIN teams at ON m.away_team_id=at.id
     JOIN leagues l ON m.league_id=l.id
     ${where} AND p.status='signal'
     ORDER BY p.confidence DESC, m.date ASC LIMIT $${params.length}`, params
  );
  const response = { data: result.rows, date: targetDate };
  cache.set(cacheKey, response, 180);
  res.json(response);
}));

router.get('/accuracy', asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT mm.*, l.name as league_name FROM model_metrics mm LEFT JOIN leagues l ON mm.league_id=l.id
     ORDER BY mm.calculated_at DESC LIMIT 50`
  );
  res.json({ data: result.rows });
}));

module.exports = router;
