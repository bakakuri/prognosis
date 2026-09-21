/**
 * PredictX — Frontend Utilities
 */

export function todayString() {
  return new Date().toISOString().split('T')[0];
}

export function formatProb(p) {
  if (p == null) return '—';
  return Math.round(p * 100) + '%';
}

export function formatGoal(g) {
  if (g == null) return '—';
  return parseFloat(g).toFixed(2);
}

export function formatRating(r) {
  if (r == null) return '—';
  return Math.round(r);
}

export function getOutcome(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'home';
  if (homeGoals < awayGoals) return 'away';
  return 'draw';
}

export function formatMatchResult(homeGoals, awayGoals, homeName) {
  const outcome = getOutcome(homeGoals, awayGoals);
  if (outcome === 'draw') return 'Draw';
  return outcome === 'home' ? `${homeName} Win` : 'Away Win';
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function formatElapsed(elapsed, status) {
  if (status === 'HT') return 'HT';
  if (elapsed) return `${elapsed}'`;
  return '';
}

export function confidenceLabel(c) {
  const map = { very_high: 'Very High', high: 'High', medium: 'Medium', low: 'Low', no_signal: 'No Signal' };
  return map[c] || c || '—';
}
