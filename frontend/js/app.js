/**
 * PredictX — Main App Entry Point
 * Initializes routing, navigation, PWA, and live updates
 */

import { route, initRouter } from './router.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { renderSidebarNav } from './components/sidebar-nav.js';

// Pages (lazy-imported via dynamic import below)
// We define the routes with dynamic imports to split code

// ─── Register Routes ──────────────────────────────────────
route('/', async (ctx) => {
  const { default: page } = await import('./pages/home.js');
  return page(ctx);
});

route('/matches', async (ctx) => {
  const { default: page } = await import('./pages/matches.js');
  return page(ctx);
});

route('/match/:id', async (ctx) => {
  const { default: page } = await import('./pages/match-detail.js');
  return page(ctx);
});

route('/predictions', async (ctx) => {
  const { default: page } = await import('./pages/predictions.js');
  return page(ctx);
});

route('/live', async (ctx) => {
  const { default: page } = await import('./pages/live.js');
  return page(ctx);
});

route('/leagues', async (ctx) => {
  const { default: page } = await import('./pages/leagues.js');
  return page(ctx);
});

route('/league/:id', async (ctx) => {
  const { default: page } = await import('./pages/league.js');
  return page(ctx);
});

route('/teams', async (ctx) => {
  const { default: page } = await import('./pages/teams.js');
  return page(ctx);
});

route('/team/:id', async (ctx) => {
  const { default: page } = await import('./pages/team.js');
  return page(ctx);
});

route('/search', async (ctx) => {
  const { default: page } = await import('./pages/search.js');
  return page(ctx);
});

route('/favorites', async (ctx) => {
  const { default: page } = await import('./pages/favorites.js');
  return page(ctx);
});

route('/accuracy', async (ctx) => {
  const { default: page } = await import('./pages/accuracy.js');
  return page(ctx);
});

route('/methodology', async (ctx) => {
  const { default: page } = await import('./pages/methodology.js');
  return page(ctx);
});

route('/settings', async (ctx) => {
  const { default: page } = await import('./pages/settings.js');
  return page(ctx);
});

// ─── Initialize Navigation ────────────────────────────────
const bottomNav = document.getElementById('bottom-nav');
if (bottomNav) renderBottomNav(bottomNav);

const sidebarNav = document.getElementById('sidebar-nav');
if (sidebarNav) renderSidebarNav(sidebarNav);

// ─── Search Overlay ───────────────────────────────────────
const searchTrigger = document.getElementById('search-trigger');
const searchOverlay = document.getElementById('search-overlay');
const searchClose = document.getElementById('search-close');
const globalSearch = document.getElementById('global-search');
const searchResults = document.getElementById('search-results');

let searchTimeout;

function openSearch() {
  searchOverlay?.removeAttribute('hidden');
  globalSearch?.focus();
}
function closeSearch() {
  searchOverlay?.setAttribute('hidden', '');
  if (globalSearch) globalSearch.value = '';
  if (searchResults) searchResults.innerHTML = '';
}

searchTrigger?.addEventListener('click', openSearch);
searchClose?.addEventListener('click', closeSearch);
searchOverlay?.addEventListener('click', (e) => {
  if (e.target === searchOverlay) closeSearch();
});

globalSearch?.addEventListener('input', async (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) { if (searchResults) searchResults.innerHTML = ''; return; }

  searchTimeout = setTimeout(async () => {
    try {
      const { searchAPI } = await import('./api.js');
      const data = await searchAPI.search(q);
      const { teams = [], leagues = [] } = data.data || {};

      if (!searchResults) return;
      searchResults.innerHTML = `
        ${leagues.length ? `
          <div class="search-group-title">Leagues</div>
          ${leagues.map(l => `
            <div class="search-result-item" data-href="#/league/${l.id}">
              <img src="${l.logo||''}" class="league-logo" onerror="this.style.display='none'" alt="" />
              <div>
                <div class="search-result-name">${l.name}</div>
                <div class="search-result-meta">${l.country||''}</div>
              </div>
            </div>`).join('')}` : ''}
        ${teams.length ? `
          <div class="search-group-title" style="margin-top:var(--space-3)">Teams</div>
          ${teams.map(t => `
            <div class="search-result-item" data-href="#/team/${t.id}">
              <img src="${t.logo||''}" class="team-logo-sm" onerror="this.style.display='none'" alt="" />
              <div>
                <div class="search-result-name">${t.name}</div>
                <div class="search-result-meta">${t.country||''}</div>
              </div>
            </div>`).join('')}` : ''}
        ${!teams.length && !leagues.length ? `<div class="search-result-item"><div class="search-result-name" style="color:var(--text-muted)">No results for "${q}"</div></div>` : ''}
      `;

      searchResults.querySelectorAll('[data-href]').forEach(el => {
        el.addEventListener('click', () => {
          const href = el.dataset.href;
          closeSearch();
          setTimeout(() => { window.location.hash = href; }, 50);
        });
      });
    } catch { /* ignore search errors */ }
  }, 250);
});

// Keyboard: ESC closes search
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSearch();
});

// ─── PWA Service Worker ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration is best-effort
    });
  });
}

// ─── PWA Install Prompt ───────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  const dismissed = localStorage.getItem('px_pwa_dismissed');
  if (!dismissed && banner) banner.removeAttribute('hidden');
});

document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
  const banner = document.getElementById('pwa-install-banner');
  banner?.setAttribute('hidden', '');
  if (deferredInstallPrompt) {
    await deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
  }
});

document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
  const banner = document.getElementById('pwa-install-banner');
  banner?.setAttribute('hidden', '');
  localStorage.setItem('px_pwa_dismissed', '1');
});

// ─── Live Poll (every 60s in background) ──────────────────
async function pollLiveCount() {
  try {
    const { liveAPI } = await import('./api.js');
    const { store } = await import('./state.js');
    const data = await liveAPI.getAll();
    store.set('liveCount', data.count || 0);
  } catch { /* ignore */ }
}

setInterval(pollLiveCount, 60000);
pollLiveCount();

// ─── Start Router ─────────────────────────────────────────
initRouter();
