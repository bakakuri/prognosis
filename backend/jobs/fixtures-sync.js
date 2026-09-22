'use strict';
const provider = require('../providers/football/provider-manager');
const db = require('../config/database');
const logger = require('../utils/logger');
const { todayUTC, daysFromNow } = require('../utils/date');
const { sleep } = require('../utils/helpers');

const PROVIDER_NAME = 'football-data';
let isRunning = false;

async function getActiveLeagueIds() {
  const r = await db.query(
    `SELECT id, provider_id, current_season FROM leagues WHERE is_active = TRUE ORDER BY priority ASC`
  );
  return r.rows;
}

async function upsertTeam(t) {
  if (!t?.providerId || t.providerId === '0') return null;
  const r = await db.query(
    `INSERT INTO teams (provider_id, provider_name, name, code, country, logo)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (provider_id, provider_name)
     DO UPDATE SET name=EXCLUDED.name, logo=EXCLUDED.logo, updated_at=NOW()
     RETURNING id`,
    [String(t.providerId), PROVIDER_NAME, t.name || `Team_${t.providerId}`,
     t.code || null, t.country || null, t.logo || null]
  );
  return r.rows[0]?.id || null;
}

async function getOrCreateSeason(leagueId, year) {
  if (!year || !leagueId) return null;
  const r = await db.query(
    `INSERT INTO seasons (league_id, year, is_current)
     VALUES ($1,$2,TRUE)
     ON CONFLICT (league_id, year) DO UPDATE SET is_current=TRUE
     RETURNING id`,
    [leagueId, parseInt(year)]
  );
  return r.rows[0]?.id || null;
}

function toStatusCode(c) {
  return {
    SCHEDULED:'NS', TIMED:'NS', IN_PLAY:'1H', PAUSED:'HT',
    FINISHED:'FT', CANCELLED:'CANC', POSTPONED:'PST',
    SUSPENDED:'PST', AWARDED:'FT',
    NS:'NS', '1H':'1H', HT:'HT', '2H':'2H',
    FT:'FT', AET:'AET', PEN:'PEN',
  }[c] || 'NS';
}

async function upsertMatch(f, leagueId, seasonId, homeId, awayId) {
  if (!homeId || !awayId) return;
  const sc = toStatusCode(f.status?.code);
  const isLive = ['1H','HT','2H','IN_PLAY','PAUSED'].includes(f.status?.code);
  await db.query(
    `INSERT INTO matches (
       provider_id, provider_name, league_id, season_id,
       home_team_id, away_team_id, date, timezone,
       status_code, status_long, home_goals, away_goals,
       home_goals_ht, away_goals_ht, league_round,
       is_live, last_synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'UTC',$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     ON CONFLICT (provider_id, provider_name)
     DO UPDATE SET
       status_code=$8, home_goals=$10, away_goals=$11,
       is_live=$15, last_synced_at=NOW(), updated_at=NOW()`,
    [
      String(f.providerId), PROVIDER_NAME, leagueId, seasonId,
      homeId, awayId, f.date,
      sc, f.status?.long || null,
      f.score?.home ?? null, f.score?.away ?? null,
      f.score?.halftime?.home ?? null, f.score?.halftime?.away ?? null,
      f.league?.round || null, isLive,
    ]
  );
}

async function run() {
  if (isRunning) {
    logger.warn('Fixtures sync: already running, skipping');
    return;
  }
  isRunning = true;
  logger.info('Fixtures sync: start');
  let total = 0, errs = 0;

  try {
    const leagues = await getActiveLeagueIds();

    for (const league of leagues) {
      try {
        const fixtures = await provider.getFixtures({
          leagueId: league.provider_id,
          season: league.current_season,
          from: todayUTC(),
          to: daysFromNow(60),
        });

        logger.info(`Fixtures sync: ${league.provider_id} → ${fixtures.length} fixtures`);

        for (const f of fixtures) {
          try {
            const homeId = await upsertTeam(f.homeTeam);
            const awayId = await upsertTeam(f.awayTeam);
            const year = f.league?.season || league.current_season;
            const seasonId = await getOrCreateSeason(league.id, year);
            await upsertMatch(f, league.id, seasonId, homeId, awayId);
            total++;
          } catch (e) {
            errs++;
            logger.warn('MATCH FAIL: ' + f?.providerId + ' ' + e.message);
          }
        }

        await db.query(
          `INSERT INTO provider_logs (provider, endpoint, status, records_synced)
           VALUES ($1,$2,'success',$3)`,
          [PROVIDER_NAME, `/fixtures?league=${league.provider_id}`, fixtures.length]
        ).catch(() => {});

      } catch (e) {
        errs++;
        logger.error('LEAGUE FAIL: ' + league.provider_id + ' ' + e.message);
        await db.query(
          `INSERT INTO provider_logs (provider, endpoint, status, records_synced, error_message)
           VALUES ($1,$2,'error',0,$3)`,
          [PROVIDER_NAME, `/fixtures?league=${league.provider_id}`, e.message]
        ).catch(() => {});
      }
    }
  } finally {
    isRunning = false;
  }

  logger.info(`Fixtures sync: done total=${total} errors=${errs}`);
}

module.exports = { run };
