import { predictionsAPI } from '../api.js';
import { createMatchCard, createSkeletonCard } from '../components/match-card.js';
import { todayString } from '../utils.js';

export default async function predictionsPage({ query }) {
  const tab = query.confidence || 'all';
  return {
    async render(view) {
      view.innerHTML = `
        <div class="tab-scroll" style="border-bottom:1px solid var(--border)">
          <button class="tab-btn${tab==='all'?' active':''}" data-conf="">All</button>
          <button class="tab-btn${tab==='very_high'?' active':''}" data-conf="very_high">Very High</button>
          <button class="tab-btn${tab==='high'?' active':''}" data-conf="high">High</button>
          <button class="tab-btn${tab==='medium'?' active':''}" data-conf="medium">Medium</button>
        </div>
        <div id="pred-content" class="page-section"></div>`;
      const tabs = view.querySelector('.tab-scroll');
      const content = view.querySelector('#pred-content');
      tabs.addEventListener('click', async e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        await load(btn.dataset.conf, content);
      });
      await load(tab === 'all' ? '' : tab, content);
    }
  };
}

async function load(conf, el) {
  el.innerHTML = '';
  for (let i = 0; i < 5; i++) el.appendChild(createSkeletonCard());
  try {
    const data = await predictionsAPI.getByDate(todayString(), conf ? { confidence: conf } : {});
    const matches = data.data || [];
    el.innerHTML = '';
    if (!matches.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No predictions for today</div><div class="empty-state-desc">Predictions are generated for upcoming matches up to 3 days ahead.</div></div>`; return; }
    matches.forEach(m => el.appendChild(createMatchCard(m)));
  } catch { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Failed to load</div></div>`; }
}
