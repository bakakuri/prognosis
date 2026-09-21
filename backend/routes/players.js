'use strict';
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT * FROM players WHERE id=$1`, [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: { message: 'Player not found' } });
  const injuries = await db.query(`SELECT * FROM injuries WHERE player_id=$1 ORDER BY created_at DESC LIMIT 5`, [req.params.id]);
  res.json({ data: { ...result.rows[0], injuries: injuries.rows } });
}));

module.exports = router;
