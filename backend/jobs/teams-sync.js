'use strict';
const provider = require('../providers/football/provider-manager');
const db = require('../config/database');
const logger = require('../utils/logger');
const { sleep } = require('../utils/helpers');

async function run() {
  const leagues = await db.query(`SELECT id, provider_id, current_season FROM leagues WHERE is_active=TRUE`);
  for (const league of leagues.rows) {
    await sleep(500);
    try {
      const teams = await provider.getTeamsByLeague(league.provider_id, league.current_season);
      for (const team of teams) {
        await db.query(
          `INSERT INTO teams (provider_id, provider_name, name, code, country, founded, national, logo, venue_name, venue_city, venue_capacity)
           VALUES ($1,'api-football',$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (provider_id, provider_name) DO UPDATE SET
           name=EXCLUDED.name, logo=EXCLUDED.logo, venue_name=EXCLUDED.venue_name,
           venue_city=EXCLUDED.venue_city, updated_at=NOW()`,
          [team.providerId, team.name, team.code||null, team.country||null,
           team.founded||null, team.national||false, team.logo||null,
           team.venue?.name||null, team.venue?.city||null, team.venue?.capacity||null]
        );
      }
      logger.debug(`Teams sync: league ${league.provider_id} → ${teams.length} teams`);
    } catch (err) {
      logger.warn(`Teams sync failed for league ${league.provider_id}`, { error: err.message });
    }
  }
  logger.info('Teams sync: complete');
}
module.exports = { run };
