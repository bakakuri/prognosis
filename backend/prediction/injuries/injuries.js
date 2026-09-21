'use strict';

const { round, safeDivide } = require('../../utils/helpers');

// How much a player's absence affects the team (by position)
const POSITION_IMPACT = {
  Goalkeeper: 0.10,
  Defender: 0.06,
  Midfielder: 0.07,
  Forward: 0.09,
  Attacker: 0.09,
};

// Reduction based on injury type
const INJURY_SEVERITY = {
  'Knee Injury': 1.0,
  'Muscle Injury': 0.85,
  'Hamstring Injury': 0.9,
  'Ankle Injury': 0.8,
  'Back Injury': 0.75,
  'Foot Injury': 0.8,
  'Thigh Injury': 0.85,
  'Unknown': 0.7,
  default: 0.7,
};

function getSeverityMultiplier(injuryType) {
  for (const [type, mult] of Object.entries(INJURY_SEVERITY)) {
    if (injuryType && injuryType.toLowerCase().includes(type.toLowerCase())) {
      return mult;
    }
  }
  return INJURY_SEVERITY.default;
}

/**
 * Calculate the cumulative impact of team injuries/suspensions
 * Returns a negative value (0 = no impact, -1 = maximum possible impact)
 */
function calculateInjuryImpact(injuries, playerRatings = {}) {
  if (!injuries || injuries.length === 0) return 0;

  let totalImpact = 0;

  for (const injury of injuries) {
    const positionImpact = POSITION_IMPACT[injury.position] || 0.06;
    const severityMultiplier = getSeverityMultiplier(injury.type);

    // Adjust by player rating if available
    const playerRating = playerRatings[injury.playerId];
    const ratingMultiplier = playerRating
      ? Math.min(2.0, Math.max(0.5, playerRating / 7.0)) // Normalize from 1-10 to multiplier
      : 1.0;

    const playerImpact = positionImpact * severityMultiplier * ratingMultiplier;
    totalImpact += playerImpact;
  }

  // Cap total impact at 0.4 (can't lose more than 40% of team strength)
  return round(Math.min(0.4, totalImpact) * -1, 4); // Negative = team weakened
}

/**
 * Calculate injury impact for both teams in a match
 */
function calculateMatchInjuryImpact(homeInjuries, awayInjuries, playerRatings = {}) {
  if ((!homeInjuries || homeInjuries.length === 0) &&
      (!awayInjuries || awayInjuries.length === 0)) {
    return null;
  }

  const homeImpact = calculateInjuryImpact(homeInjuries || [], playerRatings);
  const awayImpact = calculateInjuryImpact(awayInjuries || [], playerRatings);

  return {
    homeImpact,   // Negative = home weakened
    awayImpact,   // Negative = away weakened
    homeCount: (homeInjuries || []).length,
    awayCount: (awayInjuries || []).length,
    homeInjuries: (homeInjuries || []).map(i => ({
      playerName: i.playerName,
      type: i.type,
      position: i.position,
    })),
    awayInjuries: (awayInjuries || []).map(i => ({
      playerName: i.playerName,
      type: i.type,
      position: i.position,
    })),
    dataAvailable: true,
  };
}

module.exports = { calculateInjuryImpact, calculateMatchInjuryImpact };
