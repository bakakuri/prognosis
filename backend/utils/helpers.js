'use strict';

/**
 * Clamp a number between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round to n decimal places
 */
function round(value, decimals = 4) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convert probability to percentage string
 */
function toPercent(probability, decimals = 1) {
  return `${round(probability * 100, decimals)}%`;
}

/**
 * Normalize an array of values to sum to 1
 */
function normalizeToSum(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return values.map(() => 0);
  return values.map(v => v / sum);
}

/**
 * Calculate Poisson probability P(X = k) given lambda
 */
function poissonPMF(lambda, k) {
  if (lambda <= 0 || k < 0) return 0;
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

/**
 * Calculate cumulative Poisson P(X <= k)
 */
function poissonCDF(lambda, k) {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += poissonPMF(lambda, i);
  }
  return sum;
}

/**
 * Factorial (memoized)
 */
const factorialCache = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
function factorial(n) {
  if (n < 0) return 0;
  if (n < factorialCache.length) return factorialCache[n];
  let result = factorialCache[factorialCache.length - 1];
  for (let i = factorialCache.length; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Exponential decay weight for recency
 * Index 0 = most recent match
 */
function decayWeight(index, decayFactor = 0.85) {
  return Math.pow(decayFactor, index);
}

/**
 * Weighted average
 */
function weightedAverage(values, weights) {
  if (values.length !== weights.length) throw new Error('Values and weights must have equal length');
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = values.reduce((sum, val, i) => sum + val * weights[i], 0);
  return weightedSum / totalWeight;
}

/**
 * Safe division (returns 0 if denominator is 0)
 */
function safeDivide(numerator, denominator, fallback = 0) {
  if (denominator === 0 || !isFinite(denominator)) return fallback;
  return numerator / denominator;
}

/**
 * Build a score probability matrix using Poisson
 * Returns matrix[homeGoals][awayGoals] = probability
 * Limited to maxGoals per team
 */
function buildScoreMatrix(lambdaHome, lambdaAway, maxGoals = 10) {
  const matrix = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a);
    }
  }
  return matrix;
}

/**
 * Calculate 1X2 probabilities from score matrix
 */
function scoreMatrixTo1X2(matrix) {
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      const p = matrix[h][a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away;
  return {
    home: safeDivide(home, total),
    draw: safeDivide(draw, total),
    away: safeDivide(away, total),
  };
}

/**
 * Calculate over/under probabilities from score matrix
 */
function scoreMatrixToOverUnder(matrix) {
  const thresholds = [0.5, 1.5, 2.5, 3.5, 4.5];
  const result = {};

  for (const threshold of thresholds) {
    let over = 0, under = 0;
    for (let h = 0; h < matrix.length; h++) {
      for (let a = 0; a < matrix[h].length; a++) {
        const total = h + a;
        if (total > threshold) over += matrix[h][a];
        else under += matrix[h][a];
      }
    }
    const key = threshold.toString().replace('.', '_');
    result[`over${key}`] = over;
    result[`under${key}`] = under;
  }

  return result;
}

/**
 * Calculate BTTS probability from score matrix
 */
function scoreMatrixToBTTS(matrix) {
  let bttsYes = 0;
  for (let h = 1; h < matrix.length; h++) {
    for (let a = 1; a < matrix[h].length; a++) {
      bttsYes += matrix[h][a];
    }
  }
  return { yes: bttsYes, no: 1 - bttsYes };
}

/**
 * Get top N exact score probabilities from matrix
 */
function getTopExactScores(matrix, n = 10) {
  const scores = [];
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      scores.push({ home: h, away: a, probability: matrix[h][a] });
    }
  }
  return scores
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n);
}

/**
 * Calculate confidence level from various factors
 */
function calculateConfidenceLevel(factors) {
  const {
    modelAgreement,    // 0-1 (how much models agree)
    dataQuality,       // 0-1
    sampleSize,        // number of historical matches
    marginOfDifference, // absolute difference in 1X2 probabilities
  } = factors;

  let score = 0;
  score += modelAgreement * 0.30;
  score += dataQuality * 0.25;
  score += clamp(sampleSize / 50, 0, 1) * 0.20;
  score += clamp(marginOfDifference * 2, 0, 1) * 0.25;

  if (score >= 0.75) return 'very_high';
  if (score >= 0.60) return 'high';
  if (score >= 0.40) return 'medium';
  if (score >= 0.20) return 'low';
  return 'no_signal';
}

/**
 * Calculate data quality score based on available fields
 */
function calculateDataQuality(match) {
  let available = 0;
  let total = 0;

  const fields = [
    { value: match.homeElo, weight: 2 },
    { value: match.awayElo, weight: 2 },
    { value: match.homeFormMatches, weight: 2 },
    { value: match.awayFormMatches, weight: 2 },
    { value: match.homeXG, weight: 1 },
    { value: match.awayXG, weight: 1 },
    { value: match.homeLineup, weight: 1 },
    { value: match.awayLineup, weight: 1 },
    { value: match.injuries, weight: 1 },
    { value: match.h2hMatches, weight: 1 },
    { value: match.odds, weight: 0.5 },
  ];

  for (const field of fields) {
    total += field.weight;
    if (field.value !== null && field.value !== undefined) {
      available += field.weight;
    }
  }

  const score = safeDivide(available, total);

  if (score >= 0.85) return { score, label: 'excellent' };
  if (score >= 0.65) return { score, label: 'good' };
  if (score >= 0.40) return { score, label: 'limited' };
  return { score, label: 'insufficient' };
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, options = {}) {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await sleep(delay);
    }
  }
}

/**
 * Chunk array into smaller arrays
 */
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  clamp,
  round,
  toPercent,
  normalizeToSum,
  poissonPMF,
  poissonCDF,
  factorial,
  decayWeight,
  weightedAverage,
  safeDivide,
  buildScoreMatrix,
  scoreMatrixTo1X2,
  scoreMatrixToOverUnder,
  scoreMatrixToBTTS,
  getTopExactScores,
  calculateConfidenceLevel,
  calculateDataQuality,
  sleep,
  retry,
  chunk,
};
