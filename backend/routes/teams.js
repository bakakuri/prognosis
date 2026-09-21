'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');
const cache = require('../cache/cache');

router.get('/', asyncHandler(async (req, res) => {
  const { league, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1'; const params = [];
  if (search) { params.push(`%${search}%`); where += ` AND t.name ILIKE $${params.length}`; }
  params.push(parseInt(limit), offset);
  const result = await db.query(`SELECT t.* FROM teams t ${where} ORDER BY t.name ASC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json({ data: result.rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = cache.keys.team(req.params.id);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  const team = await db.query(`SELECT * FROM teams WHERE id = $1`, [req.params.id]);
  if (!team.rows[0]) return res.status(404).json({ error: { message: 'Team not found' } });
  const matches = await db.query(
    `SELECT m.id, m.date, m.status_code, m.home_goals, m.away_goals,
     ht.name as home_name, ht.logo as home_logo, at.name as away_name, at.logo as away_logo,
     l.name as league_name, l.logo as league_logo, p.prob_home, p.prob_draw, p.prob_away
     FROM matches m JOIN teams ht ON m.home_team_id=ht.id JOIN teams at ON m.away_team_id=at.id
     JOIN leagues l ON m.league_id=l.id LEFT JOIN predictions p ON p.match_id=m.id
     WHERE (m.home_team_id=$1 OR m.away_team_id=$1) ORDER BY m.date DESC LIMIT 20`, [req.params.id]
  );
  const injuries = await db.query(`SELECT * FROM injuries WHERE team_id=$1 ORDER BY created_at DESC LIMIT 10`, [req.params.id]);
  const form = await db.query(`SELECT * FROM team_form WHERE team_id=$1 ORDER BY calculated_at DESC LIMIT 1`, [req.params.id]);
  const ratings = await db.query(`SELECT * FROM team_ratings WHERE team_id=$1 ORDER BY updated_at DESC LIMIT 1`, [req.params.id]);
  const response = { data: { ...team.rows[0], recentMatches: matches.rows, injuries: injuries.rows, form: form.rows[0]||null, ratings: ratings.rows[0]||null } };
  cache.set(cacheKey, response, 300);
  res.json(response);
}));

module.exports = router;
