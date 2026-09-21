'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: env.DB.URL,
  max: env.DB.POOL_MAX,
  min: env.DB.POOL_MIN,
  acquireTimeoutMillis: env.DB.ACQUIRE_TIMEOUT,
  idleTimeoutMillis: env.DB.IDLE_TIMEOUT,
  ssl: env.IS_PRODUCTION ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.debug('Database: new connection established');
});

pool.on('error', (err) => {
  logger.error('Database: unexpected error on idle client', { error: err.message });
});

/**
 * Execute a single query with optional parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    return result;
  } catch (err) {
    logger.error('Database query error', {
      query: text.substring(0, 200),
      error: err.message,
      params,
    });
    throw err;
  }
}

/**
 * Get a client from the pool for transactions
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  // Override release to log long-held clients
  const timeout = setTimeout(() => {
    logger.warn('Database: client checked out for more than 5 seconds');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    return release();
  };

  return client;
}

/**
 * Execute a transaction
 */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Test the database connection
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    logger.info('Database connection successful', {
      time: result.rows[0].time,
      postgres: result.rows[0].version.split(' ').slice(0, 2).join(' '),
    });
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    return false;
  }
}

/**
 * Close all pool connections (for graceful shutdown)
 */
async function close() {
  await pool.end();
  logger.info('Database: connection pool closed');
}

module.exports = { pool, query, getClient, transaction, testConnection, close };
