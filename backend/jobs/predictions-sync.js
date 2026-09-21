'use strict';
const db = require('../config/database');
const predictionEngine = require('../prediction/index');
const logger = require('../utils/logger');
const env = require('../config/env');

async function getMatchContext(match) {
  const [homeRating, awayRating, homeMatches, awayMatches, leagueStats] = await Promise.all([
    db.query(`SELECT elo_rating FROM team_ratings WHERE team_id=$1`, [match.home_team_id]),
    db.query(`SELECT elo_rating FROM team_ratings WHERE team_id=$1`, [match.away_team_id]),
    db.query(`SELECT m.*, m.home_team_id, m.away_team_id, m.home_goals, m.away_goals,
              m.home_xg, m.away_xg FROM matches m
              WHERE (m.home_team_id=$1 OR m.away_team_id=$1)
                AND m.status_code IN ('FT','AET','PEN') AND m.date < NOW()
              ORDER BY m.date DESC LIMIT 15`, [match.home_team_id]),
    db.query(`SELECT m.*, m.home_team_id, m.away_team_id, m.home_goals, m.away_goals,
              m.home_xg, m.away_xg FROM matches m
              WHERE (m.home_team_id=$1 OR m.away_team_id=$1)
                AND m.status_code IN ('FT','AET','PEN') AND m.date < NOW()
              ORDER BY m.date DESC LIMIT 15`, [match.away_team_id]),
    db.query(`SELECT AVG(home_goals + away_goals) as avg_goals FROM matches
              WHERE league_id=$1 AND status_code IN ('FT','AET','PEN')
              AND date > NOW() - INTERVAL '90 days'`, [match.league_id]),
  ]);
  return {
    match: { id: match.id, homeTeamId: match.home_team_id, awayTeamId: match.away_team_id, date: match.date, status: match.status_code },
    homeTeamElo: homeRating.rows[0]?.elo_rating || 1500,
    awayTeamElo: awayRating.rows[0]?.elo_rating || 1500,
    homeRecentMatches: homeMatches.rows.map(m => ({ ...m, status: 'FINISHED', homeGoals: m.home_goals, awayGoals: m.away_goals, homeXG: m.home_xg, awayXG: m.away_xg })),
    awayRecentMatches: awayMatches.rows.map(m => ({ ...m, status: 'FINISHED', homeGoals: m.home_goals, awayGoals: m.away_goals, homeXG: m.home_xg, awayXG: m.away_xg })),
    leagueAvgGoals: parseFloat(leagueStats.rows[0]?.avg_goals) || 2.6,
  };
}

async function run() {
  const matches = await db.query(
    `SELECT id, home_team_id, away_team_id, league_id, date, status_code
     FROM matches
     WHERE status_code = 'NS' AND date > NOW() AND date < NOW() + INTERVAL '3 days'
       AND prediction_status IN ('pending', 'stale')
     ORDER BY date ASC LIMIT 20`
  );
  logger.info(`Predictions sync: processing ${matches.rows.length} matches`);
  let predicted = 0;
  for (const match of matches.rows) {
    try {
      const context = await getMatchContext(match);
      const prediction = await predictionEngine.predict(context);
      const p = prediction;
      if (p.status === 'signal' && p.oneX2) {
        await db.query(
          `INSERT INTO predictions (match_id, model_version, status, prob_home, prob_draw, prob_away,
           over_0_5, over_1_5, over_2_5, over_3_5, under_2_5, under_3_5,
           btts_yes, btts_no, xg_home, xg_away, exact_scores, components,
           adjustments, model_agreement, confidence, data_quality_label, data_quality_score, lineup_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           ON CONFLICT (match_id) DO UPDATE SET
           prob_home=$4, prob_draw=$5, prob_away=$6, over_2_5=$9, btts_yes=$13,
           xg_home=$15, xg_away=$16, confidence=$21, updated_at=NOW()`,
          [match.id, p.modelVersion, p.status,
           p.oneX2.home, p.oneX2.draw, p.oneX2.away,
           p.goals?.over_0_5, p.goals?.over_1_5, p.goals?.over_2_5, p.goals?.over_3_5,
           p.goals?.under_2_5, p.goals?.under_3_5,
           p.btts?.yes, p.btts?.no,
           p.expectedGoals?.home, p.expectedGoals?.away,
           JSON.stringify(p.exactScores || []),
           JSON.stringify(p.components || {}),
           JSON.stringify(p.adjustments || {}),
           JSON.stringify(p.modelAgreement || {}),
           p.confidence, p.dataQuality?.label, p.dataQuality?.score,
           p.meta?.lineupStatus || 'unavailable']
        );
        await db.query(`UPDATE matches SET prediction_status='predicted' WHERE id=$1`, [match.id]);
        predicted++;
      } else {
        await db.query(`UPDATE matches SET prediction_status='no_signal' WHERE id=$1`, [match.id]);
      }
    } catch (err) {
      logger.warn(`Predictions sync: failed for match ${match.id}`, { error: err.message });
    }
  }
  logger.info(`Predictions sync: ${predicted} predictions generated`);
}
module.exports = { run };
