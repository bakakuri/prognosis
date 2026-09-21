'use strict';

const { round, safeDivide } = require('../../utils/helpers');

// Position importance weights (rough approximation)
const POSITION_IMPORTANCE = {
  G: 0.12,   // Goalkeeper
  D: 0.08,   // Defender
  M: 0.09,   // Midfielder
  F: 0.11,   // Forward
};

/**
 * Calculate squad strength from a lineup
 * Uses player ratings where available (e.g. from API-Football player stats)
 */
function calculateLineupStrength(lineup, playerRatings = {}) {
  if (!lineup || !lineup.startXI || lineup.startXI.length === 0) return null;

  const starters = lineup.startXI;
  let totalStrength = 0;
  let ratedPlayers = 0;

  for (const player of starters) {
    const rating = playerRatings[player.playerId];
    const posWeight = POSITION_IMPORTANCE[player.position] || 0.09;

    if (rating && rating > 0) {
      // Normalize rating (API-Football gives 1-10, we want 0-1)
      const normalizedRating = Math.min(1, Math.max(0, (rating - 5) / 5));
      totalStrength += normalizedRating * posWeight;
      ratedPlayers++;
    } else {
      // Use positional average if no individual rating
      totalStrength += 0.5 * posWeight; // Average player
    }
  }

  const totalPosWeight = starters.reduce((s, p) => s + (POSITION_IMPORTANCE[p.position] || 0.09), 0);

  return {
    strength: round(safeDivide(totalStrength, totalPosWeight), 4),
    formation: lineup.formation,
    isConfirmed: lineup.isConfirmed || false,
    playerCount: starters.length,
    ratedPlayerCount: ratedPlayers,
  };
}

/**
 * Calculate impact of lineups on match prediction
 * Returns impact scores for home/away teams (positive = strong, negative = weak)
 */
function calculateLineupImpact(homeLineup, awayLineup, playerRatings = {}) {
  if (!homeLineup && !awayLineup) return null;

  const homeStrength = homeLineup ? calculateLineupStrength(homeLineup, playerRatings) : null;
  const awayStrength = awayLineup ? calculateLineupStrength(awayLineup, playerRatings) : null;

  // Impact is relative to average (0.5 = average)
  const homeImpact = homeStrength ? homeStrength.strength - 0.5 : 0;
  const awayImpact = awayStrength ? awayStrength.strength - 0.5 : 0;

  return {
    homeImpact: round(homeImpact, 4),
    awayImpact: round(awayImpact, 4),
    homeStrength,
    awayStrength,
    bothConfirmed: !!(homeLineup?.isConfirmed && awayLineup?.isConfirmed),
    description: describeLineupSituation(homeStrength, awayStrength),
  };
}

function describeLineupSituation(homeStrength, awayStrength) {
  if (!homeStrength && !awayStrength) return 'no_lineup_data';
  if (!homeStrength) return 'home_lineup_unavailable';
  if (!awayStrength) return 'away_lineup_unavailable';
  if (!homeStrength.isConfirmed && !awayStrength.isConfirmed) return 'both_predicted';
  if (homeStrength.isConfirmed && awayStrength.isConfirmed) return 'both_confirmed';
  if (homeStrength.isConfirmed) return 'home_confirmed_away_predicted';
  return 'away_confirmed_home_predicted';
}

module.exports = { calculateLineupStrength, calculateLineupImpact };
