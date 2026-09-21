'use strict';

/**
 * PredictX Football Provider Interface
 *
 * Any football data provider must implement these methods.
 * Missing methods should throw NotImplementedError.
 * If a provider doesn't support a field, return null (never fabricate).
 */

class NotImplementedError extends Error {
  constructor(methodName) {
    super(`Provider method not implemented: ${methodName}`);
    this.code = 'NOT_IMPLEMENTED';
  }
}

class ProviderInterface {
  get id() { throw new NotImplementedError('id'); }
  get name() { throw new NotImplementedError('name'); }

  async getStatus() { throw new NotImplementedError('getStatus'); }
  async getFixtures(options) { throw new NotImplementedError('getFixtures'); } // eslint-disable-line
  async getLiveFixtures(leagueIds) { throw new NotImplementedError('getLiveFixtures'); } // eslint-disable-line
  async getFixtureById(fixtureId) { throw new NotImplementedError('getFixtureById'); } // eslint-disable-line
  async getFixtureStatistics(fixtureId) { throw new NotImplementedError('getFixtureStatistics'); } // eslint-disable-line
  async getFixtureEvents(fixtureId) { throw new NotImplementedError('getFixtureEvents'); } // eslint-disable-line
  async getFixtureLineups(fixtureId) { throw new NotImplementedError('getFixtureLineups'); } // eslint-disable-line
  async getH2H(team1Id, team2Id, last) { throw new NotImplementedError('getH2H'); } // eslint-disable-line
  async getLeagues(options) { throw new NotImplementedError('getLeagues'); } // eslint-disable-line
  async getStandings(leagueId, season) { throw new NotImplementedError('getStandings'); } // eslint-disable-line
  async getTeam(teamId) { throw new NotImplementedError('getTeam'); } // eslint-disable-line
  async getTeamsByLeague(leagueId, season) { throw new NotImplementedError('getTeamsByLeague'); } // eslint-disable-line
  async getTeamStatistics(teamId, leagueId, season) { throw new NotImplementedError('getTeamStatistics'); } // eslint-disable-line
  async getPlayers(options) { throw new NotImplementedError('getPlayers'); } // eslint-disable-line
  async getInjuries(options) { throw new NotImplementedError('getInjuries'); } // eslint-disable-line
  async getOdds(options) { throw new NotImplementedError('getOdds'); } // eslint-disable-line
}

module.exports = { ProviderInterface, NotImplementedError };
