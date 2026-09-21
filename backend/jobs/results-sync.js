'use strict';
const provider = require('../providers/football/provider-manager');
const db = require('../config/database');
const logger = require('../utils/logger');
const { daysAgo, todayUTC } = require('../utils/date');
const { sleep } = require('../utils/helpers');

async function run() {
  const result = await db.query(
    `SELECT m.id, m.provider_id, l.provider_id as league_provider_id, l.current_season
     FROM matches m JOIN leagues l ON m.league_id = l.id
     WHERE m.status_code NOT IN ('FT','AET','PEN','CANC','ABD')
       AND m.date < NOW() - INTERVAL '2 hours'
       AND m.date > NOW() - INTERVAL '7 days'
     LIMIT 50`
  );
  for (const match of result.rows) {
    await sleep(200);
    try {
      const fixture = await provider.getFixtureById(match.provider_id);
      if (!fixture) continue;
      await db.query(
        `UPDATE matches SET status_code=$1, home_goals=$2, away_goals=$3,
         home_goals_ht=$4, away_goals_ht=$5, is_live=FALSE,
         last_synced_at=NOW(), updated_at=NOW(),
         prediction_status = CASE WHEN $1 IN ('FT','AET','PEN') THEN 'evaluate' ELSE prediction_status END
         WHERE id=$6`,
        [fixture.status.code, fixture.score.home, fixture.score.away,
         fixture.score.halftime.home, fixture.score.halftime.away, match.id]
      );
    } catch (err) {
      logger.warn(`Results sync: failed for match ${match.provider_id}`, { error: err.message });
    }
  }
  logger.info('Results sync: complete');
}
module.exports = { run };
