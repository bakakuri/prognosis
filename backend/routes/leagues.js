'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');

router.get('/', asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT * FROM leagues WHERE is_active=TRUE ORDER BY priority ASC, name ASC`);
  res.json({ data: result.rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const league = await db.query(`SELECT * FROM leagues WHERE id=$1`, [req.params.id]);
  if (!league.rows[0]) return res.status(404).json({ error: { message: 'League not found' } });
  const standings = await db.query(
    `SELECT s.*, t.name as team_name, t.logo as team_logo FROM standings s
     JOIN teams t ON s.team_id=t.id WHERE s.league_id=$1 ORDER BY s.rank ASC`, [req.params.id]
  );
  const upcomingMatches = await db.query(
    `SELECT m.id, m.date, m.status_code, ht.name as home_name, ht.logo as home_logo,
     at.name as away_name, at.logo as away_logo, p.prob_home, p.prob_draw, p.prob_away, p.confidence
     FROM matches m JOIN teams ht ON m.home_team_id=ht.id JOIN teams at ON m.away_team_id=at.id
     LEFT JOIN predictions p ON p.match_id=m.id
     WHERE m.league_id=$1 AND m.date > NOW() AND m.status_code='NS' ORDER BY m.date ASC LIMIT 10`, [req.params.id]
  );
  res.json({ data: { ...league.rows[0], standings: standings.rows, upcomingMatches: upcomingMatches.rows } });
}));

module.exports = router;
