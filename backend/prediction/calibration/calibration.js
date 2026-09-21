'use strict';

const { round, safeDivide } = require('../../utils/helpers');

/**
 * Platt scaling calibration
 * Transforms raw model probabilities to calibrated ones
 * Parameters A, B are fitted from historical predictions vs results
 *
 * calibrated_p = 1 / (1 + exp(A * raw_p + B))
 */
function plattScale(rawProb, A = -1.0, B = 0.0) {
  return 1 / (1 + Math.exp(A * rawProb + B));
}

/**
 * Calibrate a full 1X2 prediction
 * Uses separate calibration for each outcome
 */
function calibrate1X2(probs, calibrationParams = null) {
  if (!calibrationParams) {
    // No calibration params: apply mild regression toward base rates
    // Average football base rates: home ~45%, draw ~25%, away ~30%
    const BASE_HOME = 0.45;
    const BASE_DRAW = 0.25;
    const BASE_AWAY = 0.30;
    const WEIGHT = 0.05; // 5% pull toward base rates

    const home = probs.home * (1 - WEIGHT) + BASE_HOME * WEIGHT;
    const draw = probs.draw * (1 - WEIGHT) + BASE_DRAW * WEIGHT;
    const away = probs.away * (1 - WEIGHT) + BASE_AWAY * WEIGHT;
    const total = home + draw + away;

    return {
      home: round(home / total, 4),
      draw: round(draw / total, 4),
      away: round(away / total, 4),
      calibrated: true,
      method: 'base_rate_regression',
    };
  }

  // With fitted parameters
  const { homeParams, drawParams, awayParams } = calibrationParams;
  const home = plattScale(probs.home, homeParams.A, homeParams.B);
  const draw = plattScale(probs.draw, drawParams.A, drawParams.B);
  const away = plattScale(probs.away, awayParams.A, awayParams.B);
  const total = home + draw + away;

  return {
    home: round(home / total, 4),
    draw: round(draw / total, 4),
    away: round(away / total, 4),
    calibrated: true,
    method: 'platt_scaling',
  };
}

/**
 * Calculate Brier Score for a single prediction
 * BS = (p_home - o_home)² + (p_draw - o_draw)² + (p_away - o_away)²
 * Lower = better. Perfect = 0, Worst = 2.
 */
function brierScore(predicted, actual) {
  const { home: pH, draw: pD, away: pA } = predicted;
  const { home: oH, draw: oD, away: oA } = actual; // Binary outcomes

  return round(
    Math.pow(pH - oH, 2) + Math.pow(pD - oD, 2) + Math.pow(pA - oA, 2),
    6
  );
}

/**
 * Convert match result to binary outcome vector
 * homeGoals, awayGoals → { home, draw, away } as 0/1
 */
function resultToOutcome(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return { home: 1, draw: 0, away: 0 };
  if (homeGoals === awayGoals) return { home: 0, draw: 1, away: 0 };
  return { home: 0, draw: 0, away: 1 };
}

/**
 * Calculate log loss for a prediction
 * LL = -sum(actual * log(predicted))
 * Lower = better. Perfect → 0.
 */
function logLoss(predicted, actual, epsilon = 1e-7) {
  const clamp = (p) => Math.max(epsilon, Math.min(1 - epsilon, p));
  const loss = -(
    actual.home * Math.log(clamp(predicted.home)) +
    actual.draw * Math.log(clamp(predicted.draw)) +
    actual.away * Math.log(clamp(predicted.away))
  );
  return round(loss, 6);
}

/**
 * Calculate calibration metrics over a set of predictions
 * Groups predictions into buckets and checks if frequencies match probabilities
 */
function calibrationMetrics(predictions) {
  if (!predictions || predictions.length < 10) {
    return { error: 'Insufficient data for calibration analysis (min 10 predictions required)' };
  }

  const resolved = predictions.filter(p => p.result !== null && p.result !== undefined);
  if (resolved.length < 10) {
    return { error: 'Insufficient resolved predictions' };
  }

  let totalBrierScore = 0;
  let totalLogLoss = 0;
  let correct = 0;

  for (const p of resolved) {
    const actual = resultToOutcome(p.result.homeGoals, p.result.awayGoals);
    totalBrierScore += brierScore(p.predicted, actual);
    totalLogLoss += logLoss(p.predicted, actual);

    const predictedOutcome = getTopOutcome(p.predicted);
    const actualOutcome = getTopOutcome(actual);
    if (predictedOutcome === actualOutcome) correct++;
  }

  const n = resolved.length;
  const avgBrier = round(safeDivide(totalBrierScore, n), 6);
  const avgLogLoss = round(safeDivide(totalLogLoss, n), 6);
  const accuracy = round(safeDivide(correct, n), 4);

  // Calibration by bucket
  const calibrationError = calculateExpectedCalibrationError(resolved);

  return {
    sampleSize: n,
    accuracy,
    accuracyLabel: accuracyLabel(accuracy),
    brierScore: avgBrier,
    brierLabel: brierLabel(avgBrier),
    logLoss: avgLogLoss,
    calibrationError,
  };
}

function getTopOutcome(probs) {
  if (probs.home >= probs.draw && probs.home >= probs.away) return 'home';
  if (probs.draw >= probs.home && probs.draw >= probs.away) return 'draw';
  return 'away';
}

function calculateExpectedCalibrationError(predictions, buckets = 10) {
  const bucketSize = 1 / buckets;
  let totalECE = 0;
  const n = predictions.length;

  for (let b = 0; b < buckets; b++) {
    const lo = b * bucketSize;
    const hi = (b + 1) * bucketSize;

    const bucket = predictions.filter(p => p.predicted.home >= lo && p.predicted.home < hi);
    if (bucket.length === 0) continue;

    const avgConfidence = bucket.reduce((s, p) => s + p.predicted.home, 0) / bucket.length;
    const avgAccuracy = bucket.filter(p => p.result.homeGoals > p.result.awayGoals).length / bucket.length;

    totalECE += (bucket.length / n) * Math.abs(avgConfidence - avgAccuracy);
  }

  return round(totalECE, 4);
}

function accuracyLabel(acc) {
  if (acc >= 0.60) return 'excellent';
  if (acc >= 0.50) return 'good';
  if (acc >= 0.40) return 'fair';
  return 'poor';
}

function brierLabel(bs) {
  // Lower is better; for 3-outcome football: random ≈ 0.67
  if (bs <= 0.45) return 'excellent';
  if (bs <= 0.55) return 'good';
  if (bs <= 0.62) return 'fair';
  return 'poor';
}

module.exports = {
  calibrate1X2,
  brierScore,
  logLoss,
  resultToOutcome,
  calibrationMetrics,
  plattScale,
};
