'use strict';

const {
  poissonPMF,
  scoreMatrixTo1X2,
  scoreMatrixToOverUnder,
  scoreMatrixToBTTS,
  getTopExactScores,
  round,
  safeDivide,
} = require('../../utils/helpers');

const MAX_GOALS = 10;

/**
 * Dixon-Coles correction factor τ (tau)
 *
 * Adjusts Poisson probabilities for low-score outcomes:
 * 0-0, 1-0, 0-1, 1-1
 *
 * These occur more frequently than naive Poisson predicts.
 * ρ (rho) is the correlation parameter, typically negative (≈ -0.13)
 */
function tau(homeGoals, awayGoals, lambdaHome, lambdaAway, rho) {
  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - lambdaHome * lambdaAway * rho;
  }
  if (homeGoals === 1 && awayGoals === 0) {
    return 1 + lambdaAway * rho;
  }
  if (homeGoals === 0 && awayGoals === 1) {
    return 1 + lambdaHome * rho;
  }
  if (homeGoals === 1 && awayGoals === 1) {
    return 1 - rho;
  }
  return 1; // No correction for higher scores
}

/**
 * Build score probability matrix with Dixon-Coles adjustment
 */
function buildDixonColesMatrix(lambdaHome, lambdaAway, rho = -0.13) {
  const matrix = [];
  let totalMass = 0;

  // First pass: compute raw adjusted probabilities
  for (let h = 0; h <= MAX_GOALS; h++) {
    matrix[h] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const rawProb = poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a);
      const correction = tau(h, a, lambdaHome, lambdaAway, rho);
      const adjustedProb = rawProb * correction;
      matrix[h][a] = Math.max(0, adjustedProb);
      totalMass += Math.max(0, adjustedProb);
    }
  }

  // Normalize to ensure probabilities sum to 1
  if (totalMass > 0 && totalMass !== 1) {
    for (let h = 0; h <= MAX_GOALS; h++) {
      for (let a = 0; a <= MAX_GOALS; a++) {
        matrix[h][a] = matrix[h][a] / totalMass;
      }
    }
  }

  return matrix;
}

/**
 * Full Dixon-Coles prediction
 */
function predictFromLambda(lambdaHome, lambdaAway, rho = -0.13) {
  if (!lambdaHome || !lambdaAway || lambdaHome <= 0 || lambdaAway <= 0) {
    return null;
  }

  const matrix = buildDixonColesMatrix(lambdaHome, lambdaAway, rho);
  const oneX2 = scoreMatrixTo1X2(matrix);
  const overUnder = scoreMatrixToOverUnder(matrix);
  const btts = scoreMatrixToBTTS(matrix);
  const exactScores = getTopExactScores(matrix, 12);

  return {
    lambdaHome: round(lambdaHome, 4),
    lambdaAway: round(lambdaAway, 4),
    rho,
    oneX2: {
      home: round(oneX2.home, 4),
      draw: round(oneX2.draw, 4),
      away: round(oneX2.away, 4),
    },
    goals: {
      over_0_5: round(overUnder.over0_5, 4),
      over_1_5: round(overUnder.over1_5, 4),
      over_2_5: round(overUnder.over2_5, 4),
      over_3_5: round(overUnder.over3_5, 4),
      over_4_5: round(overUnder.over4_5, 4),
      under_0_5: round(overUnder.under0_5, 4),
      under_1_5: round(overUnder.under1_5, 4),
      under_2_5: round(overUnder.under2_5, 4),
      under_3_5: round(overUnder.under3_5, 4),
      under_4_5: round(overUnder.under4_5, 4),
    },
    btts: {
      yes: round(btts.yes, 4),
      no: round(btts.no, 4),
    },
    exactScores: exactScores.map(s => ({
      home: s.home,
      away: s.away,
      probability: round(s.probability, 4),
    })),
    // Dixon-Coles specific: adjusted low-score probs for transparency
    lowScoreAdjustments: {
      '0-0': round(matrix[0][0], 4),
      '1-0': round(matrix[1][0], 4),
      '0-1': round(matrix[0][1], 4),
      '1-1': round(matrix[1][1], 4),
    },
  };
}

/**
 * Estimate rho from historical data
 * Rho captures negative correlation between home/away goals
 */
function estimateRho(historicalMatches) {
  if (!historicalMatches || historicalMatches.length < 20) {
    return -0.13; // Default from Dixon-Coles original paper
  }

  // Simple estimate: compare 0-0/1-1 frequency to Poisson expectation
  const avgHome = safeDivide(
    historicalMatches.reduce((s, m) => s + (m.homeGoals || 0), 0),
    historicalMatches.length
  );
  const avgAway = safeDivide(
    historicalMatches.reduce((s, m) => s + (m.awayGoals || 0), 0),
    historicalMatches.length
  );

  if (avgHome <= 0 || avgAway <= 0) return -0.13;

  const observed00 = historicalMatches.filter(m => m.homeGoals === 0 && m.awayGoals === 0).length / historicalMatches.length;
  const expected00 = poissonPMF(avgHome, 0) * poissonPMF(avgAway, 0);

  if (expected00 === 0) return -0.13;

  // rho ≈ (observed00/expected00 - 1) / (avgHome * avgAway)
  const rhoEstimate = safeDivide((observed00 - expected00), expected00 * avgHome * avgAway);
  return round(Math.max(-0.5, Math.min(0, rhoEstimate)), 4);
}

module.exports = {
  tau,
  buildDixonColesMatrix,
  predictFromLambda,
  estimateRho,
};
