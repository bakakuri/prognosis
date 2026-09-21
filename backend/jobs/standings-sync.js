'use strict';
const provider = require('../providers/football/provider-manager');
const db = require('../config/database');
const logger = require('../utils/logger');
const { sleep } = require('../utils/helpers');

async function run() {
  const leagues = await db.query(`SELECT id, provider_id, current_season FROM leagues WHERE is_active=TRUE`);
  for (const league of leagues.rows) {
    await sleep(400);
    try {
      const standingsGroups = await provider.getStandings(league.provider_id, league.current_season);
      const season = await db.query(`SELECT id FROM seasons WHERE league_id=$1 AND year=$2`, [league.id, league.current_season]);
      const seasonId = season.rows[0]?.id || null;
      for (const group of standingsGroups) {
        for (const standing of group) {
          const team = await db.query(`SELECT id FROM teams WHERE provider_id=$1`, [standing.teamId]);
          if (!team.rows[0]) continue;
          await db.query(
            `INSERT INTO standings (league_id, season_id, team_id, rank, points, goals_diff, form, status, description,
             played_total, win_total, draw_total, lose_total, goals_for, goals_against)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             ON CONFLICT (league_id, season_id, team_id) DO UPDATE SET
             rank=$4, points=$5, goals_diff=$6, form=$7, played_total=$10,
             win_total=$11, draw_total=$12, lose_total=$13, goals_for=$14, goals_against=$15, updated_at=NOW()`,
            [league.id, seasonId, team.rows[0].id, standing.rank, standing.points,
             standing.goalsDiff, standing.form, standing.status, standing.description,
             standing.all?.played||0, standing.all?.win||0, standing.all?.draw||0,
             standing.all?.lose||0, standing.all?.goals?.for||0, standing.all?.goals?.against||0]
          );
        }
      }
    } catch (err) {
      logger.warn(`Standings sync failed for league ${league.provider_id}`, { error: err.message });
    }
  }
  logger.info('Standings sync: complete');
}
module.exports = { run };
