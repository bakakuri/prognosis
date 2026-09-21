'use strict';

const NodeCache = require('node-cache');
const env = require('../config/env');
const logger = require('../utils/logger');

// Primary cache store
const cache = new NodeCache({
  stdTTL: env.CACHE.TTL_MEDIUM,
  checkperiod: 120,
  useClones: false,
  deleteOnExpire: true,
});

cache.on('expired', (key) => {
  logger.debug('Cache expired', { key });
});

// Stats tracking
let stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
};

/**
 * Get a value from cache
 * Returns null if not found or expired
 */
function get(key) {
  const value = cache.get(key);
  if (value === undefined) {
    stats.misses++;
    return null;
  }
  stats.hits++;
  return value;
}

/**
 * Set a value in cache with optional TTL (seconds)
 */
function set(key, value, ttl = env.CACHE.TTL_MEDIUM) {
  stats.sets++;
  return cache.set(key, value, ttl);
}

/**
 * Delete a key from cache
 */
function del(key) {
  stats.deletes++;
  return cache.del(key);
}

/**
 * Delete all keys matching a pattern prefix
 */
function delByPrefix(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  if (keys.length > 0) {
    cache.del(keys);
    logger.debug('Cache: deleted keys by prefix', { prefix, count: keys.length });
  }
  return keys.length;
}

/**
 * Check if a key exists in cache
 */
function has(key) {
  return cache.has(key);
}

/**
 * Get or set pattern — fetch from cache or compute and cache
 */
async function getOrSet(key, fetchFn, ttl = env.CACHE.TTL_MEDIUM) {
  const cached = get(key);
  if (cached !== null) return cached;

  const value = await fetchFn();
  if (value !== null && value !== undefined) {
    set(key, value, ttl);
  }
  return value;
}

/**
 * Clear all cached entries
 */
function flush() {
  cache.flushAll();
  logger.info('Cache flushed');
}

/**
 * Get cache statistics
 */
function getStats() {
  const nodeStats = cache.getStats();
  const hitRate = stats.hits + stats.misses > 0
    ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)
    : '0.0';

  return {
    ...stats,
    hitRate: `${hitRate}%`,
    keys: nodeStats.keys,
    memoryUsage: process.memoryUsage().heapUsed,
  };
}

/**
 * Cache key builders
 */
const keys = {
  match: (id) => `match:${id}`,
  matchPrediction: (id) => `match:${id}:prediction`,
  liveMatches: () => 'matches:live',
  todayMatches: (date) => `matches:today:${date}`,
  upcomingMatches: (page) => `matches:upcoming:${page || 0}`,
  team: (id) => `team:${id}`,
  teamForm: (id, competitionId) => `team:${id}:form:${competitionId || 'all'}`,
  teamElo: (id) => `team:${id}:elo`,
  league: (id) => `league:${id}`,
  standings: (leagueId, season) => `standings:${leagueId}:${season}`,
  predictions: (date) => `predictions:${date}`,
  search: (query) => `search:${Buffer.from(query).toString('base64').slice(0, 32)}`,
  providerStatus: () => 'provider:status',
};

module.exports = { get, set, del, delByPrefix, has, getOrSet, flush, getStats, keys };
