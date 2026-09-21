import { leaguesAPI } from '../api.js';
import { createMatchCard } from '../components/match-card.js';
export default async function leaguePage({ params }) {
  return {
    async render(view) {
      view.innerHTML = `<div class="page-loader" style="display:flex"><div class="loader-spinner"></div></div>`;
      try {
        const data = await leaguesAPI.getById(params.id);
        const l = data.data;
        view.innerHTML = `
          <div class="match-detail-header" style="display:flex;align-items:center;gap:var(--space-3)">
            <img src="${l.logo||''}" style="width:48px;height:48px;object-fit:contain" onerror="this.style.display='none'" alt="" />
            <div><h2 style="color:var(--text-bright)">${l.name}</h2><p style="color:var(--text-muted)">${l.country||''}</p></div>
          </div>
          <div class="tab-scroll"><button class="tab-btn active" data-tab="standings">Standings</button><button class="tab-btn" data-tab="matches">Matches</button></div>
          <div id="league-content" class="page-section"></div>`;
        const tabs = view.querySelector('.tab-scroll');
        const content = view.querySelector('#league-content');
        const renderStandings = () => {
          const st = l.standings||[];
          if (!st.length) { content.innerHTML = `<div class="empty-state"><div class="empty-state-title">No standings</div></div>`; return; }
          content.innerHTML = `<div style="overflow-x:auto"><table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${st.map(s=>`<tr onclick="location.hash='/team/${s.team_id}'"><td class="rank-cell">${s.rank}</td><td><div class="team-cell"><img src="${s.team_logo||''}" class="team-logo-sm" onerror="this.style.display='none'" alt="" />${s.team_name}</div></td><td>${s.played_total}</td><td>${s.win_total}</td><td>${s.draw_total}</td><td>${s.lose_total}</td><td>${s.goals_diff>=0?'+':''}${s.goals_diff}</td><td class="points-cell">${s.points}</td></tr>`).join('')}</tbody></table></div>`;
        };
        const renderMatches = () => {
          const matches = l.upcomingMatches||[];
          content.innerHTML = '';
          if (!matches.length) { content.innerHTML = `<div class="empty-state"><div class="empty-state-title">No upcoming matches</div></div>`; return; }
          matches.forEach(m => content.appendChild(createMatchCard(m)));
        };
        tabs.addEventListener('click', e => {
          const btn = e.target.closest('.tab-btn'); if (!btn) return;
          tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
          if (btn.dataset.tab==='standings') renderStandings(); else renderMatches();
        });
        renderStandings();
      } catch { view.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load league</div></div>`; }
    }
  };
}
