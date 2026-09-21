import { leaguesAPI } from '../api.js';
export default async function leaguesPage() {
  return {
    async render(view) {
      view.innerHTML = `<div class="page-section"><div class="section-header"><span class="section-title">Leagues</span></div><div id="leagues-list"></div></div>`;
      const list = view.querySelector('#leagues-list');
      try {
        const data = await leaguesAPI.getAll();
        const leagues = data.data || [];
        list.innerHTML = leagues.map(l => `
          <a href="#/league/${l.id}" class="league-card" style="margin-bottom:var(--space-2);display:flex" data-link>
            <img src="${l.logo||''}" class="league-logo" alt="" onerror="this.style.display='none'" />
            <div style="margin-left:var(--space-3)">
              <div class="league-card-name">${l.name}</div>
              <div class="league-card-country">${l.country||''}</div>
            </div>
          </a>`).join('');
      } catch { list.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load leagues</div></div>`; }
    }
  };
}
