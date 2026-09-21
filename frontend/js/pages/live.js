import { liveAPI } from '../api.js';
import { createMatchCard } from '../components/match-card.js';
import store from '../state.js';

let pollInterval;

export default async function livePage() {
  return {
    async render(view) {
      view.innerHTML = `
        <div class="live-section-header" style="padding:var(--space-4) var(--page-gutter)">
          <span class="live-dot"></span>
          <span class="live-section-title">Live Center</span>
          <span class="live-count-badge" id="live-hdr-count">0</span>
        </div>
        <div id="live-content" class="page-section"></div>`;
      await loadLive(view);
      pollInterval = setInterval(() => loadLive(view), 30000);
    },
    cleanup() { clearInterval(pollInterval); }
  };
}

async function loadLive(view) {
  const content = view.querySelector('#live-content');
  const badge = view.querySelector('#live-hdr-count');
  try {
    const data = await liveAPI.getAll();
    const matches = data.data || [];
    store.set('liveCount', matches.length);
    if (badge) badge.textContent = matches.length;
    if (!content) return;
    content.innerHTML = '';
    if (!matches.length) {
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📡</div><div class="empty-state-title">No live matches right now</div><div class="empty-state-desc">Matches will appear here while in progress</div></div>`;
      return;
    }
    matches.forEach(m => content.appendChild(createMatchCard(m)));
  } catch { /* keep showing last state */ }
}
