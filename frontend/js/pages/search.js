import { searchAPI } from '../api.js';
import { debounce } from '../utils.js';
export default async function searchPage({ query }) {
  return {
    async render(view) {
      view.innerHTML = `
        <div class="page-section">
          <div class="search-field" style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:0 var(--space-4);display:flex;align-items:center;gap:var(--space-3)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input id="search-input" class="search-input" placeholder="Search teams, leagues…" value="${query.q||''}" autofocus />
          </div>
          <div id="search-content" style="margin-top:var(--space-4)"></div>
        </div>`;
      const input = view.querySelector('#search-input');
      const content = view.querySelector('#search-content');
      const doSearch = debounce(async (q) => {
        if (q.length < 2) { content.innerHTML = ''; return; }
        try {
          const data = await searchAPI.search(q);
          const {teams=[],leagues=[]} = data.data||{};
          content.innerHTML = `
            ${leagues.length ? `<div class="search-group-title">Leagues</div>${leagues.map(l=>`<div class="search-result-item" onclick="location.hash='/league/${l.id}'"><img src="${l.logo||''}" class="league-logo" onerror="this.style.display='none'" alt="" /><div><div class="search-result-name">${l.name}</div><div class="search-result-meta">${l.country||''}</div></div></div>`).join('')}` : ''}
            ${teams.length ? `<div class="search-group-title" style="margin-top:var(--space-3)">Teams</div>${teams.map(t=>`<div class="search-result-item" onclick="location.hash='/team/${t.id}'"><img src="${t.logo||''}" class="team-logo-sm" onerror="this.style.display='none'" alt="" /><div><div class="search-result-name">${t.name}</div><div class="search-result-meta">${t.country||''}</div></div></div>`).join('')}` : ''}
            ${!teams.length && !leagues.length ? '<div class="empty-state"><div class="empty-state-title">No results</div></div>' : ''}`;
        } catch {}
      }, 300);
      input.addEventListener('input', e => doSearch(e.target.value));
      if (query.q) doSearch(query.q);
    }
  };
}
