'use strict';

/**
 * Get current UTC date as ISO string (date part only)
 */
function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get tomorrow's UTC date as ISO string
 */
function tomorrowUTC() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Get N days from now as ISO date string
 */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * Get N days ago as ISO date string
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate rest days between two dates
 */
function restDays(lastMatch, nextMatch) {
  if (!lastMatch || !nextMatch) return null;
  const last = new Date(lastMatch);
  const next = new Date(nextMatch);
  return Math.round((next - last) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is today (UTC)
 */
function isToday(date) {
  if (!date) return false;
  const d = new Date(date);
  return d.toISOString().split('T')[0] === todayUTC();
}

/**
 * Check if a match is live (within a time window)
 */
function isMatchWindowActive(kickoff, windowMinutes = 120) {
  if (!kickoff) return false;
  const now = Date.now();
  const kickoffMs = new Date(kickoff).getTime();
  const windowMs = windowMinutes * 60 * 1000;
  return now >= kickoffMs && now <= kickoffMs + windowMs;
}

/**
 * Format a date for display (ISO → human readable)
 */
function formatMatchDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format match time for display
 */
function formatMatchTime(dateStr, timezone = 'UTC') {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

/**
 * Get the current football season year
 * (August of year N → July of year N+1 is season N)
 */
function currentSeason() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // July (month 6) and earlier belongs to previous season
  return month <= 5 ? year - 1 : year;
}

/**
 * Parse an API-Football date string to JS Date
 */
function parseAPIDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr);
}

module.exports = {
  todayUTC,
  tomorrowUTC,
  daysFromNow,
  daysAgo,
  restDays,
  isToday,
  isMatchWindowActive,
  formatMatchDate,
  formatMatchTime,
  currentSeason,
  parseAPIDate,
};
