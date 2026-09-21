'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const cache = require('../cache/cache');
const db = require('../config/database');
const { todayUTC, daysFromNow } = require('../utils/date');

const MATCH_SELECT = `
  SELECT m.id, m.date, m.status_code, m.elapsed, m.is_live,
    m.home_goals, m.away_goals, m.home_goals_ht, m.away_goals_ht,
    m.league_round, m.home_xg, m.away_xg,
    ht.name as home_name, ht.logo as home_logo, ht.id as home_team_id,
    at.name as away_name, at.logo as away_logo, at.id as away_team_id,
    l.name as league_name, l.logo as league_logo, l.country as league_country, l.id as league_id,
    p.prob_home, p.prob_draw, p.prob_away, p.over_2_5, p.btts_yes,
    p.xg_home, p.xg_away, p.confidence, p.data_quality_label
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
  JOIN leagues l ON m.league_id = l.id
  LEFT JOIN predictions p ON p.match_id = m.id
`;

router.get('/', asyncHandler(async (req, res) => {
  const { date, status, league, page = 1, limit = 30 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];
  if (date) { params.push(date); where += ` AND DATE(m.date) = $${params.length}`; }
  if (status) { params.push(status.toUpperCase()); where += ` AND m.status_code = $${params.length}`; }
  if (league) { params.push(league); where += ` AND l.id = $${params.length}`; }
  params.push(parseInt(limit), offset);
  const result = await db.query(`${MATCH_SELECT} ${where} ORDER BY m.date ASC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit) } });
}));

router.get('/today', asyncHandler(async (req, res) => {
  const cacheKey = cache.keys.todayMatches(todayUTC());
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  const result = await db.query(`${MATCH_SELECT} WHERE DATE(m.date) = $1 ORDER BY m.date ASC`, [todayUTC()]);
  const response = { data: result.rows, date: todayUTC() };
  cache.set(cacheKey, response, 120);
  res.json(response);
}));

router.get('/upcoming', asyncHandler(async (req, res) => {
  const { days = 3 } = req.query;
  const result = await db.query(
    `${MATCH_SELECT} WHERE m.date BETWEEN NOW() AND NOW() + INTERVAL '${parseInt(days)} days'
     AND m.status_code = 'NS' ORDER BY m.date ASC LIMIT 50`
  );
  res.json({ data: result.rows });
}));

router.get('/live', asyncHandler(async (req, res) => {
  const cached = cache.get(cache.keys.liveMatches());
  if (cached) return res.json(cached);
  const result = await db.query(`${MATCH_SELECT} WHERE m.is_live = TRUE ORDER BY m.date ASC`);
  const response = { data: result.rows, count: result.rows.length };
  cache.set(cache.keys.liveMatches(), response, 30);
  res.json(response);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = cache.keys.match(req.params.id);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  const result = await db.query(`${MATCH_SELECT} WHERE m.id = $1`, [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Match not found' } });
  const match = result.rows[0];
  // Fetch full prediction
  const predResult = await db.query(`SELECT * FROM predictions WHERE match_id = $1 ORDER BY predicted_at DESC LIMIT 1`, [req.params.id]);
  if (predResult.rows[0]) match.prediction = predResult.rows[0];
  // Fetch events
  const events = await db.query(`SELECT * FROM match_events WHERE match_id = $1 ORDER BY time_elapsed ASC`, [req.params.id]);
  match.events = events.rows;
  // Fetch statistics
  const stats = await db.query(`SELECT * FROM match_statistics WHERE match_id = $1`, [req.params.id]);
  match.statistics = stats.rows;
  // Fetch lineups
  const lineups = await db.query(`SELECT * FROM lineups WHERE match_id = $1`, [req.params.id]);
  match.lineups = lineups.rows;
  cache.set(cacheKey, { data: match }, 60);
  res.json({ data: match });
}));

module.exports = router;
