'use strict';

const axios = require('axios');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { sleep, retry } = require('../../utils/helpers');

const BASE_URL = env.FOOTBALL_API.BASE_URL;
const API_KEY = env.FOOTBALL_API.KEY;

// Track API usage (free tier: 100 requests/day)
let requestCount = 0;
let requestResetDate = new Date().toDateString();

function trackRequest() {
  const today = new Date().toDateString();
  if (today !== requestResetDate) {
    requestCount = 0;
    requestResetDate = today;
  }
  requestCount++;
  logger.debug(`API-Football: request #${requestCount}/day`);
}

/**
 * Core API request with retry and rate limit handling
 */
async function apiRequest(endpoint, params = {}) {
  trackRequest();

  return retry(async () => {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
'x-apisports-host': env.FOOTBALL_API.HOST,
'x-apisports-key': API_KEY,
      },
      params,
      timeout: 15000,
    });

    if (response.data.errors && Object.keys(response.data.errors).length > 0) {
      const errMsg = Object.values(response.data.errors).join(', ');
      throw new Error(`API-Football error: ${errMsg}`);
    }

    return response.data;
  }, { maxAttempts: 3, baseDelay: 2000 });
}

// ============================================================
// PROVIDER INFORMATION
// ============================================================

const provider = {
  id: 'api-football',
  name: 'API-Football',
  version: 'v3',

  async getStatus() {
    try {
      const data = await apiRequest('/status');
      return {
        available: true,
        requestsToday: data.response?.requests?.current || requestCount,
        requestsLimit: data.response?.requests?.limit_day || 100,
        plan: data.response?.subscription?.plan || 'Free',
      };
    } catch (err) {
      return { available: false, error: err.message };
    }
  },

  // ============================================================
  // FIXTURES
  // ============================================================

  async getFixtures({ date, season, leagueId, teamId, status, from, to, timezone = 'UTC' } = {}) {
    const params = { timezone };
    if (date) params.date = date;
    if (season) params.season = season;
    if (leagueId) params.league = leagueId;
    if (teamId) params.team = teamId;
    if (status) params.status = status;
    if (from) params.from = from;
    if (to) params.to = to;

    const data = await apiRequest('/fixtures', params);
    return (data.response || []).map(normalizeFixture);
  },

  async getLiveFixtures(leagueIds = []) {
    const params = { live: 'all' };
    if (leagueIds.length > 0) {
      params.live = leagueIds.join('-');
    }
    const data = await apiRequest('/fixtures', params);
    return (data.response || []).map(normalizeFixture);
  },

  async getFixtureById(fixtureId) {
    const data = await apiRequest('/fixtures', { id: fixtureId });
    const fixtures = data.response || [];
    return fixtures.length > 0 ? normalizeFixture(fixtures[0]) : null;
  },

  // ============================================================
  // FIXTURE STATISTICS
  // ============================================================

  async getFixtureStatistics(fixtureId) {
    const data = await apiRequest('/fixtures/statistics', { fixture: fixtureId });
    return normalizeStatistics(fixtureId, data.response || []);
  },

  async getFixtureEvents(fixtureId) {
    const data = await apiRequest('/fixtures/events', { fixture: fixtureId });
    return (data.response || []).map(e => normalizeEvent(fixtureId, e));
  },

  async getFixtureLineups(fixtureId) {
    const data = await apiRequest('/fixtures/lineups', { fixture: fixtureId });
    return (data.response || []).map(l => normalizeLineup(fixtureId, l));
  },

  async getFixturePlayerStats(fixtureId) {
    const data = await apiRequest('/fixtures/players', { fixture: fixtureId });
    return data.response || [];
  },

  // ============================================================
  // HEAD-TO-HEAD
  // ============================================================

  async getH2H(team1Id, team2Id, last = 10) {
    const data = await apiRequest('/fixtures/headtohead', {
      h2h: `${team1Id}-${team2Id}`,
      last,
    });
    return (data.response || []).map(normalizeFixture);
  },

  // ============================================================
  // LEAGUES
  // ============================================================

  async getLeagues({ id, season, country, current = true } = {}) {
    const params = {};
    if (id) params.id = id;
    if (season) params.season = season;
    if (country) params.country = country;
    if (current) params.current = 'true';

    const data = await apiRequest('/leagues', params);
    return (data.response || []).map(normalizeLeague);
  },

  async getStandings(leagueId, season) {
    const data = await apiRequest('/standings', {
      league: leagueId,
      season,
    });
    const standings = data.response?.[0]?.league?.standings || [];
    return standings.map(group => group.map(normalizeStanding));
  },

  // ============================================================
  // TEAMS
  // ============================================================

  async getTeam(teamId) {
    const data = await apiRequest('/teams', { id: teamId });
    const teams = data.response || [];
    return teams.length > 0 ? normalizeTeam(teams[0]) : null;
  },

  async getTeamsByLeague(leagueId, season) {
    const data = await apiRequest('/teams', { league: leagueId, season });
    return (data.response || []).map(normalizeTeam);
  },

  async getTeamStatistics(teamId, leagueId, season) {
    const data = await apiRequest('/teams/statistics', {
      team: teamId,
      league: leagueId,
      season,
    });
    return normalizeTeamStats(teamId, leagueId, season, data.response);
  },

  // ============================================================
  // PLAYERS
  // ============================================================

  async getPlayers({ teamId, leagueId, season, page = 1 } = {}) {
    const params = { page };
    if (teamId) params.team = teamId;
    if (leagueId) params.league = leagueId;
    if (season) params.season = season;

    const data = await apiRequest('/players', params);
    return {
      players: (data.response || []).map(normalizePlayer),
      pagination: data.paging || { current: 1, total: 1 },
    };
  },

  async getPlayerById(playerId, season) {
    const params = { id: playerId };
    if (season) params.season = season;
    const data = await apiRequest('/players', params);
    const players = data.response || [];
    return players.length > 0 ? normalizePlayer(players[0]) : null;
  },

  // ============================================================
  // INJURIES
  // ============================================================

  async getInjuries({ leagueId, season, teamId, fixtureId } = {}) {
    const params = {};
    if (leagueId) params.league = leagueId;
    if (season) params.season = season;
    if (teamId) params.team = teamId;
    if (fixtureId) params.fixture = fixtureId;

    const data = await apiRequest('/injuries', params);
    return (data.response || []).map(normalizeInjury);
  },

  // ============================================================
  // ODDS (if available on plan)
  // ============================================================

  async getOdds({ fixtureId, leagueId, season, bookmaker = 8, bet = 1 } = {}) {
    const params = { bookmaker, bet };
    if (fixtureId) params.fixture = fixtureId;
    if (leagueId) params.league = leagueId;
    if (season) params.season = season;

    try {
      const data = await apiRequest('/odds', params);
      return (data.response || []).map(normalizeOdds);
    } catch (err) {
      logger.warn('Odds not available (may require paid plan)', { error: err.message });
      return [];
    }
  },

  getRequestCount() {
    return requestCount;
  },
};

// ============================================================
// NORMALIZERS — map API-Football shapes to our internal format
// ============================================================

function normalizeFixture(f) {
  return {
    providerId: String(f.fixture.id),
    providerName: 'api-football',
    date: f.fixture.date,
    timezone: f.fixture.timezone,
    status: {
      code: f.fixture.status.short,
      long: f.fixture.status.long,
      elapsed: f.fixture.status.elapsed,
    },
    venue: f.fixture.venue
      ? { name: f.fixture.venue.name, city: f.fixture.venue.city }
      : null,
    league: {
      providerId: String(f.league.id),
      name: f.league.name,
      country: f.league.country,
      logo: f.league.logo,
      season: f.league.season,
      round: f.league.round,
    },
    homeTeam: {
      providerId: String(f.teams.home.id),
      name: f.teams.home.name,
      logo: f.teams.home.logo,
      winner: f.teams.home.winner,
    },
    awayTeam: {
      providerId: String(f.teams.away.id),
      name: f.teams.away.name,
      logo: f.teams.away.logo,
      winner: f.teams.away.winner,
    },
    score: {
      home: f.goals.home,
      away: f.goals.away,
      halftime: {
        home: f.score.halftime.home,
        away: f.score.halftime.away,
      },
      fulltime: {
        home: f.score.fulltime.home,
        away: f.score.fulltime.away,
      },
      extratime: {
        home: f.score.extratime.home,
        away: f.score.extratime.away,
      },
      penalty: {
        home: f.score.penalty.home,
        away: f.score.penalty.away,
      },
    },
  };
}

function normalizeStatistics(fixtureId, statsArray) {
  const result = { fixtureId: String(fixtureId) };

  for (const teamStats of statsArray) {
    const side = teamStats.team.id === statsArray[0]?.team.id ? 'home' : 'away';
    const stats = {};

    for (const stat of teamStats.statistics) {
      const key = stat.type
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      stats[key] = stat.value;
    }
    result[side] = { teamId: String(teamStats.team.id), ...stats };
  }

  return result;
}

function normalizeEvent(fixtureId, event) {
  return {
    fixtureId: String(fixtureId),
    time: event.time.elapsed,
    extraTime: event.time.extra,
    teamId: String(event.team.id),
    playerId: event.player.id ? String(event.player.id) : null,
    playerName: event.player.name,
    assistId: event.assist?.id ? String(event.assist.id) : null,
    assistName: event.assist?.name || null,
    type: event.type,
    detail: event.detail,
    comments: event.comments,
  };
}

function normalizeLineup(fixtureId, lineup) {
  return {
    fixtureId: String(fixtureId),
    teamId: String(lineup.team.id),
    formation: lineup.formation,
    startXI: (lineup.startXI || []).map(p => ({
      playerId: String(p.player.id),
      playerName: p.player.name,
      number: p.player.number,
      position: p.player.pos,
      grid: p.player.grid,
    })),
    substitutes: (lineup.substitutes || []).map(p => ({
      playerId: String(p.player.id),
      playerName: p.player.name,
      number: p.player.number,
      position: p.player.pos,
    })),
    coach: lineup.coach
      ? { id: String(lineup.coach.id), name: lineup.coach.name }
      : null,
    isConfirmed: true,
  };
}

function normalizeLeague(l) {
  return {
    providerId: String(l.league.id),
    name: l.league.name,
    type: l.league.type,
    logo: l.league.logo,
    country: l.country.name,
    countryCode: l.country.code,
    seasons: (l.seasons || []).map(s => ({
      year: s.year,
      start: s.start,
      end: s.end,
      current: s.current,
    })),
  };
}

function normalizeStanding(s) {
  return {
    rank: s.rank,
    teamId: String(s.team.id),
    teamName: s.team.name,
    teamLogo: s.team.logo,
    points: s.points,
    goalsDiff: s.goalsDiff,
    group: s.group,
    form: s.form,
    status: s.status,
    description: s.description,
    all: s.all,
    home: s.home,
    away: s.away,
    update: s.update,
  };
}

function normalizeTeam(t) {
  return {
    providerId: String(t.team.id),
    name: t.team.name,
    code: t.team.code,
    country: t.team.country,
    founded: t.team.founded,
    national: t.team.national,
    logo: t.team.logo,
    venue: t.venue
      ? {
          name: t.venue.name,
          address: t.venue.address,
          city: t.venue.city,
          capacity: t.venue.capacity,
          surface: t.venue.surface,
          image: t.venue.image,
        }
      : null,
  };
}

function normalizeTeamStats(teamId, leagueId, season, stats) {
  if (!stats) return null;
  return {
    teamId: String(teamId),
    leagueId: String(leagueId),
    season,
    matchesPlayed: {
      home: stats.fixtures?.played?.home || 0,
      away: stats.fixtures?.played?.away || 0,
      total: stats.fixtures?.played?.total || 0,
    },
    wins: {
      home: stats.fixtures?.wins?.home || 0,
      away: stats.fixtures?.wins?.away || 0,
      total: stats.fixtures?.wins?.total || 0,
    },
    draws: {
      home: stats.fixtures?.draws?.home || 0,
      away: stats.fixtures?.draws?.away || 0,
      total: stats.fixtures?.draws?.total || 0,
    },
    losses: {
      home: stats.fixtures?.loses?.home || 0,
      away: stats.fixtures?.loses?.away || 0,
      total: stats.fixtures?.loses?.total || 0,
    },
    goalsFor: {
      home: stats.goals?.for?.total?.home || 0,
      away: stats.goals?.for?.total?.away || 0,
      total: stats.goals?.for?.total?.total || 0,
      average: {
        home: parseFloat(stats.goals?.for?.average?.home) || 0,
        away: parseFloat(stats.goals?.for?.average?.away) || 0,
        total: parseFloat(stats.goals?.for?.average?.total) || 0,
      },
    },
    goalsAgainst: {
      home: stats.goals?.against?.total?.home || 0,
      away: stats.goals?.against?.total?.away || 0,
      total: stats.goals?.against?.total?.total || 0,
      average: {
        home: parseFloat(stats.goals?.against?.average?.home) || 0,
        away: parseFloat(stats.goals?.against?.average?.away) || 0,
        total: parseFloat(stats.goals?.against?.average?.total) || 0,
      },
    },
    cleanSheets: {
      home: stats.clean_sheet?.home || 0,
      away: stats.clean_sheet?.away || 0,
      total: stats.clean_sheet?.total || 0,
    },
    failedToScore: {
      home: stats.failed_to_score?.home || 0,
      away: stats.failed_to_score?.away || 0,
      total: stats.failed_to_score?.total || 0,
    },
    form: stats.form || null,
    biggestWin: {
      home: stats.biggest?.wins?.home || null,
      away: stats.biggest?.wins?.away || null,
    },
    biggestLoss: {
      home: stats.biggest?.loses?.home || null,
      away: stats.biggest?.loses?.away || null,
    },
    lineups: stats.lineups || [],
  };
}

function normalizePlayer(p) {
  return {
    providerId: String(p.player.id),
    name: p.player.name,
    firstname: p.player.firstname,
    lastname: p.player.lastname,
    age: p.player.age,
    birth: p.player.birth,
    nationality: p.player.nationality,
    height: p.player.height,
    weight: p.player.weight,
    injured: p.player.injured,
    photo: p.player.photo,
    statistics: (p.statistics || []).map(s => ({
      teamId: String(s.team.id),
      leagueId: String(s.league.id),
      season: s.league.season,
      position: s.games.position,
      rating: parseFloat(s.games.rating) || null,
      appearances: s.games.appearences || 0,
      minutesPlayed: s.games.minutes || 0,
      goals: s.goals.total || 0,
      assists: s.goals.assists || 0,
      yellowCards: s.cards.yellow || 0,
      redCards: s.cards.red || 0,
    })),
  };
}

function normalizeInjury(injury) {
  return {
    playerId: String(injury.player.id),
    playerName: injury.player.name,
    playerPhoto: injury.player.photo,
    teamId: String(injury.team.id),
    teamName: injury.team.name,
    leagueId: String(injury.league.id),
    season: injury.league.season,
    fixtureId: injury.fixture?.id ? String(injury.fixture.id) : null,
    date: injury.fixture?.date || null,
    type: injury.player.type,
    reason: injury.player.reason,
  };
}

function normalizeOdds(odds) {
  return {
    fixtureId: String(odds.fixture.id),
    leagueId: String(odds.league.id),
    bookmakers: (odds.bookmakers || []).map(bm => ({
      id: bm.id,
      name: bm.name,
      bets: (bm.bets || []).map(bet => ({
        id: bet.id,
        name: bet.name,
        values: bet.values,
      })),
    })),
  };
}

module.exports = provider;
