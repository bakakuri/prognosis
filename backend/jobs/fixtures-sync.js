'use strict';

const provider = require('../providers/football/provider-manager');
const db = require('../config/database');
const logger = require('../utils/logger');
const { todayUTC, daysFromNow } = require('../utils/date');
const { sleep } = require('../utils/helpers');

const SYNC_DAYS_AHEAD = 7;
const RATE_LIMIT_DELAY = 300;
const PROVIDER_NAME = 'football-data';

async function getActiveLeagueIds() {
  const result = await db.query(
    `SELECT id, provider_id, current_season FROM leagues WHERE is_active = TRUE ORDER BY priority ASC`
  );
  return result.rows;
}

async function upsertTeam(teamData) {
  const result = await db.query(
    `INSERT INTO teams (provider_id, provider_name, name, code, country, logo, venue_name, venue_city, venue_capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (provider_id, provider_name)
     DO UPDATE SET
       name = EXCLUDED.name,
       logo = EXCLUDED.logo,
       updated_at = NOW()
     RETURNING id`,
    [
      teamData.providerId,
      PROVIDER_NAME,
      teamData.name,
      teamData.code || null,
      teamData.country || null,
      teamData.logo || null,
      teamData.venue?.name || null,
      teamData.venue?.city || null,
      teamData.venue?.capacity || null,
    ]
  );
  return result.rows[0].id;
}

async function getOrCreateSeason(leagueId, year) {
  if (!year) return null;
  const existing = await db.query(
    `SELECT id FROM seasons WHERE league_id = $1 AND year = $2`,
    [leagueId, year]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const result = await db.query(
    `INSERT INTO seasons (league_id, year, is_current) VALUES ($1, $2, TRUE) RETURNING id`,
    [leagueId, year]
  );
  return result.rows[0].id;
}

function normalizeStatus(code) {
  const map = {
    // football-data.org
    SCHEDULED: 'NS', TIMED: 'NS', IN_PLAY: '1H', PAUSED: 'HT',
    FINISHED: 'FT', CANCELLED: 'CANC', POSTPONED: 'PST',
    SUSPENDED: 'PST', AWARDED: 'FT',
    // api-football (fallback)
    TBD: 'NS', NS: 'NS', '1H': '1H', HT: 'HT', '2H': '2H',
    ET: 'ET', BT: 'BT', P: 'P', FT: 'FT', AET: 'AET',
    PEN: 'PEN', PST: 'PST', CANC: 'CANC', ABD: 'ABD',
  };
  return map[code] || 'NS';
}

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'PAUSED']);

async function upsertMatch(fixture, leagueDbId, seasonId, homeTeamDbId, awayTeamDbId) {
  const statusCode = normalizeStatus(fixture.status.code);
  const isLive = LIVE_STATUSES.has(statusCode) || LIVE_STATUSES.has(fixture.status.code);

  await db.query(
    `INSERT INTO matches (
        provider_id, provider_name, league_id, season_id,
        home_team_id, away_team_id, date, timezone,
        venue_name, venue_city, status_code, status_long,
        elapsed, home_goals, away_goals,
        home_goals_ht, away_goals_ht,
        league_round, is_live, last_synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
      ON CONFLICT (provider_id, provider_name)
      DO UPDATE SET
        status_code    = EXCLUDED.status_code,
        status_long    = EXCLUDED.status_long,
        elapsed        = EXCLUDED.elapsed,
        home_goals     = EXCLUDED.home_goals,
        away_goals     = EXCLUDED.away_goals,
        home_goals_ht  = EXCLUDED.home_goals_ht,
        away_goals_ht  = EXCLUDED.away_goals_ht,
        is_live        = EXCLUDED.is_live,
        last_synced_at = NOW(),
        updated_at     = NOW()`,
    [
      fixture.providerId,
      PROVIDER_NAME,
      leagueDbId,
      seasonId,
      homeTeamDbId,
      awayTeamDbId,
      fixture.date,
      fixture.timezone || 'UTC',
      fixture.venue?.name || null,
      fixture.venue?.city || null,
      statusCode,
      fixture.status.long || null,
      fixture.status.elapsed || null,
      fixture.score?.home ?? null,
      fixture.score?.away ?? null,
      fixture.score?.halftime?.home ?? null,
      fixture.score?.halftime?.away ?? null,
      fixture.league?.round || null,
      isLive,
    ]
  );
}

async function logSync(prov, endpoint, status, recordsSynced, errorMessage = null) {
  await db.query(
    `INSERT INTO provider_logs (provider, endpoint, status, records_synced, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [prov, endpoint, status, recordsSynced, errorMessage]
  ).catch(err => logger.warn('Failed to write provider log', { error: err.message }));
}

async function run() {
  const startTime = Date.now();
  logger.info('Fixtures sync: starting');

  const leagues = await getActiveLeagueIds();
  if (leagues.length === 0) {
    logger.warn('Fixtures sync: no active leagues found');
    return;
  }

  let totalSynced = 0;
  let errors = 0;

  const fromDate = todayUTC();
  const toDate = daysFromNow(SYNC_DAYS_AHEAD);

  for (const league of leagues) {
    try {
      await sleep(RATE_LIMIT_DELAY);

      const fixtures = await provider.getFixtures({
        leagueId: league.provider_id,
        season: league.current_season,
        from: fromDate,
        to: toDate,
      });

      logger.debug(`Fixtures sync: ${league.provider_id} → ${fixtures.length} fixtures`);

      for (const fixture of fixtures) {
        try {
          const [homeTeamId, awayTeamId] = await Promise.all([
            upsertTeam(fixture.homeTeam),
            upsertTeam(fixture.awayTeam),
          ]);

          const season = fixture.league?.season || league.current_season;
          const seasonId = await getOrCreateSeason(league.id, season);
          await upsertMatch(fixture, league.id, seasonId, homeTeamId, awayTeamId);
          totalSynced++;
        } catch (innerErr) {
          console.error('Fixtures sync ERROR:', fixture.providerId, innerErr.message);
        }
      }

      await logSync(PROVIDER_NAME, `/fixtures?league=${league.provider_id}`, 'success', fixtures.length);
    } catch (err) {
      errors++;
      logger.error(`Fixtures sync: failed for league ${league.provider_id}`, { error: err.message });
      await logSync(PROVIDER_NAME, `/fixtures?league=${league.provider_id}`, 'error', 0, err.message);
    }
  }

  const duration = Date.now() - startTime;
  logger.info('Fixtures sync: complete', { totalSynced, errors, durationMs: duration });
}

module.exports = { run };
