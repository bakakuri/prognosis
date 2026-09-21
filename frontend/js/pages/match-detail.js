/**
 * PredictX — Match Detail Page
 */

import { matchesAPI } from '../api.js';
import { formatDate, formatTime, formatProb } from '../components/match-card.js';
import { confidenceLabel } from '../utils.js';

export default async function matchDetailPage({ params }) {
  const { id } = params;

  return {
    async render(view) {
      view.innerHTML = `<div class="page-loader" style="display:flex"><div class="loader-spinner"></div></div>`;

      let data;
      try {
        data = await matchesAPI.getById(id);
      } catch (err) {
        view.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Match not found</div>
          <a href="#/" class="btn btn-outline" style="margin-top:1rem">Back to Home</a>
        </div>`;
        return;
      }

      const m = data.data;
      const pred = m.prediction;
      const hasScore = m.home_goals != null;
      const isLive = ['1H','HT','2H','ET','BT','P'].includes(m.status_code);
      const isFinished = ['FT','AET','PEN'].includes(m.status_code);

      view.innerHTML = `
        <!-- Match Header -->
        <div class="match-detail-header">
          <div class="match-detail-league">
            ${m.league_logo ? `<img src="${m.league_logo}" class="league-logo" alt="" />` : ''}
            <span class="match-detail-league-text">${m.league_name} ${m.league_country ? '· ' + m.league_country : ''}</span>
          </div>
          <div class="match-detail-teams">
            <div class="match-detail-team">
              <img src="${m.home_logo||'/icons/team-placeholder.svg'}" class="team-logo-lg" alt="${m.home_name}" onerror="this.src='/icons/team-placeholder.svg'" />
              <span class="match-detail-team-name">${m.home_name}</span>
            </div>
            <div class="match-detail-scoreline">
              <div class="match-detail-score${isLive?' live-score':''}">${hasScore ? `${m.home_goals} – ${m.away_goals}` : '–'}</div>
              ${m.home_goals_ht != null ? `<div class="match-detail-ht">HT ${m.home_goals_ht}–${m.away_goals_ht}</div>` : ''}
              <div class="match-detail-status">
                ${isLive ? `<span class="live-dot"></span><span style="font-size:var(--text-sm);color:var(--live);font-family:var(--font-mono)">${m.elapsed}'</span>` : ''}
                ${isFinished ? `<span class="chip">Full Time</span>` : ''}
                ${m.status_code === 'NS' ? `<span style="font-size:var(--text-sm);color:var(--text-muted)">${formatDate(m.date)} · ${formatTime(m.date)}</span>` : ''}
              </div>
            </div>
            <div class="match-detail-team">
              <img src="${m.away_logo||'/icons/team-placeholder.svg'}" class="team-logo-lg" alt="${m.away_name}" onerror="this.src='/icons/team-placeholder.svg'" />
              <span class="match-detail-team-name">${m.away_name}</span>
            </div>
          </div>
        </div>

        <!-- Content Tabs -->
        <div class="tab-scroll" id="detail-tabs">
          ${!isFinished && pred ? `<button class="tab-btn active" data-tab="prediction">Prediction</button>` : ''}
          ${isFinished || isLive ? `<button class="tab-btn${!pred?' active':''}" data-tab="result">Match</button>` : ''}
          <button class="tab-btn" data-tab="stats">Stats</button>
          <button class="tab-btn" data-tab="lineups">Lineups</button>
          ${m.events?.length > 0 ? `<button class="tab-btn" data-tab="events">Events</button>` : ''}
        </div>

        <div id="detail-content" class="page-section"></div>
      `;

      const tabsEl = view.querySelector('#detail-tabs');
      const contentEl = view.querySelector('#detail-content');

      function showTab(tabName) {
        tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        renderTabContent(tabName, contentEl, m, pred);
      }

      tabsEl.addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (btn) showTab(btn.dataset.tab);
      });

      // Show first available tab
      const firstTab = tabsEl.querySelector('.tab-btn.active') || tabsEl.querySelector('.tab-btn');
      if (firstTab) renderTabContent(firstTab.dataset.tab, contentEl, m, pred);
    },
  };
}

function renderTabContent(tab, el, m, pred) {
  if (tab === 'prediction') renderPrediction(el, m, pred);
  else if (tab === 'result' || tab === 'match') renderResult(el, m);
  else if (tab === 'stats') renderStats(el, m);
  else if (tab === 'lineups') renderLineups(el, m);
  else if (tab === 'events') renderEvents(el, m);
}

function renderPrediction(el, m, pred) {
  if (!pred) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No prediction available</div></div>`;
    return;
  }

  const components = typeof pred.components === 'string' ? JSON.parse(pred.components) : pred.components || {};
  const exactScores = typeof pred.exact_scores === 'string' ? JSON.parse(pred.exact_scores) : pred.exact_scores || [];

  const winner = pred.prob_home > pred.prob_draw && pred.prob_home > pred.prob_away ? 'home'
    : pred.prob_away > pred.prob_draw && pred.prob_away > pred.prob_home ? 'away' : 'draw';

  el.innerHTML = `
    <!-- 1X2 -->
    <div class="prediction-card">
      <div class="prediction-card-header">
        <span class="prediction-card-title">1X2 Probabilities</span>
        <span class="confidence-badge ${pred.confidence||'no_signal'}">${confidenceLabel(pred.confidence)}</span>
      </div>
      <div class="prediction-1x2">
        <div class="prediction-outcome${winner==='home'?' winner':''}">
          <span class="prediction-outcome-label">Home</span>
          <span class="prediction-outcome-prob">${formatProb(pred.prob_home)}</span>
          <span class="prediction-outcome-team">${m.home_name}</span>
          <div class="prediction-outcome-bar"></div>
        </div>
        <div class="prediction-outcome${winner==='draw'?' winner':''}">
          <span class="prediction-outcome-label">Draw</span>
          <span class="prediction-outcome-prob">${formatProb(pred.prob_draw)}</span>
          <span class="prediction-outcome-team">&mdash;</span>
          <div class="prediction-outcome-bar"></div>
        </div>
        <div class="prediction-outcome${winner==='away'?' winner':''}">
          <span class="prediction-outcome-label">Away</span>
          <span class="prediction-outcome-prob">${formatProb(pred.prob_away)}</span>
          <span class="prediction-outcome-team">${m.away_name}</span>
          <div class="prediction-outcome-bar"></div>
        </div>
      </div>
    </div>

    <!-- Markets -->
    <div class="prediction-card" style="margin-top:var(--space-3)">
      <div class="prediction-card-header"><span class="prediction-card-title">Other Markets</span></div>
      <div class="stat-row"><span class="stat-row-label">Over 2.5 Goals</span><span class="stat-row-value">${formatProb(pred.over_2_5)}</span></div>
      <div class="stat-row"><span class="stat-row-label">Under 2.5 Goals</span><span class="stat-row-value">${formatProb(pred.under_2_5)}</span></div>
      <div class="stat-row"><span class="stat-row-label">Both Teams Score</span><span class="stat-row-value">${formatProb(pred.btts_yes)}</span></div>
      ${pred.over_1_5 ? `<div class="stat-row"><span class="stat-row-label">Over 1.5 Goals</span><span class="stat-row-value">${formatProb(pred.over_1_5)}</span></div>` : ''}
    </div>

    <!-- xG -->
    ${pred.xg_home != null ? `
    <div class="prediction-card" style="margin-top:var(--space-3)">
      <div class="prediction-card-header"><span class="prediction-card-title">Expected Goals (xG)</span></div>
      <div class="xg-display">
        <div class="xg-side">
          <span class="xg-value">${parseFloat(pred.xg_home).toFixed(2)}</span>
          <span class="xg-label">${m.home_name}</span>
        </div>
        <span class="xg-vs">vs</span>
        <div class="xg-side">
          <span class="xg-value">${parseFloat(pred.xg_away).toFixed(2)}</span>
          <span class="xg-label">${m.away_name}</span>
        </div>
      </div>
    </div>` : ''}

    <!-- Top Exact Scores -->
    ${exactScores.length > 0 ? `
    <div class="prediction-card" style="margin-top:var(--space-3)">
      <div class="prediction-card-header"><span class="prediction-card-title">Exact Score Probabilities</span></div>
      <div class="exact-scores-grid">
        ${exactScores.slice(0,6).map(s => {
          const maxProb = exactScores[0]?.prob || 0.1;
          const barWidth = Math.round((s.prob / maxProb) * 100);
          return `<div class="exact-score-cell">
            <span class="exact-score-score">${s.score}</span>
            <span class="exact-score-prob">${formatProb(s.prob)}</span>
            <div class="exact-score-bar"><div class="exact-score-bar-fill" style="width:${barWidth}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Model Components -->
    ${Object.keys(components).length > 0 ? `
    <div class="prediction-card" style="margin-top:var(--space-3)">
      <div class="prediction-card-header"><span class="prediction-card-title">Model Breakdown</span></div>
      <div class="model-agreement-grid">
        ${Object.entries(components).map(([name, comp]) => {
          if (!comp?.oneX2) return '';
          const c = comp.oneX2;
          return `<div class="model-row">
            <span class="model-name" style="text-transform:capitalize">${name}</span>
            <div class="model-probs">
              <span class="model-prob-val">${formatProb(c.home)}</span>
              <span class="model-prob-val" style="color:var(--text-muted)">${formatProb(c.draw)}</span>
              <span class="model-prob-val">${formatProb(c.away)}</span>
            </div>
          </div>`;
        }).filter(Boolean).join('')}
      </div>
    </div>` : ''}

    <p style="font-size:var(--text-xs);color:var(--text-dim);padding:var(--space-4) 0;text-align:center">
      Predictions are statistical models only — not betting advice. Past accuracy does not guarantee future results.
    </p>
  `;
}

function renderResult(el, m) {
  const hasStats = m.statistics?.length > 0;
  el.innerHTML = `
    ${hasStats ? `
    <div class="prediction-card">
      <div class="prediction-card-header"><span class="prediction-card-title">Match Statistics</span></div>
      ${renderMatchStats(m.statistics, m)}
    </div>` : `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Stats not yet available</div></div>`}
  `;
}

function renderMatchStats(stats, m) {
  const home = stats.find(s => s.is_home);
  const away = stats.find(s => !s.is_home);
  if (!home && !away) return '<div class="empty-state">No statistics available</div>';

  const rows = [
    { label: 'Shots', h: home?.shots_total, a: away?.shots_total },
    { label: 'Shots on Target', h: home?.shots_on_target, a: away?.shots_on_target },
    { label: 'Possession', h: home?.possession, a: away?.possession, unit: '%' },
    { label: 'Corners', h: home?.corners, a: away?.corners },
    { label: 'Fouls', h: home?.fouls, a: away?.fouls },
    { label: 'Yellow Cards', h: home?.yellow_cards, a: away?.yellow_cards },
    { label: 'Saves', h: home?.goalkeeper_saves, a: away?.goalkeeper_saves },
  ].filter(r => r.h != null || r.a != null);

  return rows.map(r => {
    const hv = parseFloat(r.h||0), av = parseFloat(r.a||0);
    const total = hv + av;
    const hPct = total > 0 ? Math.round(hv/total*100) : 50;
    return `
      <div class="stat-compare">
        <span class="stat-compare-home">${r.h ?? '—'}${r.unit||''}</span>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1">
          <span class="stat-compare-name" style="font-size:10px;color:var(--text-muted)">${r.label}</span>
          <div class="stat-compare-bar">
            <div class="stat-compare-bar-home" style="width:${hPct}%"></div>
            <div class="stat-compare-bar-away" style="width:${100-hPct}%"></div>
          </div>
        </div>
        <span class="stat-compare-away">${r.a ?? '—'}${r.unit||''}</span>
      </div>`;
  }).join('');
}

function renderStats(el, m) {
  if (!m.statistics?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Stats not available</div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="prediction-card">
      <div class="prediction-card-header">
        <span class="prediction-card-title">Match Statistics</span>
      </div>
      ${renderMatchStats(m.statistics, m)}
    </div>`;
}

function renderLineups(el, m) {
  if (!m.lineups?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Lineups not yet announced</div></div>`;
    return;
  }
  const home = m.lineups.find(l => l.team_id === m.home_team_id);
  const away = m.lineups.find(l => l.team_id === m.away_team_id);
  const parseJson = v => typeof v === 'string' ? JSON.parse(v) : v;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
      ${[{l:home,name:m.home_name},{l:away,name:m.away_name}].map(({l,name}) => {
        if (!l) return `<div class="prediction-card"><div class="prediction-card-header"><span class="prediction-card-title">${name}</span></div><div style="padding:var(--space-4);color:var(--text-muted)">Not available</div></div>`;
        const xi = parseJson(l.start_xi || '[]');
        return `
          <div class="prediction-card">
            <div class="prediction-card-header">
              <span class="prediction-card-title">${name}</span>
              <span class="chip">${l.formation||'?'}</span>
            </div>
            <div style="padding:var(--space-3) var(--space-4)">
              ${xi.map(p => `<div class="team-card" style="padding:var(--space-2) 0">
                <span style="font-family:var(--font-mono);color:var(--text-muted);min-width:24px;font-size:var(--text-xs)">${p.number||''}</span>
                <span style="font-size:var(--text-sm);color:var(--text-primary)">${p.name||p.playerName||''}</span>
                <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${p.position||''}</span>
              </div>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderEvents(el, m) {
  const events = m.events || [];
  if (!events.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No events yet</div></div>`;
    return;
  }

  const iconMap = {
    Goal: '⚽',
    Card: e => e.detail?.includes('Yellow') ? '🟨' : '🟥',
    Subst: '🔄',
    Var: '📺',
  };

  el.innerHTML = `
    <div class="prediction-card">
      <div class="prediction-card-header"><span class="prediction-card-title">Match Events</span></div>
      <div class="events-timeline">
        ${events.map(e => {
          const icon = typeof iconMap[e.type] === 'function' ? iconMap[e.type](e) : (iconMap[e.type] || '📋');
          const isAway = e.team_id !== m.home_team_id;
          return `<div class="event-row${isAway ? ' event-away' : ''}">
            <span class="event-time">${e.time_elapsed}'</span>
            <span class="event-icon">${icon}</span>
            <div class="event-player">
              <div>${e.player_name || '—'}</div>
              ${e.assist_name ? `<div class="event-detail">Assist: ${e.assist_name}</div>` : ''}
              <div class="event-detail">${e.detail||''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}
