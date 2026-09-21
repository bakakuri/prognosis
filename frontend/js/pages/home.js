/**
 * PredictX — Dashboard (Home Page)
 */

import { matchesAPI, liveAPI, predictionsAPI } from '../api.js';
import { createMatchCard, createSkeletonCard, formatDate } from '../components/match-card.js';
import store from '../state.js';
import { todayString } from '../utils.js';

export default async function homePage({ params, query }) {
  return {
    async render(view) {
      view.innerHTML = `
        <div id="live-section" class="page-section" style="padding-bottom:0"></div>
        <div id="today-section" class="page-section"></div>
        <div id="predictions-section" class="page-section"></div>
        <div id="upcoming-section" class="page-section"></div>
      `;

      // Load all sections in parallel
      await Promise.allSettled([
        renderLiveSection(),
        renderTodaySection(),
        renderPredictionsSection(),
        renderUpcomingSection(),
      ]);
    },
  };
}

async function renderLiveSection() {
  const container = document.getElementById('live-section');
  if (!container) return;

  try {
    const data = await liveAPI.getAll();
    const matches = data.data || [];

    // Update live count in state
    store.set('liveCount', matches.length);
    store.set('liveMatches', matches);

    if (matches.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="live-section-header">
        <span class="live-dot"></span>
        <span class="live-section-title">Live Now</span>
        <span class="live-count-badge">${matches.length}</span>
      </div>
      <div id="live-cards" class="tab-scroll" style="padding-top:0"></div>
    `;

    const liveCards = container.querySelector('#live-cards');
    matches.forEach(match => {
      const card = createMatchCard(match);
      card.style.minWidth = '300px';
      card.style.maxWidth = '340px';
      card.style.flexShrink = '0';
      liveCards.appendChild(card);
    });
  } catch (err) {
    console.warn('Home: live section failed', err);
    container.innerHTML = '';
  }
}

async function renderTodaySection() {
  const container = document.getElementById('today-section');
  if (!container) return;

  // Show skeletons immediately
  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Today</span>
      <a href="#/matches" class="section-link" data-link>See all</a>
    </div>
    <div id="today-cards"></div>
  `;
  const cardsEl = container.querySelector('#today-cards');
  for (let i = 0; i < 3; i++) cardsEl.appendChild(createSkeletonCard());

  try {
    const data = await matchesAPI.getToday();
    const matches = data.data || [];

    cardsEl.innerHTML = '';
    if (matches.length === 0) {
      cardsEl.innerHTML = `<div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-state-icon">⚽</div>
        <div class="empty-state-title">No matches today</div>
      </div>`;
      return;
    }

    // Group by league
    const byLeague = groupByLeague(matches);
    for (const [leagueName, leagueMatches] of Object.entries(byLeague)) {
      leagueMatches.forEach(m => cardsEl.appendChild(createMatchCard(m)));
    }
  } catch (err) {
    cardsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Failed to load matches</div></div>`;
  }
}

async function renderPredictionsSection() {
  const container = document.getElementById('predictions-section');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Top Predictions</span>
      <a href="#/predictions" class="section-link" data-link>See all</a>
    </div>
    <div id="pred-cards"></div>
  `;
  const cardsEl = container.querySelector('#pred-cards');
  for (let i = 0; i < 3; i++) cardsEl.appendChild(createSkeletonCard());

  try {
    const data = await predictionsAPI.getByDate(todayString(), { confidence: 'very_high', limit: 5 });
    const matches = data.data || [];
    cardsEl.innerHTML = '';
    if (matches.length === 0) {
      // Fall back to all confidence levels
      const all = await predictionsAPI.getByDate(todayString(), { limit: 5 });
      const allMatches = all.data || [];
      allMatches.forEach(m => cardsEl.appendChild(createMatchCard(m)));
      if (allMatches.length === 0) {
        cardsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No predictions yet</div></div>`;
      }
      return;
    }
    matches.forEach(m => cardsEl.appendChild(createMatchCard(m)));
  } catch (err) {
    cardsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Predictions unavailable</div></div>`;
  }
}

async function renderUpcomingSection() {
  const container = document.getElementById('upcoming-section');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Next 48 Hours</span>
      <a href="#/matches?tab=upcoming" class="section-link" data-link>See all</a>
    </div>
    <div id="upcoming-cards"></div>
  `;
  const cardsEl = container.querySelector('#upcoming-cards');

  try {
    const data = await matchesAPI.getUpcoming(2);
    const matches = (data.data || []).filter(m => {
      const d = new Date(m.date);
      return d > new Date() && d.toDateString() !== new Date().toDateString();
    }).slice(0, 10);

    cardsEl.innerHTML = '';
    if (matches.length === 0) {
      cardsEl.innerHTML = '';
      container.innerHTML = '';
      return;
    }
    matches.forEach(m => cardsEl.appendChild(createMatchCard(m)));
  } catch (err) {
    cardsEl.innerHTML = '';
    container.innerHTML = '';
  }
}

function groupByLeague(matches) {
  const groups = {};
  for (const m of matches) {
    const key = m.league_name || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
}
