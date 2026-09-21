'use strict';

const env = require('../../config/env');
const { round, safeDivide, normalizeToSum, calculateConfidenceLevel } = require('../../utils/helpers');

const DEFAULT_WEIGHTS = env.PREDICTION.ENSEMBLE_WEIGHTS;

/**
 * Check if a probability object is valid
 */
function isValid1X2(prob) {
  if (!prob) return false;
  const { home, draw, away } = prob;
  if (home == null || draw == null || away == null) return false;
  const sum = home + draw + away;
  return sum > 0.85 && sum < 1.15;
}

/**
 * Normalize a 1X2 probability object to sum to exactly 1
 */
function normalize1X2(prob) {
  const values = normalizeToSum([prob.home, prob.draw, prob.away]);
  return {
    home: round(values[0], 4),
    draw: round(values[1], 4),
    away: round(values[2], 4),
  };
}

/**
 * Combine multiple 1X2 probability estimates with weights
 * Only includes components that have valid data
 */
function weightedEnsemble(components) {
  const validComponents = components.filter(c => c.probs && isValid1X2(c.probs));

  if (validComponents.length === 0) return null;

  const totalWeight = validComponents.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;

  let homeSum = 0, drawSum = 0, awaySum = 0;

  for (const component of validComponents) {
    const normalizedWeight = c.weight / totalWeight;
    const prob = normalize1X2(component.probs);
    homeSum += prob.home * normalizedWeight;
    drawSum += prob.draw * normalizedWeight;
    awaySum += prob.away * normalizedWeight;
  }

  const ensemble = normalize1X2({ home: homeSum, draw: drawSum, away: awaySum });

  // Calculate model agreement (how much do models agree?)
  const homeValues = validComponents.map(c => c.probs.home);
  const homeStdDev = standardDeviation(homeValues);
  const agreement = Math.max(0, 1 - homeStdDev * 4); // 0 = no agreement, 1 = perfect agreement

  return {
    ...ensemble,
    components: validComponents.map(c => ({
      name: c.name,
      weight: c.weight,
      normalizedWeight: round(safeDivide(c.weight, totalWeight), 4),
      home: round(c.probs.home, 4),
      draw: round(c.probs.draw, 4),
      away: round(c.probs.away, 4),
    })),
    agreement: round(agreement, 4),
    agreementLabel: agreementLabel(agreement),
    totalComponents: validComponents.length,
    missingComponents: components.filter(c => !c.probs || !isValid1X2(c.probs)).map(c => c.name),
  };
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function agreementLabel(agreement) {
  if (agreement >= 0.85) return 'strong';
  if (agreement >= 0.65) return 'good';
  if (agreement >= 0.40) return 'moderate';
  return 'weak';
}

/**
 * Combine over/under markets from multiple sources
 */
function combineGoalMarkets(poissonGoals, dcGoals) {
  if (!poissonGoals && !dcGoals) return null;

  // Weight DC slightly higher for over/under as it's better calibrated for low-scoring
  const sources = [];
  if (poissonGoals) sources.push({ data: poissonGoals, weight: 0.45 });
  if (dcGoals) sources.push({ data: dcGoals, weight: 0.55 });

  const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
  const markets = ['over_0_5', 'over_1_5', 'over_2_5', 'over_3_5', 'over_4_5',
                   'under_0_5', 'under_1_5', 'under_2_5', 'under_3_5', 'under_4_5'];
  const result = {};

  for (const market of markets) {
    let weighted = 0;
    for (const src of sources) {
      if (src.data[market] != null) {
        weighted += src.data[market] * (src.weight / totalWeight);
      }
    }
    result[market] = round(weighted, 4);
  }

  return result;
}

/**
 * Apply lineup impact adjustment to predictions
 */
function applyLineupAdjustment(probs, lineupImpact) {
  if (!probs || !lineupImpact) return probs;

  const { homeImpact, awayImpact } = lineupImpact;
  const maxAdj = 0.05; // Max 5% swing from lineups

  const homeAdj = Math.max(-maxAdj, Math.min(maxAdj, (homeImpact - awayImpact) * 0.1));

  const adjusted = {
    home: probs.home + homeAdj,
    draw: probs.draw - Math.abs(homeAdj) * 0.3,
    away: probs.away - homeAdj,
  };

  return normalize1X2(adjusted);
}

/**
 * Apply injury adjustment to predictions
 */
function applyInjuryAdjustment(probs, injuryImpact) {
  if (!probs || !injuryImpact) return probs;

  const { homeImpact, awayImpact } = injuryImpact;
  // Negative impact = team weakened by injuries
  const maxAdj = 0.04;
  const netAdj = Math.max(-maxAdj, Math.min(maxAdj, (awayImpact - homeImpact) * 0.08));

  const adjusted = {
    home: probs.home + netAdj,
    draw: probs.draw - Math.abs(netAdj) * 0.2,
    away: probs.away - netAdj,
  };

  return normalize1X2(adjusted);
}

/**
 * Apply rest/congestion adjustment
 */
function applyRestAdjustment(probs, restDelta) {
  if (!probs || restDelta == null) return probs;

  // restDelta = homeRestDays - awayRestDays
  // Positive = home team had more rest = slight home advantage
  const maxAdj = 0.03;
  const adj = Math.max(-maxAdj, Math.min(maxAdj, restDelta * 0.005));

  const adjusted = {
    home: probs.home + adj,
    draw: probs.draw - Math.abs(adj) * 0.1,
    away: probs.away - adj,
  };

  return normalize1X2(adjusted);
}

/**
 * Main ensemble — combine all model outputs into final prediction
 */
function combine({
  eloPrediction,
  poissonPrediction,
  dixonColesPrediction,
  formPrediction,
  xgPrediction,
  lineupImpact,
  injuryImpact,
  restDelta,
  weights = DEFAULT_WEIGHTS,
}) {
  // Build component list for ensemble
  const components = [
    { name: 'elo', probs: eloPrediction?.oneX2 || eloPrediction, weight: weights.elo },
    { name: 'poisson', probs: poissonPrediction?.oneX2, weight: weights.poisson },
    { name: 'dixonColes', probs: dixonColesPrediction?.oneX2, weight: weights.dixonColes },
    { name: 'form', probs: formPrediction ? { home: formPrediction.home, draw: formPrediction.draw, away: formPrediction.away } : null, weight: weights.form },
    { name: 'xg', probs: xgPrediction?.oneX2, weight: weights.xg },
  ];

  const baseEnsemble = weightedEnsemble(components);
  if (!baseEnsemble) return null;

  // Apply adjustments
  let finalProbs = { home: baseEnsemble.home, draw: baseEnsemble.draw, away: baseEnsemble.away };

  finalProbs = applyLineupAdjustment(finalProbs, lineupImpact);
  finalProbs = applyInjuryAdjustment(finalProbs, injuryImpact);
  finalProbs = applyRestAdjustment(finalProbs, restDelta);

  // Combine goal markets
  const combinedGoals = combineGoalMarkets(
    poissonPrediction?.goals,
    dixonColesPrediction?.goals
  );

  // Determine best BTTS estimate
  const bttsYes = poissonPrediction?.btts?.yes ?? dixonColesPrediction?.btts?.yes ?? null;

  // Calculate confidence
  const margin = Math.max(finalProbs.home, finalProbs.draw, finalProbs.away) - 
                 Math.min(finalProbs.home, finalProbs.draw, finalProbs.away);
  
  const confidence = calculateConfidenceLevel({
    modelAgreement: baseEnsemble.agreement,
    dataQuality: components.filter(c => c.probs).length / components.length,
    sampleSize: 30, // Will be updated with actual match count
    marginOfDifference: margin,
  });

  return {
    oneX2: finalProbs,
    goals: combinedGoals,
    btts: bttsYes !== null ? {
      yes: round(bttsYes, 4),
      no: round(1 - bttsYes, 4),
    } : null,
    exactScores: dixonColesPrediction?.exactScores || poissonPrediction?.exactScores || null,
    expectedGoals: poissonPrediction?.expectedGoals || xgPrediction?.expectedGoals || null,
    modelAgreement: baseEnsemble,
    confidence,
    adjustments: {
      lineup: lineupImpact || null,
      injury: injuryImpact || null,
      rest: restDelta !== null ? { delta: restDelta } : null,
    },
  };
}

module.exports = {
  combine,
  weightedEnsemble,
  normalize1X2,
  isValid1X2,
  combineGoalMarkets,
  applyLineupAdjustment,
  applyInjuryAdjustment,
  applyRestAdjustment,
};
