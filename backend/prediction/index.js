'use strict';

const elo = require('./elo/elo');
const poisson = require('./poisson/poisson');
const dixonColes = require('./dixon-coles/dixon-coles');
const form = require('./form/form');
const xg = require('./xg/xg');
const lineup = require('./lineup/lineup');
const injuries = require('./injuries/injuries');
const ensemble = require('./ensemble/ensemble');
const calibration = require('./calibration/calibration');
const env = require('../config/env');
const { round, calculateDataQuality } = require('../utils/helpers');
const { restDays } = require('../utils/date');
const logger = require('../utils/logger');

const MODEL_VERSION = env.PREDICTION.MODEL_VERSION;
const MIN_MATCHES = env.PREDICTION.MIN_MATCHES_FOR_PREDICTION;

/**
 * Main prediction pipeline
 *
 * Input: all available match context
 * Output: full prediction with all markets, confidence, model breakdown
 */
async function predict(context) {
  const {
    match,
    homeTeamElo,
    awayTeamElo,
    homeTeamStats,         // from DB: team statistics for this season/league
    awayTeamStats,
    homeRecentMatches,     // Array of recent matches for home team
    awayRecentMatches,
    leagueAvgGoals,
    leagueAvgXG,
    teamEloRatings,        // Map of teamId → elo for opponent strength
    homeLineup,
    awayLineup,
    homeInjuries,
    awayInjuries,
    playerRatings,         // Map of playerId → rating
    homeLastMatchDate,
    awayLastMatchDate,
  } = context;

  const startTime = Date.now();

  // ─── Data Quality Check ──────────────────────────────────────────
  const dataQuality = calculateDataQuality({
    homeElo: homeTeamElo,
    awayElo: awayTeamElo,
    homeFormMatches: homeRecentMatches?.length,
    awayFormMatches: awayRecentMatches?.length,
    homeXG: homeRecentMatches?.some(m => m.homeXG != null) ? true : null,
    awayXG: awayRecentMatches?.some(m => m.awayXG != null) ? true : null,
    homeLineup,
    awayLineup,
    injuries: (homeInjuries?.length || awayInjuries?.length) ? true : null,
    h2hMatches: null,  // Phase 5 feature
    odds: null,
  });

  const homeMatchCount = homeRecentMatches?.filter(m => m.status === 'FINISHED').length || 0;
  const awayMatchCount = awayRecentMatches?.filter(m => m.status === 'FINISHED').length || 0;

  if (homeMatchCount < MIN_MATCHES || awayMatchCount < MIN_MATCHES) {
    logger.debug('Prediction: insufficient match history', {
      matchId: match.id,
      homeMatches: homeMatchCount,
      awayMatches: awayMatchCount,
      minRequired: MIN_MATCHES,
    });
    return {
      status: 'no_signal',
      reason: 'insufficient_data',
      homeMatchCount,
      awayMatchCount,
      minRequired: MIN_MATCHES,
      modelVersion: MODEL_VERSION,
    };
  }

  // ─── Run Individual Models ────────────────────────────────────────

  // 1. Elo
  let eloPrediction = null;
  if (homeTeamElo && awayTeamElo) {
    eloPrediction = elo.predictMatch({
      homeRating: homeTeamElo,
      awayRating: awayTeamElo,
    });
  }

  // 2. Poisson
  let poissonPrediction = null;
  if (homeTeamStats && awayTeamStats && leagueAvgGoals) {
    try {
      poissonPrediction = poisson.predict({
        homeStats: homeTeamStats,
        awayStats: awayTeamStats,
        leagueAvgGoals,
      });
    } catch (err) {
      logger.warn('Poisson model failed', { error: err.message, matchId: match.id });
    }
  }

  // 3. Dixon-Coles (requires Poisson lambda first)
  let dixonColesPrediction = null;
  if (poissonPrediction?.expectedGoals) {
    try {
      const rho = dixonColes.estimateRho(
        [...(homeRecentMatches || []), ...(awayRecentMatches || [])]
      );
      dixonColesPrediction = dixonColes.predictFromLambda(
        poissonPrediction.expectedGoals.home,
        poissonPrediction.expectedGoals.away,
        rho
      );
    } catch (err) {
      logger.warn('Dixon-Coles model failed', { error: err.message, matchId: match.id });
    }
  }

  // 4. Form
  let formPrediction = null;
  try {
    formPrediction = form.predict({
      homeMatches: homeRecentMatches || [],
      awayMatches: awayRecentMatches || [],
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      teamEloRatings,
    });
  } catch (err) {
    logger.warn('Form model failed', { error: err.message, matchId: match.id });
  }

  // 5. xG
  let xgPrediction = null;
  try {
    xgPrediction = xg.predict({
      homeMatches: homeRecentMatches || [],
      awayMatches: awayRecentMatches || [],
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      leagueAvgXG,
    });
  } catch (err) {
    logger.debug('xG model: no data available', { matchId: match.id });
  }

  // 6. Lineup impact
  let lineupImpact = null;
  if (homeLineup || awayLineup) {
    lineupImpact = lineup.calculateLineupImpact(homeLineup, awayLineup, playerRatings || {});
  }

  // 7. Injury impact
  let injuryImpact = null;
  if ((homeInjuries && homeInjuries.length > 0) || (awayInjuries && awayInjuries.length > 0)) {
    injuryImpact = injuries.calculateMatchInjuryImpact(homeInjuries, awayInjuries, playerRatings || {});
  }

  // 8. Rest days
  let restDelta = null;
  if (homeLastMatchDate && awayLastMatchDate && match.date) {
    const homeRest = restDays(homeLastMatchDate, match.date);
    const awayRest = restDays(awayLastMatchDate, match.date);
    if (homeRest !== null && awayRest !== null) {
      restDelta = homeRest - awayRest;
    }
  }

  // ─── Ensemble ─────────────────────────────────────────────────────
  const ensembleResult = ensemble.combine({
    eloPrediction: eloPrediction ? {
      oneX2: { home: eloPrediction.home, draw: eloPrediction.draw, away: eloPrediction.away }
    } : null,
    poissonPrediction,
    dixonColesPrediction,
    formPrediction,
    xgPrediction,
    lineupImpact,
    injuryImpact,
    restDelta,
  });

  if (!ensembleResult) {
    return {
      status: 'no_signal',
      reason: 'ensemble_failed',
      modelVersion: MODEL_VERSION,
    };
  }

  // ─── Calibration ──────────────────────────────────────────────────
  const calibrated = calibration.calibrate1X2(ensembleResult.oneX2);

  // ─── Final Prediction ─────────────────────────────────────────────
  const processingTime = Date.now() - startTime;

  const prediction = {
    status: 'signal',
    modelVersion: MODEL_VERSION,
    predictedAt: new Date().toISOString(),
    processingTimeMs: processingTime,

    oneX2: calibrated,
    goals: ensembleResult.goals,
    btts: ensembleResult.btts,
    exactScores: ensembleResult.exactScores,
    expectedGoals: ensembleResult.expectedGoals,

    confidence: ensembleResult.confidence,
    dataQuality,

    components: {
      elo: eloPrediction,
      poisson: poissonPrediction ? {
        oneX2: poissonPrediction.oneX2,
        expectedGoals: poissonPrediction.expectedGoals,
      } : null,
      dixonColes: dixonColesPrediction ? {
        oneX2: dixonColesPrediction.oneX2,
        lowScoreAdjustments: dixonColesPrediction.lowScoreAdjustments,
      } : null,
      form: formPrediction ? {
        oneX2: { home: formPrediction.home, draw: formPrediction.draw, away: formPrediction.away },
        homeForm: formPrediction.homeForm,
        awayForm: formPrediction.awayForm,
      } : null,
      xg: xgPrediction ? {
        oneX2: xgPrediction.oneX2,
        expectedGoals: xgPrediction.expectedGoals,
      } : null,
    },

    adjustments: {
      lineup: lineupImpact,
      injuries: injuryImpact,
      rest: restDelta !== null ? { delta: restDelta } : null,
    },

    modelAgreement: ensembleResult.modelAgreement,

    meta: {
      homeMatchCount,
      awayMatchCount,
      lineupStatus: lineupImpact?.description || 'unavailable',
      xgAvailable: xgPrediction !== null,
    },
  };

  logger.debug('Prediction generated', {
    matchId: match.id,
    home: round(calibrated.home * 100, 1) + '%',
    draw: round(calibrated.draw * 100, 1) + '%',
    away: round(calibrated.away * 100, 1) + '%',
    confidence: prediction.confidence,
    processingTimeMs: processingTime,
  });

  return prediction;
}

module.exports = { predict };
