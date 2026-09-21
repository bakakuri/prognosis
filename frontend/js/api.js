/**
 * PredictX — API Client
 * Communicates with the PredictX backend REST API
 */

const BASE_URL = window.location.port === '5000'
  ? 'http://localhost:3000/api'   // Dev: different ports
  : '/api';                        // Prod: same origin

const cache = new Map();
const CACHE_TTL = {
  live: 30 * 1000,       // 30 seconds
  matches: 120 * 1000,   // 2 minutes
  predictions: 180 * 1000, // 3 minutes
  teams: 300 * 1000,     // 5 minutes
  leagues: 600 * 1000,   // 10 minutes
};

async function request(endpoint, options = {}) {
  const cacheKey = endpoint + JSON.stringify(options.params || {});
  const ttl = options.cache || 0;

  if (ttl > 0 && cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < ttl) return data;
  }

  const url = new URL(BASE_URL + endpoint);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const response = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();

  if (ttl > 0) {
    cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

// ─── Matches ─────────────────────────────────────────────
export const matchesAPI = {
  getToday: () => request('/matches/today', { cache: CACHE_TTL.matches }),
  getUpcoming: (days = 3) => request('/matches/upcoming', { params: { days }, cache: CACHE_TTL.matches }),
  getLive: () => request('/matches/live', { cache: CACHE_TTL.live }),
  getAll: (params = {}) => request('/matches', { params, cache: CACHE_TTL.matches }),
  getById: (id) => request(`/matches/${id}`, { cache: 60 * 1000 }),
};

// ─── Predictions ──────────────────────────────────────────
export const predictionsAPI = {
  getByDate: (date, params = {}) => request('/predictions', { params: { date, ...params }, cache: CACHE_TTL.predictions }),
  getAccuracy: () => request('/predictions/accuracy', { cache: 300 * 1000 }),
};

// ─── Live ─────────────────────────────────────────────────
export const liveAPI = {
  getAll: () => request('/live', { cache: CACHE_TTL.live }),
  getById: (id) => request(`/live/${id}`, { cache: CACHE_TTL.live }),
};

// ─── Teams ────────────────────────────────────────────────
export const teamsAPI = {
  getAll: (params = {}) => request('/teams', { params, cache: CACHE_TTL.teams }),
  getById: (id) => request(`/teams/${id}`, { cache: CACHE_TTL.teams }),
};

// ─── Leagues ──────────────────────────────────────────────
export const leaguesAPI = {
  getAll: () => request('/leagues', { cache: CACHE_TTL.leagues }),
  getById: (id) => request(`/leagues/${id}`, { cache: CACHE_TTL.teams }),
};

// ─── Search ───────────────────────────────────────────────
export const searchAPI = {
  search: (q) => request('/search', { params: { q }, cache: 30 * 1000 }),
};

// ─── Admin ────────────────────────────────────────────────
export const adminAPI = {
  getStatus: () => request('/admin/status'),
  runSync: (job) => fetch(`${BASE_URL}/admin/sync/${job}`, { method: 'POST' }).then(r => r.json()),
  flushCache: () => fetch(`${BASE_URL}/admin/cache/flush`, { method: 'POST' }).then(r => r.json()),
};

// ─── Health ───────────────────────────────────────────────
export const healthAPI = {
  check: () => request('/health'),
};

// ─── Helpers ──────────────────────────────────────────────
export function clearCache() { cache.clear(); }
