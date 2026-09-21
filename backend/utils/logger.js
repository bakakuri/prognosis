'use strict';

const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');
const env = require('../config/env');

// Ensure logs directory exists
const logsDir = path.dirname(path.join(process.cwd(), env.LOG.FILE));
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

const logger = createLogger({
  level: env.LOG.LEVEL,
  format: logFormat,
  defaultMeta: { service: 'predictx' },
  transports: [
    new transports.File({
      filename: path.join(process.cwd(), env.LOG.FILE),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    new transports.File({
      filename: path.join(process.cwd(), 'logs/error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

if (env.IS_DEVELOPMENT) {
  logger.add(new transports.Console({ format: consoleFormat }));
}

module.exports = logger;
