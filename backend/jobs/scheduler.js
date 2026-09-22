'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const logger = require('../utils/logger');

const jobs = new Map();
let isShuttingDown = false;

/**
 * Register and start a cron job
 */
function register(name, schedule, fn) {
  if (jobs.has(name)) {
    logger.warn(`Scheduler: job "${name}" already registered — skipping`);
    return;
  }

  if (!cron.validate(schedule)) {
    logger.error(`Scheduler: invalid cron schedule for "${name}": ${schedule}`);
    return;
  }

  const task = cron.schedule(schedule, async () => {
    if (isShuttingDown) return;
    const start = Date.now();
    logger.debug(`Scheduler: starting job "${name}"`);

    try {
      await fn();
      logger.info(`Scheduler: job "${name}" completed`, { durationMs: Date.now() - start });
    } catch (err) {
      logger.error(`Scheduler: job "${name}" failed`, {
        error: err.message,
        durationMs: Date.now() - start,
      });
    }
  }, {
    scheduled: false,
    timezone: 'UTC',
  });

  jobs.set(name, { task, schedule, name, lastRun: null, errors: 0 });
  logger.debug(`Scheduler: registered "${name}" (${schedule})`);
}

/**
 * Start all registered jobs
 */
function startAll() {
  for (const [name, job] of jobs) {
    job.task.start();
    logger.info(`Scheduler: started "${name}" (${job.schedule})`);
  }
}

/**
 * Stop all jobs gracefully
 */
function stopAll() {
  isShuttingDown = true;
  for (const [name, job] of jobs) {
    job.task.stop();
    logger.info(`Scheduler: stopped "${name}"`);
  }
}

/**
 * Run a job immediately (for testing / manual trigger)
 */
async function runNow(name) {
  const jobFns = {
    'fixtures-sync': () => require('./fixtures-sync').run(),
    'results-sync': () => require('./results-sync').run(),
    'live-sync': () => require('./live-sync').run(),
    'standings-sync': () => require('./standings-sync').run(),
    'teams-sync': () => require('./teams-sync').run(),
    'injuries-sync': () => require('./injuries-sync').run(),
    'predictions-sync': () => require('./predictions-sync').run(),
  };

  if (!jobFns[name]) throw new Error(`Unknown job: ${name}`);
  logger.info(`Scheduler: manually triggering "${name}"`);
  return jobFns[name]();
}

/**
 * Initialize all sync jobs
 */
async function init() {
  const fixturesSync = require('./fixtures-sync');
  const resultsSync = require('./results-sync');
  const liveSync = require('./live-sync');
  const standingsSync = require('./standings-sync');
  const teamsSync = require('./teams-sync');
  const injuriesSync = require('./injuries-sync');
  const predictionsSync = require('./predictions-sync');

  register('fixtures-sync', env.SYNC.FIXTURES, fixturesSync.run);
  register('results-sync', env.SYNC.RESULTS, resultsSync.run);
  register('live-sync', env.SYNC.LIVE, liveSync.run);
  register('standings-sync', env.SYNC.STANDINGS, standingsSync.run);
  register('teams-sync', env.SYNC.TEAMS, teamsSync.run);
  register('injuries-sync', env.SYNC.INJURIES, injuriesSync.run);
  register('predictions-sync', env.SYNC.PREDICTIONS, predictionsSync.run);

  startAll();

  // Run an initial fixtures sync at startup (with small delay)


  logger.info(`Scheduler: initialized ${jobs.size} jobs`);
}

function getStatus() {
  return Array.from(jobs.entries()).map(([name, job]) => ({
    name,
    schedule: job.schedule,
    lastRun: job.lastRun,
    errors: job.errors,
  }));
}

module.exports = { init, stopAll, runNow, getStatus, register };
