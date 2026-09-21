'use strict';

const env = require('../../config/env');
const { round, safeDivide } = require('../../utils/helpers');

// Competition importance multipliers for K-factor
const COMPETITION_K_MULTIPLIERS = {
  'World Cup': 2.0,
  'UEFA Champions League': 1.8,
  'UEFA Europa League': 1.6,
  'UEFA Conference League': 1.4,
  'Premier League': 1.4,
  'La Liga': 1.4,
  'Bundesliga': 1.4,
  'Serie A': 1.4,
  'Ligue 1': 1.3,
  'Eredivisie': 1.2,
  'Primeira Liga': 1.2,
  'Cup': 1.1,
  default: 1.0,
};

const BASE_ELO = 1500;
const K_FACTOR = env.PREDICTION.ELO_K_FACTOR;
const HOME_ADVANTAGE = env.PREDICTION.ELO_HOME_ADVANTAGE;

/**
 * Get the K-factor multiplier for a competition
 */
function getCompetitionMultiplier(leagueName) {
  for (const [name, multiplier] of Object.entries(COMPETITION_K_MULTIPLIERS)) {
    if (leagueName && leagueName.toLowerCase().includes(name.toLowerCase())) {
      return multiplier;
    }
  }
  return COMPETITION_K_MULTIPLIERS.default;
}

/**
 * Calculate goal-based K-factor multiplier
 * Bigger wins get more Elo movement
 */
function getGoalMultiplier(homeGoals, awayGoals) {
  const diff = Math.abs(homeGoals - awayGoals);
  if (diff === 0) return 1.0;
  if (diff === 1) return 1.0;
  if (diff === 2) return 1.5;
  if (diff === 3) return 1.75;
  return 1.75 + (diff - 3) * 0.25; // 1.75 for each additional goal
}

/**
 * Calculate expected outcome for team A vs team B
 * Returns the expected score (probability) for team A
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new Elo rating after a match
 * actualScore: 1 = win, 0.5 = draw, 0 = loss
 */
function updateRating(rating, expected, actual, k) {
  return rating + k * (actual - expected);
}

/**
 * Process a completed match and return updated ratings
 */
function processMatch({ homeRating, awayRating, homeGoals, awayGoals, leagueName }) {
  const homeAdj = homeRating + HOME_ADVANTAGE;
  const expectedHome = expectedScore(homeAdj, awayRating);
  const expectedAway = 1 - expectedHome;

  let actualHome, actualAway;
  if (homeGoals > awayGoals) {
    actualHome = 1;
    actualAway = 0;
  } else if (homeGoals === awayGoals) {
    actualHome = 0.5;
    actualAway = 0.5;
  } else {
    actualHome = 0;
    actualAway = 1;
  }

  const compMultiplier = getCompetitionMultiplier(leagueName);
  const goalMultiplier = getGoalMultiplier(homeGoals, awayGoals);
  const k = K_FACTOR * compMultiplier * goalMultiplier;

  const newHomeRating = round(updateRating(homeRating, expectedHome, actualHome, k), 2);
  const newAwayRating = round(updateRating(awayRating, expectedAway, actualAway, k), 2);

  return {
    home: {
      previousRating: homeRating,
      newRating: newHomeRating,
      change: round(newHomeRating - homeRating, 2),
    },
    away: {
      previousRating: awayRating,
      newRating: newAwayRating,
      change: round(newAwayRating - awayRating, 2),
    },
    match: {
      expectedHome: round(expectedHome, 4),
      expectedAway: round(expectedAway, 4),
      actualHome,
      actualAway,
      k,
    },
  };
}

/**
 * Calculate win probabilities from Elo ratings for an upcoming match
 * Returns probabilities for: home win, draw, away win
 */
function predictMatch({ homeRating, awayRating }) {
  if (!homeRating || !awayRating) {
    return null;
  }

  const homeAdj = homeRating + HOME_ADVANTAGE;
  const expectedHome = expectedScore(homeAdj, awayRating);

  // Convert Elo expected score to 1X2 probabilities
  // Draw probability estimated from research: typically 20-30% of matches
  // We use a draw allocation model based on the closeness of the teams
  const eloDiff = Math.abs(homeAdj - awayRating);
  const drawProb = Math.max(0.10, 0.30 - (eloDiff / 400) * 0.15);

  const homeWinProb = expectedHome * (1 - drawProb);
  const awayWinProb = (1 - expectedHome) * (1 - drawProb);

  // Normalize to ensure they sum to 1
  const total = homeWinProb + drawProb + awayWinProb;

  return {
    home: round(safeDivide(homeWinProb, total), 4),
    draw: round(safeDivide(drawProb, total), 4),
    away: round(safeDivide(awayWinProb, total), 4),
    homeElo: homeRating,
    awayElo: awayRating,
    eloDiff: round(homeAdj - awayRating, 2),
    expectedScore: round(expectedHome, 4),
  };
}

/**
 * Calculate team strength from Elo rating
 */
function ratingToStrength(rating) {
  // Normalize to 0-100 scale (1200 = weak, 1800 = strong)
  return round(Math.max(0, Math.min(100, (rating - 1200) / 6)), 1);
}

/**
 * Get initial Elo rating for a team based on league tier
 */
function getInitialRating(leagueTier = 'default') {
  const initialRatings = {
    top5: 1600,
    top20: 1530,
    default: 1500,
    lower: 1450,
  };
  return initialRatings[leagueTier] || BASE_ELO;
}

module.exports = {
  processMatch,
  predictMatch,
  expectedScore,
  updateRating,
  ratingToStrength,
  getInitialRating,
  getCompetitionMultiplier,
  getGoalMultiplier,
  BASE_ELO,
  HOME_ADVANTAGE,
  K_FACTOR,
};
