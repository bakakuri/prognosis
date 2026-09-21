/**
 * PredictX — Sidebar Navigation (desktop)
 */

import store from '../state.js';

export function renderSidebarNav(container) {
  container.innerHTML = `
    <a href="#/" class="sidebar-brand" data-link>
      <span class="sidebar-brand-icon">⚡</span>
      <span class="sidebar-brand-name">PredictX</span>
    </a>

    <div class="sidebar-section">
      <a href="#/" class="sidebar-item" data-path="/">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="sidebar-item-label">Dashboard</span>
      </a>
      <a href="#/live" class="sidebar-item" data-path="/live">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="2"/>
          <path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <span class="sidebar-item-label">Live</span>
        <span class="sidebar-live-count" id="sidebar-live-count" hidden>0</span>
      </a>
      <a href="#/matches" class="sidebar-item" data-path="/matches">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l3 3"/>
        </svg>
        <span class="sidebar-item-label">Matches</span>
      </a>
      <a href="#/predictions" class="sidebar-item" data-path="/predictions">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span class="sidebar-item-label">Predictions</span>
      </a>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">Explore</div>
      <a href="#/leagues" class="sidebar-item" data-path="/leagues">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
        </svg>
        <span class="sidebar-item-label">Leagues</span>
      </a>
      <a href="#/teams" class="sidebar-item" data-path="/teams">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="sidebar-item-label">Teams</span>
      </a>
      <a href="#/search" class="sidebar-item" data-path="/search">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span class="sidebar-item-label">Search</span>
      </a>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">Analytics</div>
      <a href="#/accuracy" class="sidebar-item" data-path="/accuracy">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
        <span class="sidebar-item-label">Accuracy</span>
      </a>
      <a href="#/methodology" class="sidebar-item" data-path="/methodology">
        <svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span class="sidebar-item-label">Methodology</span>
      </a>
    </div>
  `;

  // Live badge
  function updateBadge(count) {
    const badge = document.getElementById('sidebar-live-count');
    if (!badge) return;
    if (count > 0) { badge.textContent = count; badge.removeAttribute('hidden'); }
    else badge.setAttribute('hidden', '');
  }
  store.subscribe('liveCount', updateBadge);
  updateBadge(store.get('liveCount') || 0);

  // Active state
  const setActive = (path) => {
    container.querySelectorAll('.sidebar-item').forEach(el => {
      const elPath = el.dataset.path;
      const active = elPath === path || (elPath !== '/' && path.startsWith(elPath));
      el.classList.toggle('active', active);
    });
  };
  store.subscribe('currentRoute', setActive);
  setActive(window.location.hash.replace('#', '') || '/');
}
