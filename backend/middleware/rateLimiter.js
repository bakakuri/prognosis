'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const defaultLimiter = rateLimit({
  windowMs: env.SECURITY.RATE_LIMIT_WINDOW_MS,
  max: env.SECURITY.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests — please wait before trying again',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

// Stricter limit for search
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: {
      message: 'Search rate limit exceeded',
      code: 'SEARCH_RATE_LIMIT',
    },
  },
});

// Admin panel
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: {
      message: 'Admin rate limit exceeded',
      code: 'ADMIN_RATE_LIMIT',
    },
  },
});

module.exports = { defaultLimiter, searchLimiter, adminLimiter };
