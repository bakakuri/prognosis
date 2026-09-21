'use strict';

const env = require('../../config/env');
const { decayWeight, weightedAverage, safeDivide, round } = require('../../utils/helpers');

const MATCH_WINDOW = env.PREDICTION.FORM_MATCH_WINDOW;
const DECAY_FACTOR = env.PREDICTION.FORM_DECAY_FACTOR;

/**
 * Calculate the outcome of a match from a team's perspective
 * Returns: 'win', 'draw', 'loss'
 */
function getOutcome(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 'win';
  if (goalsFor === goalsAgainst) return 'draw';
  return 'loss';
}

/**
 * Calculate form score for a single match (NOT just 3/1/0)
 * Uses a multi-factor approach:
 * - Result points (win=1, draw=0.4, loss=0)
 * - Goal difference component
 * - Clean sheet bonus
 * - xG performance if available
 * - Opponent strength adjustment
 */
function matchFormScore(match, teamId, teamEloRatings) {
  const isHome = match.homeTeamId === teamId;
  const goalsFor = isHome ? (match.homeGoals || 0) : (match.awayGoals || 0);
  const goalsAgainst = isHome ? (match.awayGoals || 0) : (match.homeGoals || 0);
  const opponentId = isHome ? match.awayTeamId : match.homeTeamId;

  const outcome = getOutcome(goalsFor, goalsAgainst);

  // Base result score
  let score = 0;
  if (outcome === 'win') score = 1.0;
  else if (outcome === 'draw') score = 0.4;
  else score = 0.0;

  // Goal difference bonus/penalty (capped)
  const gd = goalsFor - goalsAgainst;
  score += Math.max(-0.3, Math.min(0.3, gd * 0.1));

  // xG component (if available) — did the team deserve their result?
  const xgFor = isHome ? match.homeXG : match.awayXG;
  const xgAgainst = isHome ? match.awayXG : match.homeXG;
  if (xgFor !== null && xgFor !== undefined && xgAgainst !== null && xgAgainst !== undefined) {
    const xgDiff = xgFor - xgAgainst;
    score += Math.max(-0.15, Math.min(0.15, xgDiff * 0.05));
  }

  // Clean sheet bonus
  if (goalsAgainst === 0) score += 0.1;

  // Opponent strength adjustment
  // Beating strong teams is worth more; losing to weak teams is penalized more
  if (teamEloRatings && opponentId) {
    const opponentElo = teamEloRatings[opponentId] || 1500;
    const teamElo = teamEloRatings[teamId] || 1500;
    const strengthRatio = safeDivide(opponentElo, teamElo);

    if (outcome === 'win' && strengthRatio > 1.1) {
      score += 0.15; // Beat a stronger team
    } else if (outcome === 'loss' && strengthRatio < 0.9) {
      score -= 0.15; // Lost to a weaker team
    }
  }

  return Math.max(0, Math.min(1.5, score));
}

/**
 * Calculate overall form from recent matches
 * Returns a form object with weighted scores and statistics
 */
function calculateForm(matches, teamId, teamEloRatings = {}) {
  if (!matches || matches.length === 0) {
    return null;
  }

  const recentMatches = matches
    .filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MATCH_WINDOW);

  if (recentMatches.length < 2) {
    return null;
  }

  const weights = recentMatches.map((_, i) => decayWeight(i, DECAY_FACTOR));
  const scores = recentMatches.map(m => matchFormScore(m, teamId, teamEloRatings));

  const weightedScore = weightedAverage(scores, weights);

  // Statistics
  let wins = 0, draws = 0, losses = 0;
  let goalsFor = 0, goalsAgainst = 0;
  let xgFor = 0, xgAgainst = 0;
  let xgMatchCount = 0;

  for (const match of recentMatches) {
    const isHome = match.homeTeamId === teamId;
    const gf = isHome ? (match.homeGoals || 0) : (match.awayGoals || 0);
    const ga = isHome ? (match.awayGoals || 0) : (match.homeGoals || 0);
    const outcome = getOutcome(gf, ga);

    if (outcome === 'win') wins++;
    else if (outcome === 'draw') draws++;
    else losses++;

    goalsFor += gf;
    goalsAgainst += ga;

    const xgF = isHome ? match.homeXG : match.awayXG;
    const xgA = isHome ? match.awayXG : match.homeXG;
    if (xgF !== null && xgF !== undefined) {
      xgFor += xgF;
      xgAgainst += xgA;
      xgMatchCount++;
    }
  }

  const n = recentMatches.length;

  return {
    score: round(weightedScore, 4),
    // Normalized 0-1 (was scoring 0-1.5)
    normalizedScore: round(Math.min(1, weightedScore / 1.2), 4),
    matches: n,
    wins,
    draws,
    losses,
    winRate: round(safeDivide(wins, n), 4),
    drawRate: round(safeDivide(draws, n), 4),
    lossRate: round(safeDivide(losses, n), 4),
    avgGoalsFor: round(safeDivide(goalsFor, n), 4),
    avgGoalsAgainst: round(safeDivide(goalsAgainst, n), 4),
    avgXGFor: xgMatchCount > 0 ? round(safeDivide(xgFor, xgMatchCount), 4) : null,
    avgXGAgainst: xgMatchCount > 0 ? round(safeDivide(xgAgainst, xgMatchCount), 4) : null,
    // Recent 5-match form string: e.g. "WDWLW"
    formString: recentMatches.slice(0, 5).map(m => {
      const isHome = m.homeTeamId === teamId;
      const gf = isHome ? (m.homeGoals || 0) : (m.awayGoals || 0);
      const ga = isHome ? (m.awayGoals || 0) : (m.homeGoals || 0);
      const out = getOutcome(gf, ga);
      return out === 'win' ? 'W' : out === 'draw' ? 'D' : 'L';
    }).join(''),
  };
}

/**
 * Calculate separate home and away form
 */
function calculateHomeAwayForm(matches, teamId, teamEloRatings = {}) {
  if (!matches || matches.length === 0) return { home: null, away: null };

  const homeMatches = matches.filter(m => m.homeTeamId === teamId);
  const awayMatches = matches.filter(m => m.awayTeamId === teamId);

  return {
    home: calculateForm(homeMatches, teamId, teamEloRatings),
    away: calculateForm(awayMatches, teamId, teamEloRatings),
  };
}

/**
 * Convert form scores to a 1X2 probability adjustment
 * Returns a small delta that can be added to base prediction
 */
function formToProbabilityAdjustment(homeForm, awayForm) {
  if (!homeForm || !awayForm) return null;

  const homeScore = homeForm.normalizedScore || 0.5;
  const awayScore = awayForm.normalizedScore || 0.5;
  const formDiff = homeScore - awayScore;

  // Maximum form adjustment: ±8% to 1X2 probabilities
  const maxAdjustment = 0.08;
  const homeAdj = Math.max(-maxAdjustment, Math.min(maxAdjustment, formDiff * 0.2));
  const awayAdj = -homeAdj;
  const drawAdj = -Math.abs(homeAdj) * 0.3;

  return {
    home: round(homeAdj, 4),
    draw: round(drawAdj, 4),
    away: round(awayAdj, 4),
    homeFormScore: homeScore,
    awayFormScore: awayScore,
  };
}

/**
 * Predict 1X2 probabilities based on form only
 * For use as an ensemble component
 */
function predict({ homeMatches, awayMatches, homeTeamId, awayTeamId, teamEloRatings }) {
  const homeForm = calculateForm(homeMatches, homeTeamId, teamEloRatings);
  const awayForm = calculateForm(awayMatches, awayTeamId, teamEloRatings);

  if (!homeForm || !awayForm) return null;

  const homeScore = homeForm.normalizedScore;
  const awayScore = awayForm.normalizedScore;
  const total = homeScore + awayScore;

  if (total === 0) return null;

  // Raw form-based probabilities
  const homeRaw = safeDivide(homeScore, total);
  const awayRaw = safeDivide(awayScore, total);

  // Draw allocation based on score similarity
  const scoreSimilarity = 1 - Math.abs(homeScore - awayScore);
  const drawProb = 0.20 + scoreSimilarity * 0.08;

  const home = homeRaw * (1 - drawProb);
  const away = awayRaw * (1 - drawProb);
  const normTotal = home + drawProb + away;

  return {
    home: round(safeDivide(home, normTotal), 4),
    draw: round(safeDivide(drawProb, normTotal), 4),
    away: round(safeDivide(away, normTotal), 4),
    homeForm,
    awayForm,
  };
}

module.exports = {
  calculateForm,
  calculateHomeAwayForm,
  formToProbabilityAdjustment,
  matchFormScore,
  getOutcome,
  predict,
};
