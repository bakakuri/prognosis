'use strict';
const axios = require('axios');
const logger = require('../../utils/logger');
const { sleep } = require('../../utils/helpers');

const BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_KEY;
const DELAY = 7000; // 10 req/min free tier

function statusToCode(s) {
  const m = { SCHEDULED:'NS', TIMED:'NS', IN_PLAY:'1H', PAUSED:'HT',
    FINISHED:'FT', CANCELLED:'CANC', POSTPONED:'PST', SUSPENDED:'PST', AWARDED:'FT' };
  return m[s] || 'NS';
}

function normalizeTeam(t) {
  return { providerId: String(t.id), name: t.name || t.shortName || `Team ${t.id}`,
    code: t.tla || null, country: t.area?.name || null,
    logo: t.crest || null, venue: { name: null, city: null } };
}

function normalizeMatch(m) {
  return {
    providerId: String(m.id),
    date: m.utcDate, timezone: 'UTC',
    status: { code: statusToCode(m.status), long: m.status, elapsed: null },
    score: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
      halftime: { home: m.score?.halfTime?.home ?? null, away: m.score?.halfTime?.away ?? null },
    },
    venue: { name: null, city: null },
    league: { season: m.season?.startDate?.substring(0,4) || null,
      round: m.matchday ? `Matchday ${m.matchday}` : null },
    homeTeam: normalizeTeam(m.homeTeam),
    awayTeam: normalizeTeam(m.awayTeam),
  };
}

async function req(path, params = {}) {
  if (!API_KEY) throw new Error('FOOTBALL_DATA_KEY not set');
  const res = await axios.get(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': API_KEY }, params, timeout: 15000,
  });
  return res.data;
}

async function getFixtures({ leagueId, season, from, to }) {
  try {
    const params = { season };
    if (from) params.dateFrom = from;
    if (to) params.dateTo = to;
    const data = await req(`/competitions/${leagueId}/matches`, params);
    await sleep(DELAY);
    return (data.matches || []).map(normalizeMatch);
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 403) {
      logger.warn(`football-data: ${leagueId} not available on free tier`);
      return [];
    }
    throw err;
  }
}

async function getLiveFixtures() {
  try {
    const data = await req('/matches', { status: 'IN_PLAY,PAUSED' });
    return (data.matches || []).map(normalizeMatch);
  } catch { return []; }
}

async function getFixtureById(id) {
  const data = await req(`/matches/${id}`);
  return normalizeMatch(data);
}

async function getStandings(leagueId, season) {
  try {
    const data = await req(`/competitions/${leagueId}/standings`, { season });
    await sleep(DELAY);
    return (data.standings || []).map(group =>
      (group.table || []).map(r => ({
        teamId: String(r.team.id), teamName: r.team.name, teamLogo: r.team.crest,
        rank: r.position, points: r.points, goalsDiff: r.goalDifference,
        form: r.form, status: null, description: null,
        all: { played: r.playedGames, win: r.won, draw: r.draw, lose: r.lost,
          goals: { for: r.goalsFor, against: r.goalsAgainst } },
      }))
    );
  } catch { return [[]]; }
}

async function getTeamsByLeague(leagueId, season) {
  try {
    const data = await req(`/competitions/${leagueId}/teams`, { season });
    await sleep(DELAY);
    return (data.teams || []).map(t => ({
      providerId: String(t.id), name: t.name, code: t.tla || null,
      country: t.area?.name || null, founded: t.founded || null,
      national: false, logo: t.crest || null,
      venue: { name: t.venue || null, city: null, capacity: null },
    }));
  } catch { return []; }
}

async function getInjuries() { return []; }
function getStatus() { return { provider: 'football-data.org', tier: 'free' }; }
function getProviderHealth() { return { status: 'ok' }; }

module.exports = { getFixtures, getLiveFixtures, getFixtureById,
  getStandings, getTeamsByLeague, getInjuries, getStatus, getProviderHealth };
