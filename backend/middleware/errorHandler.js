'use strict';

const logger = require('../utils/logger');

/**
 * 404 handler — must be placed after all routes
 */
function notFound(req, res, next) {
  const error = new Error(`Not Found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

/**
 * Global error handler — must be placed last
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Log the error
  if (statusCode >= 500) {
    logger.error('Server error', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn('Client error', {
      message: err.message,
      statusCode,
      url: req.originalUrl,
      method: req.method,
    });
  }

  const response = {
    error: {
      message: statusCode < 500 ? err.message : 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    },
  };

  if (!isProduction && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Async error wrapper — eliminates try/catch in route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a typed application error
 */
function createError(message, statusCode = 500, code = 'ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

module.exports = { notFound, errorHandler, asyncHandler, createError };
