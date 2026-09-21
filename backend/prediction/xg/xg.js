'use strict';

const { predictFromLambda } = require('../poisson/poisson');
const { round, safeDivide, weightedAverage, decayWeight } = require('../../utils/helpers');

/**
 * Calculate team xG averages from recent match history
 * Requires xG data fields on match records
 */
function calculateXGAverages(matches, teamId, matchWindow = 10) {
  if (!matches || matches.length === 0) return null;

  const relevant = matches
    .filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, matchWindow);

  const xgMatches = relevant.filter(m => {
    const xgFor = m.homeTeamId === teamId ? m.homeXG : m.awayXG;
    return xgFor !== null && xgFor !== undefined;
  });

  if (xgMatches.length < 3) return null; // Not enough xG data

  const weights = xgMatches.map((_, i) => decayWeight(i, 0.85));

  const xgForValues = xgMatches.map(m =>
    m.homeTeamId === teamId ? (m.homeXG || 0) : (m.awayXG || 0)
  );
  const xgAgainstValues = xgMatches.map(m =>
    m.homeTeamId === teamId ? (m.awayXG || 0) : (m.homeXG || 0)
  );

  const avgXGFor = weightedAverage(xgForValues, weights);
  const avgXGAgainst = weightedAverage(xgAgainstValues, weights);

  // Separate home/away xG
  const homeXGMatches = xgMatches.filter(m => m.homeTeamId === teamId);
  const awayXGMatches = xgMatches.filter(m => m.awayTeamId === teamId);

  const homeAvgXGFor = homeXGMatches.length >= 2
    ? weightedAverage(homeXGMatches.map(m => m.homeXG || 0), homeXGMatches.map((_, i) => decayWeight(i, 0.85)))
    : null;

  const awayAvgXGFor = awayXGMatches.length >= 2
    ? weightedAverage(awayXGMatches.map(m => m.awayXG || 0), awayXGMatches.map((_, i) => decayWeight(i, 0.85)))
    : null;

  return {
    avgXGFor: round(avgXGFor, 4),
    avgXGAgainst: round(avgXGAgainst, 4),
    homeAvgXGFor: homeAvgXGFor !== null ? round(homeAvgXGFor, 4) : null,
    awayAvgXGFor: awayAvgXGFor !== null ? round(awayAvgXGFor, 4) : null,
    sampleSize: xgMatches.length,
  };
}

/**
 * Calculate expected goals for a specific match using xG history
 */
function calculateMatchXG(homeXGStats, awayXGStats, leagueAvgXG = 1.25) {
  if (!homeXGStats || !awayXGStats) return null;

  // Use home-specific xG where available, otherwise overall
  const homeAttackXG = homeXGStats.homeAvgXGFor || homeXGStats.avgXGFor;
  const homeDefenseXG = homeXGStats.avgXGAgainst;
  const awayAttackXG = awayXGStats.awayAvgXGFor || awayXGStats.avgXGFor;
  const awayDefenseXG = awayXGStats.avgXGAgainst;

  if (!homeAttackXG || !awayAttackXG) return null;

  // xG-based expected goals: blend attack and defense
  const homeXGExpected = (homeAttackXG * safeDivide(awayDefenseXG, leagueAvgXG) + homeAttackXG) / 2;
  const awayXGExpected = (awayAttackXG * safeDivide(homeDefenseXG, leagueAvgXG) + awayAttackXG) / 2;

  const lambda_home = round(Math.max(0.1, homeXGExpected * 0.95), 4); // Slight regression to mean
  const lambda_away = round(Math.max(0.1, awayXGExpected * 0.95), 4);

  return { home: lambda_home, away: lambda_away, total: round(lambda_home + lambda_away, 4) };
}

/**
 * Full xG-based prediction
 */
function predict({ homeMatches, awayMatches, homeTeamId, awayTeamId, leagueAvgXG }) {
  const homeXGStats = calculateXGAverages(homeMatches, homeTeamId);
  const awayXGStats = calculateXGAverages(awayMatches, awayTeamId);

  if (!homeXGStats || !awayXGStats) return null;

  const expectedGoals = calculateMatchXG(homeXGStats, awayXGStats, leagueAvgXG);
  if (!expectedGoals) return null;

  const poissonResult = predictFromLambda(expectedGoals.home, expectedGoals.away);
  if (!poissonResult) return null;

  return {
    ...poissonResult,
    expectedGoals,
    homeXGStats,
    awayXGStats,
    dataQuality: homeXGStats.sampleSize >= 8 && awayXGStats.sampleSize >= 8 ? 'good' : 'limited',
  };
}

module.exports = { calculateXGAverages, calculateMatchXG, predict };
