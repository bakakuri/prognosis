'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const required = [
  'DATABASE_URL',
  'FOOTBALL_API_KEY',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[Config] Copy .env.example to .env and fill in your values');
  process.exit(1);
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5000',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV !== 'production',

  DB: {
    URL: process.env.DATABASE_URL,
    POOL_MAX: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    POOL_MIN: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    ACQUIRE_TIMEOUT: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT, 10) || 30000,
    IDLE_TIMEOUT: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 10000,
  },

  FOOTBALL_API: {
    KEY: process.env.FOOTBALL_API_KEY,
    HOST: process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io',
    BASE_URL: process.env.FOOTBALL_API_BASE_URL || 'https://v3.football.api-sports.io',
  },

  ODDS_API: {
    KEY: process.env.ODDS_API_KEY || null,
    URL: process.env.ODDS_API_URL || null,
  },

  CACHE: {
    TTL_SHORT: parseInt(process.env.CACHE_TTL_SHORT, 10) || 60,
    TTL_MEDIUM: parseInt(process.env.CACHE_TTL_MEDIUM, 10) || 300,
    TTL_LONG: parseInt(process.env.CACHE_TTL_LONG, 10) || 3600,
    TTL_VERY_LONG: parseInt(process.env.CACHE_TTL_VERY_LONG, 10) || 86400,
  },

  SYNC: {
    LIVE: process.env.SYNC_LIVE || '*/1 * * * *',
    FIXTURES: process.env.SYNC_FIXTURES || '0 */6 * * *',
    RESULTS: process.env.SYNC_RESULTS || '*/15 * * * *',
    STANDINGS: process.env.SYNC_STANDINGS || '0 */2 * * *',
    TEAMS: process.env.SYNC_TEAMS || '0 0 * * 0',
    PLAYERS: process.env.SYNC_PLAYERS || '0 1 * * 0',
    INJURIES: process.env.SYNC_INJURIES || '0 */4 * * *',
    LINEUPS: process.env.SYNC_LINEUPS || '0 */1 * * *',
    STATISTICS: process.env.SYNC_STATISTICS || '*/30 * * * *',
    PREDICTIONS: process.env.SYNC_PREDICTIONS || '*/5 * * * *',
  },

  PREDICTION: {
    MODEL_VERSION: process.env.MODEL_VERSION || 'predictx-1.0.0',
    ELO_K_FACTOR: parseFloat(process.env.ELO_K_FACTOR) || 32,
    ELO_HOME_ADVANTAGE: parseFloat(process.env.ELO_HOME_ADVANTAGE) || 100,
    FORM_MATCH_WINDOW: parseInt(process.env.FORM_MATCH_WINDOW, 10) || 10,
    FORM_DECAY_FACTOR: parseFloat(process.env.FORM_DECAY_FACTOR) || 0.85,
    MIN_MATCHES_FOR_PREDICTION: parseInt(process.env.MIN_MATCHES_FOR_PREDICTION, 10) || 5,
    ENSEMBLE_WEIGHTS: {
      elo: parseFloat(process.env.ENSEMBLE_ELO_WEIGHT) || 0.20,
      poisson: parseFloat(process.env.ENSEMBLE_POISSON_WEIGHT) || 0.25,
      dixonColes: parseFloat(process.env.ENSEMBLE_DC_WEIGHT) || 0.20,
      form: parseFloat(process.env.ENSEMBLE_FORM_WEIGHT) || 0.20,
      xg: parseFloat(process.env.ENSEMBLE_XG_WEIGHT) || 0.15,
    },
  },

  SECURITY: {
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5000').split(',').map(s => s.trim()),
  },

  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FILE: process.env.LOG_FILE || 'logs/predictx.log',
  },
};
