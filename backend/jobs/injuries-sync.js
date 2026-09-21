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
      const injuryList = await provider.getInjuries({ leagueId: league.provider_id, season: league.current_season });
      for (const injury of injuryList) {
        const team = await db.query(`SELECT id FROM teams WHERE provider_id=$1`, [injury.teamId]);
        if (!team.rows[0]) continue;
        let playerId = null;
        if (injury.playerId) {
          const player = await db.query(`SELECT id FROM players WHERE provider_id=$1`, [injury.playerId]);
          playerId = player.rows[0]?.id || null;
        }
        await db.query(
          `INSERT INTO injuries (player_id, team_id, league_id, player_name, player_photo, type, reason, date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT DO NOTHING`,
          [playerId, team.rows[0].id, league.id, injury.playerName,
           injury.playerPhoto||null, injury.type, injury.reason||null, injury.date||null]
        );
      }
    } catch (err) {
      logger.warn(`Injuries sync failed for league ${league.provider_id}`, { error: err.message });
    }
  }
  logger.info('Injuries sync: complete');
}
module.exports = { run };
