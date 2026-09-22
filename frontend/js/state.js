/**
 * PredictX — State Management
 * Simple reactive store with subscriber pattern
 */

const state = {
  liveCount: 0,
  favorites: loadFavorites(),
  currentRoute: null,
  isOnline: navigator.onLine,
  liveMatches: [],
};

const subscribers = new Map();

function get(key) {
  return state[key];
}

function set(key, value) {
  const prev = state[key];
  state[key] = value;
  if (prev !== value) {
    notify(key, value, prev);
  }
}

function subscribe(key, fn) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(fn);
  return () => subscribers.get(key)?.delete(fn);
}

function notify(key, value, prev) {
  subscribers.get(key)?.forEach(fn => fn(value, prev));
}

// ─── Favorites (localStorage) ─────────────────────────────
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('px_favorites') || '{"teams":[],"leagues":[],"matches":[]}');
  } catch {
    return { teams: [], leagues: [], matches: [] };
  }
}

function saveFavorites() {
  try {
    localStorage.setItem('px_favorites', JSON.stringify(state.favorites));
  } catch { /* storage full */ }
}

export const favorites = {
  isTeam: (id) => state.favorites.teams.includes(id),
  isLeague: (id) => state.favorites.leagues.includes(id),
  isMatch: (id) => state.favorites.matches.includes(id),

  toggleTeam(id) {
    const idx = state.favorites.teams.indexOf(id);
    if (idx === -1) state.favorites.teams.push(id);
    else state.favorites.teams.splice(idx, 1);
    saveFavorites();
    set('favorites', { ...state.favorites });
  },

  toggleLeague(id) {
    const idx = state.favorites.leagues.indexOf(id);
    if (idx === -1) state.favorites.leagues.push(id);
    else state.favorites.leagues.splice(idx, 1);
    saveFavorites();
    set('favorites', { ...state.favorites });
  },

  getAll() { return state.favorites; },
};

// ─── Online/Offline ───────────────────────────────────────
window.addEventListener('online', () => {
  set('isOnline', true);
  document.getElementById('offline-banner')?.setAttribute('hidden', '');
});
window.addEventListener('offline', () => {
  set('isOnline', false);
  document.getElementById('offline-banner')?.removeAttribute('hidden');
});

// Initial offline check
if (!navigator.onLine) {
  document.getElementById('offline-banner')?.removeAttribute('hidden');
}

export const store = { get, set, subscribe };
export default store;
