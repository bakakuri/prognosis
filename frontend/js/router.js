/**
 * PredictX — SPA Router
 * Hash-based client-side routing
 */

import store from './state.js';

const routes = new Map();
let currentCleanup = null;

/**
 * Define a route
 * pattern: '/match/:id' supports :param segments
 * handler: async function(params) → { render(), cleanup() }
 */
export function route(pattern, handler) {
  routes.set(pattern, { pattern, handler, regex: buildRegex(pattern) });
}

function buildRegex(pattern) {
  const keys = [];
  const regexStr = pattern
    .replace(/\//g, '\\/')
    .replace(/:([^/]+)/g, (_, key) => { keys.push(key); return '([^/]+)'; });
  return { regex: new RegExp(`^${regexStr}$`), keys };
}

function matchRoute(path) {
  for (const [, routeDef] of routes) {
    const { regex, keys } = routeDef.regex;
    const match = path.match(regex);
    if (match) {
      const params = {};
      keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
      return { handler: routeDef.handler, params };
    }
  }
  return null;
}

function getPath() {
  const hash = window.location.hash.slice(1) || '/';
  return hash.split('?')[0] || '/';
}

function getQuery() {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('?');
  const params = new URLSearchParams(parts[1] || '');
  return Object.fromEntries(params);
}

async function navigate(path) {
  const view = document.getElementById('page-view');
  if (!view) return;

  // Show loader
  const loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  // Clean up previous page
  if (currentCleanup) {
    try { currentCleanup(); } catch { /* ignore */ }
    currentCleanup = null;
  }

  const matched = matchRoute(path);

  if (!matched) {
    view.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Page not found</div>
        <div class="empty-state-desc">The page you're looking for doesn't exist.</div>
        <a href="#/" class="btn btn-outline" style="margin-top:1rem">Go Home</a>
      </div>`;
    if (loader) loader.style.display = 'none';
    return;
  }

  store.set('currentRoute', path);
  updateNavActive(path);

  try {
    const page = await matched.handler({ params: matched.params, query: getQuery() });
    if (loader) loader.style.display = 'none';
    if (page) {
      view.innerHTML = '';
      if (typeof page.render === 'function') {
        await page.render(view);
      }
      if (typeof page.cleanup === 'function') {
        currentCleanup = page.cleanup;
      }
    }
  } catch (err) {
    console.error('Router: page error', err);
    if (loader) loader.style.display = 'none';
    view.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Something went wrong</div>
        <div class="empty-state-desc">${err.message || 'Failed to load page'}</div>
        <button class="btn btn-outline" onclick="window.location.reload()" style="margin-top:1rem">Retry</button>
      </div>`;
  }
}

function updateNavActive(path) {
  // Bottom nav
  document.querySelectorAll('.bottom-nav-item, .sidebar-item').forEach(el => {
    const href = el.getAttribute('href') || el.dataset.href || '';
    const navPath = href.replace('#', '');
    const isActive = navPath === path || (navPath !== '/' && path.startsWith(navPath));
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

// ─── Public navigate function ──────────────────────────────
export function go(path) {
  window.location.hash = path;
}

// ─── Handle link clicks ────────────────────────────────────
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (!link) return;
  e.preventDefault();
  const href = link.getAttribute('href');
  if (href) go(href);
});

// ─── Hash change listener ──────────────────────────────────
window.addEventListener('hashchange', () => navigate(getPath()));

// ─── Init ─────────────────────────────────────────────────
export function initRouter() {
  navigate(getPath());
}

export default { route, go, initRouter };
