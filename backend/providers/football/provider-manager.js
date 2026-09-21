'use strict';

const apiFootball = require('./api-football');
const logger = require('../../utils/logger');

/**
 * PredictX Provider Manager
 *
 * Routes football data requests to the active provider.
 * Supports adding secondary providers as fallback.
 * Switch providers without rewriting any other code.
 */
class ProviderManager {
  constructor() {
    this.providers = [apiFootball]; // Primary first, then fallbacks
    this.primary = apiFootball;
    this.providerStatus = {};
  }

  /**
   * Register an additional provider (fallback)
   */
  register(provider) {
    this.providers.push(provider);
    logger.info(`Provider registered: ${provider.name}`);
  }

  /**
   * Set the primary provider by ID
   */
  setPrimary(providerId) {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);
    this.primary = provider;
    logger.info(`Primary provider set to: ${provider.name}`);
  }

  /**
   * Execute a method with fallback chain
   */
  async execute(method, ...args) {
    for (const provider of this.providers) {
      try {
        const result = await provider[method](...args);
        return result;
      } catch (err) {
        logger.warn(`Provider ${provider.name} failed for ${method}`, {
          error: err.message,
        });
        this.providerStatus[provider.id] = { error: err.message, time: new Date() };

        if (provider === this.providers[this.providers.length - 1]) {
          throw new Error(`All providers failed for ${method}: ${err.message}`);
        }
      }
    }
  }

  // Delegated methods
  getStatus() { return this.primary.getStatus(); }
  getFixtures(options) { return this.execute('getFixtures', options); }
  getLiveFixtures(leagueIds) { return this.execute('getLiveFixtures', leagueIds); }
  getFixtureById(id) { return this.execute('getFixtureById', id); }
  getFixtureStatistics(id) { return this.execute('getFixtureStatistics', id); }
  getFixtureEvents(id) { return this.execute('getFixtureEvents', id); }
  getFixtureLineups(id) { return this.execute('getFixtureLineups', id); }
  getH2H(t1, t2, last) { return this.execute('getH2H', t1, t2, last); }
  getLeagues(options) { return this.execute('getLeagues', options); }
  getStandings(leagueId, season) { return this.execute('getStandings', leagueId, season); }
  getTeam(id) { return this.execute('getTeam', id); }
  getTeamsByLeague(leagueId, season) { return this.execute('getTeamsByLeague', leagueId, season); }
  getTeamStatistics(teamId, leagueId, season) { return this.execute('getTeamStatistics', teamId, leagueId, season); }
  getPlayers(options) { return this.execute('getPlayers', options); }
  getInjuries(options) { return this.execute('getInjuries', options); }
  getOdds(options) { return this.execute('getOdds', options); }

  getProviderHealth() {
    return {
      primary: this.primary.id,
      providers: this.providers.map(p => ({
        id: p.id,
        name: p.name,
        status: this.providerStatus[p.id] || { error: null },
      })),
    };
  }
}

module.exports = new ProviderManager();
