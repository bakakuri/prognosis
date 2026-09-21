'use strict';

const {
  buildScoreMatrix,
  scoreMatrixTo1X2,
  scoreMatrixToOverUnder,
  scoreMatrixToBTTS,
  getTopExactScores,
  safeDivide,
  round,
} = require('../../utils/helpers');

const MAX_GOALS = 10; // Matrix size per team

/**
 * Calculate attack and defense strengths from team statistics
 *
 * Attack strength = team avg goals / league avg goals
 * Defense strength = team avg conceded / league avg goals
 * Values > 1 = above average, < 1 = below average
 */
function calculateStrengths(teamStats, leagueAvgGoals) {
  if (!teamStats || !leagueAvgGoals || leagueAvgGoals === 0) {
    return null;
  }

  const homeAttack = safeDivide(teamStats.goalsFor.average.home, leagueAvgGoals);
  const homeDefense = safeDivide(teamStats.goalsAgainst.average.home, leagueAvgGoals);
  const awayAttack = safeDivide(teamStats.goalsFor.average.away, leagueAvgGoals);
  const awayDefense = safeDivide(teamStats.goalsAgainst.average.away, leagueAvgGoals);

  return {
    home: { attack: round(homeAttack, 4), defense: round(homeDefense, 4) },
    away: { attack: round(awayAttack, 4), defense: round(awayDefense, 4) },
  };
}

/**
 * Calculate expected goals (xG) for a match using Poisson model
 *
 * Lambda_home = home_attack * away_defense * league_avg * home_advantage
 * Lambda_away = away_attack * home_defense * league_avg
 */
function calculateExpectedGoals({
  homeAttack,
  homeDefense,
  awayAttack,
  awayDefense,
  leagueAvgGoals,
  homeAdvantage = 1.1, // Home teams typically score ~10% more
}) {
  if (!homeAttack || !awayDefense || !awayAttack || !homeDefense || !leagueAvgGoals) {
    return null;
  }

  const lambdaHome = homeAttack * awayDefense * leagueAvgGoals * homeAdvantage;
  const lambdaAway = awayAttack * homeDefense * leagueAvgGoals;

  return {
    home: round(Math.max(0.1, lambdaHome), 4),
    away: round(Math.max(0.1, lambdaAway), 4),
    total: round(Math.max(0.2, lambdaHome + lambdaAway), 4),
  };
}

/**
 * Full Poisson prediction from expected goals
 * Returns all markets: 1X2, Over/Under, BTTS, exact scores
 */
function predictFromLambda(lambdaHome, lambdaAway) {
  if (!lambdaHome || !lambdaAway || lambdaHome <= 0 || lambdaAway <= 0) {
    return null;
  }

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway, MAX_GOALS);
  const oneX2 = scoreMatrixTo1X2(matrix);
  const overUnder = scoreMatrixToOverUnder(matrix);
  const btts = scoreMatrixToBTTS(matrix);
  const exactScores = getTopExactScores(matrix, 12);

  return {
    lambdaHome: round(lambdaHome, 4),
    lambdaAway: round(lambdaAway, 4),
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
  };
}

/**
 * Full Poisson prediction given team stats and league average
 */
function predict({
  homeStats,
  awayStats,
  leagueAvgGoals = 1.35, // Typical league average
}) {
  if (!homeStats || !awayStats) return null;

  const homeStrengths = calculateStrengths(homeStats, leagueAvgGoals);
  const awayStrengths = calculateStrengths(awayStats, leagueAvgGoals);

  if (!homeStrengths || !awayStrengths) return null;

  const expectedGoals = calculateExpectedGoals({
    homeAttack: homeStrengths.home.attack,
    homeDefense: homeStrengths.home.defense,
    awayAttack: awayStrengths.away.attack,
    awayDefense: awayStrengths.away.defense,
    leagueAvgGoals,
  });

  if (!expectedGoals) return null;

  const prediction = predictFromLambda(expectedGoals.home, expectedGoals.away);
  if (!prediction) return null;

  return {
    ...prediction,
    expectedGoals,
    homeStrengths,
    awayStrengths,
    leagueAvgGoals,
  };
}

/**
 * Calculate league average goals from standings/season data
 */
function calculateLeagueAverage(matches) {
  if (!matches || matches.length === 0) return 1.35;

  const totalGoals = matches.reduce((sum, m) => {
    return sum + (m.homeGoals || 0) + (m.awayGoals || 0);
  }, 0);

  const avgPerTeam = safeDivide(totalGoals, matches.length * 2);
  return round(Math.max(0.5, Math.min(3.0, avgPerTeam)), 4);
}

module.exports = {
  calculateStrengths,
  calculateExpectedGoals,
  predictFromLambda,
  predict,
  calculateLeagueAverage,
};
