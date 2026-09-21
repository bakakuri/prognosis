import { matchesAPI } from '../api.js';
import { createMatchCard, createSkeletonCard } from '../components/match-card.js';
import { todayString } from '../utils.js';

export default async function matchesPage({ query }) {
  const tab = query.tab || 'today';
  return {
    async render(view) {
      view.innerHTML = `
        <div class="tab-scroll" style="border-bottom:1px solid var(--border);padding-bottom:0">
          <button class="tab-btn${tab==='today'?' active':''}" data-tab="today">Today</button>
          <button class="tab-btn${tab==='upcoming'?' active':''}" data-tab="upcoming">Upcoming</button>
          <button class="tab-btn${tab==='results'?' active':''}" data-tab="results">Results</button>
        </div>
        <div id="matches-content" class="page-section"></div>`;
      const tabs = view.querySelector('.tab-scroll');
      const content = view.querySelector('#matches-content');
      tabs.addEventListener('click', async e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        await loadTab(btn.dataset.tab, content);
      });
      await loadTab(tab, content);
    }
  };
}

async function loadTab(tab, el) {
  el.innerHTML = '';
  for (let i = 0; i < 4; i++) el.appendChild(createSkeletonCard());
  try {
    let data;
    if (tab === 'today') data = await matchesAPI.getToday();
    else if (tab === 'upcoming') data = await matchesAPI.getUpcoming(5);
    else data = await matchesAPI.getAll({ status: 'FT', date: todayString() });
    const matches = data.data || [];
    el.innerHTML = '';
    if (!matches.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚽</div><div class="empty-state-title">No matches</div></div>`; return; }
    matches.forEach(m => el.appendChild(createMatchCard(m)));
  } catch { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Failed to load</div></div>`; }
}
