'use strict';
const provider = require('../providers/football/provider-manager');
const db = require('../config/database');
const logger = require('../utils/logger');
const cache = require('../cache/cache');

async function run() {
  const liveFixtures = await provider.getLiveFixtures();
  if (liveFixtures.length === 0) {
    await db.query(`UPDATE matches SET is_live = FALSE WHERE is_live = TRUE AND status_code NOT IN ('1H','HT','2H','ET','BT','P')`);
    return;
  }
  logger.info(`Live sync: ${liveFixtures.length} live matches`);
  for (const f of liveFixtures) {
    await db.query(
      `UPDATE matches SET status_code=$1, elapsed=$2, home_goals=$3, away_goals=$4,
       home_goals_ht=$5, away_goals_ht=$6, is_live=TRUE, last_synced_at=NOW(), updated_at=NOW()
       WHERE provider_id=$7 AND provider_name='api-football'`,
      [f.status.code, f.status.elapsed, f.score.home, f.score.away,
       f.score.halftime.home, f.score.halftime.away, f.providerId]
    );
  }
  cache.del(cache.keys.liveMatches());
}
module.exports = { run };
