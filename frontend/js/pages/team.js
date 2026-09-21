import { teamsAPI } from '../api.js';
import { createMatchCard } from '../components/match-card.js';
export default async function teamPage({ params }) {
  return {
    async render(view) {
      view.innerHTML = `<div class="page-loader" style="display:flex"><div class="loader-spinner"></div></div>`;
      try {
        const data = await teamsAPI.getById(params.id);
        const t = data.data;
        const elo = t.ratings?.elo_rating ? Math.round(t.ratings.elo_rating) : null;
        view.innerHTML = `
          <div class="team-header">
            <img src="${t.logo||''}" class="team-logo-lg" alt="${t.name}" onerror="this.style.display='none'" />
            <div>
              <div class="team-header-name">${t.name}</div>
              <div class="team-header-meta">${t.country||''} ${t.venue_name ? '· ' + t.venue_name : ''}</div>
              ${elo ? `<div class="team-header-elo">Elo: ${elo}</div>` : ''}
            </div>
          </div>
          <div class="tab-scroll"><button class="tab-btn active" data-tab="form">Form</button><button class="tab-btn" data-tab="injuries">Injuries</button></div>
          <div id="team-content" class="page-section"></div>`;
        const tabs = view.querySelector('.tab-scroll');
        const content = view.querySelector('#team-content');
        const renderForm = () => {
          const matches = t.recentMatches||[];
          content.innerHTML = '';
          if (!matches.length) { content.innerHTML = `<div class="empty-state"><div class="empty-state-title">No recent matches</div></div>`; return; }
          const wins = matches.filter(m => { const h = m.home_team_id === t.id; return h ? m.home_goals > m.away_goals : m.away_goals > m.home_goals; }).length;
          const finished = matches.filter(m => m.status_code === 'FT').length;
          if (finished > 0) {
            content.innerHTML = `<div class="stat-row"><span class="stat-row-label">Recent Win Rate</span><span class="stat-row-value">${Math.round(wins/finished*100)}%</span></div>`;
          }
          matches.forEach(m => content.appendChild(createMatchCard(m)));
        };
        const renderInjuries = () => {
          const injuries = t.injuries||[];
          content.innerHTML = '';
          if (!injuries.length) { content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💪</div><div class="empty-state-title">No current injuries</div></div>`; return; }
          content.innerHTML = `<div class="prediction-card">${injuries.map(i=>`<div class="stat-row"><span class="stat-row-label">${i.player_name}</span><span class="stat-row-value" style="color:var(--red)">${i.type}</span></div>`).join('')}</div>`;
        };
        tabs.addEventListener('click', e => {
          const btn = e.target.closest('.tab-btn'); if (!btn) return;
          tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
          if (btn.dataset.tab==='form') renderForm(); else renderInjuries();
        });
        renderForm();
      } catch { view.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load team</div></div>`; }
    }
  };
}
