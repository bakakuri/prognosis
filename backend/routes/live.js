'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');
const cache = require('../cache/cache');

router.get('/', asyncHandler(async (req, res) => {
  const cached = cache.get(cache.keys.liveMatches());
  if (cached) return res.json(cached);
  const result = await db.query(
    `SELECT m.id, m.date, m.status_code, m.elapsed, m.home_goals, m.away_goals,
     ht.name as home_name, ht.logo as home_logo, at.name as away_name, at.logo as away_logo,
     l.name as league_name, l.logo as league_logo,
     p.prob_home, p.prob_draw, p.prob_away
     FROM matches m JOIN teams ht ON m.home_team_id=ht.id JOIN teams at ON m.away_team_id=at.id
     JOIN leagues l ON m.league_id=l.id LEFT JOIN predictions p ON p.match_id=m.id
     WHERE m.is_live=TRUE ORDER BY m.date ASC`
  );
  const response = { data: result.rows, count: result.rows.length, updatedAt: new Date().toISOString() };
  cache.set(cache.keys.liveMatches(), response, 30);
  res.json(response);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT m.*, ht.name as home_name, ht.logo as home_logo, at.name as away_name, at.logo as away_logo,
     l.name as league_name, l.logo as league_logo,
     p.prob_home, p.prob_draw, p.prob_away, p.xg_home, p.xg_away
     FROM matches m JOIN teams ht ON m.home_team_id=ht.id JOIN teams at ON m.away_team_id=at.id
     JOIN leagues l ON m.league_id=l.id LEFT JOIN predictions p ON p.match_id=m.id
     WHERE m.id=$1`, [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: { message: 'Match not found' } });
  const events = await db.query(`SELECT * FROM match_events WHERE match_id=$1 ORDER BY time_elapsed ASC`, [req.params.id]);
  const stats = await db.query(`SELECT * FROM match_statistics WHERE match_id=$1`, [req.params.id]);
  res.json({ data: { ...result.rows[0], events: events.rows, statistics: stats.rows } });
}));

module.exports = router;
