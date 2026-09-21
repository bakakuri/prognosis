import { teamsAPI } from '../api.js';
import { debounce } from '../utils.js';
export default async function teamsPage() {
  return {
    async render(view) {
      view.innerHTML = `
        <div class="page-section">
          <div class="search-field" style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-lg);padding:0 var(--space-4);display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input id="team-search" class="search-input" placeholder="Search teams…" />
          </div>
          <div id="teams-list"></div>
        </div>`;
      const list = view.querySelector('#teams-list');
      const load = debounce(async (q) => {
        list.innerHTML = '';
        try {
          const data = await teamsAPI.getAll(q ? { search: q } : {});
          const teams = data.data || [];
          if (!teams.length) { list.innerHTML = `<div class="empty-state"><div class="empty-state-title">No teams found</div></div>`; return; }
          teams.forEach(t => {
            const el = document.createElement('a');
            el.href = `#/team/${t.id}`;
            el.className = 'team-card'; el.setAttribute('data-link', '');
            el.innerHTML = `<img src="${t.logo||''}" class="team-logo" onerror="this.style.display='none'" alt="" /><div><div style="font-weight:500;color:var(--text-bright)">${t.name}</div><div style="font-size:var(--text-xs);color:var(--text-muted)">${t.country||''}</div></div>`;
            list.appendChild(el);
          });
        } catch { list.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load</div></div>`; }
      }, 300);
      view.querySelector('#team-search').addEventListener('input', e => load(e.target.value));
      load('');
    }
  };
}
