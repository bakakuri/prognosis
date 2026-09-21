/**
 * PredictX — Bottom Navigation Component
 */

import store from '../state.js';

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '#/',
    path: '/',
    icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
  },
  {
    label: 'Matches',
    href: '#/matches',
    path: '/matches',
    icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v4l3 3"/>
    </svg>`,
  },
  {
    label: 'Predictions',
    href: '#/predictions',
    path: '/predictions',
    icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>`,
  },
  {
    label: 'Live',
    href: '#/live',
    path: '/live',
    icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="2"/>
      <path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49M16.24 7.76a6 6 0 0 1 0 8.49"/>
    </svg>`,
    badge: true,
  },
  {
    label: 'More',
    href: '#/leagues',
    path: '/leagues',
    icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>`,
  },
];

export function renderBottomNav(container) {
  container.innerHTML = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="bottom-nav-item" data-path="${item.path}" aria-label="${item.label}">
      ${item.icon}
      <span class="nav-label">${item.label}</span>
      ${item.badge ? `<span class="nav-badge" id="live-badge" hidden>0</span>` : ''}
    </a>
  `).join('');

  // Update live badge
  function updateLiveBadge(count) {
    const badge = document.getElementById('live-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.removeAttribute('hidden');
    } else {
      badge.setAttribute('hidden', '');
    }
  }

  store.subscribe('liveCount', updateLiveBadge);
  updateLiveBadge(store.get('liveCount') || 0);

  // Set initial active state
  const hash = window.location.hash.replace('#', '') || '/';
  container.querySelectorAll('.bottom-nav-item').forEach(el => {
    const path = el.dataset.path;
    const isActive = path === hash || (path !== '/' && hash.startsWith(path));
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}
