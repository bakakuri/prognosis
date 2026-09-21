/**
 * PredictX — Match Card & Prediction Card Components
 */

// ─── Formatters ───────────────────────────────────────────
export function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatProb(prob) {
  if (prob == null) return '—';
  return Math.round(prob * 100) + '%';
}

function getStatusLabel(statusCode, elapsed) {
  if (statusCode === 'HT') return 'HT';
  if (statusCode === 'FT') return 'FT';
  if (statusCode === 'AET') return 'AET';
  if (statusCode === 'NS') return null;
  if (elapsed) return `${elapsed}'`;
  return statusCode;
}

function isLive(statusCode) {
  return ['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(statusCode);
}

function isFinished(statusCode) {
  return ['FT', 'AET', 'PEN'].includes(statusCode);
}

// ─── Match Card ───────────────────────────────────────────
export function createMatchCard(match, options = {}) {
  const live = isLive(match.status_code);
  const finished = isFinished(match.status_code);
  const hasScore = match.home_goals != null;
  const hasPrediction = match.prob_home != null;
  const confidence = match.confidence || 'no_signal';
  const statusLabel = getStatusLabel(match.status_code, match.elapsed);

  const homeLogo = match.home_logo || '/icons/team-placeholder.svg';
  const awayLogo = match.away_logo || '/icons/team-placeholder.svg';
  const leagueLogo = match.league_logo || '/icons/league-placeholder.svg';

  const card = document.createElement('div');
  card.className = `match-card${live ? ' live-card' : ''}`;
  card.dataset.confidence = confidence;
  card.dataset.id = match.id;

  let scoreOrVs;
  if (hasScore) {
    scoreOrVs = `
      <div class="match-card-score-block">
        <div class="match-card-score${live ? ' live' : ''}">${match.home_goals} – ${match.away_goals}</div>
        ${match.home_goals_ht != null ? `<div class="match-card-elapsed">${live ? `<span class="live-dot"></span> ${match.elapsed}'` : `HT ${match.home_goals_ht}–${match.away_goals_ht}`}</div>` : ''}
        ${statusLabel && !live ? `<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">${statusLabel}</div>` : ''}
      </div>`;
  } else {
    scoreOrVs = `
      <div class="match-card-score-block">
        <div class="match-card-vs">vs</div>
        <div class="match-card-time">${formatTime(match.date)}</div>
      </div>`;
  }

  let predRow = '';
  if (hasPrediction && !finished) {
    const h = match.prob_home, d = match.prob_draw, a = match.prob_away;
    predRow = `
      <div class="match-card-prediction">
        <div class="prob-cell">
          <span class="prob-label">Home</span>
          <span class="prob-value home">${formatProb(h)}</span>
        </div>
        <div class="prob-cell">
          <span class="prob-label">Draw</span>
          <span class="prob-value draw">${formatProb(d)}</span>
        </div>
        <div class="prob-cell">
          <span class="prob-label">Away</span>
          <span class="prob-value away">${formatProb(a)}</span>
        </div>
      </div>
      <div class="prob-bar-row" style="margin-top:var(--space-2)">
        <div class="prob-bar-home" style="flex:${Math.round((h||0)*100)}"></div>
        <div class="prob-bar-draw" style="flex:${Math.round((d||0)*100)}"></div>
        <div class="prob-bar-away" style="flex:${Math.round((a||0)*100)}"></div>
      </div>
      ${match.over_2_5 != null || match.btts_yes != null ? `
      <div class="match-card-markets" style="margin-top:var(--space-2)">
        ${match.over_2_5 != null ? `<span class="market-chip"><span class="market-chip-label">O2.5</span><span class="market-chip-value${match.over_2_5 >= 0.6 ? ' highlight' : ''}">${formatProb(match.over_2_5)}</span></span>` : ''}
        ${match.btts_yes != null ? `<span class="market-chip"><span class="market-chip-label">BTTS</span><span class="market-chip-value${match.btts_yes >= 0.6 ? ' highlight' : ''}">${formatProb(match.btts_yes)}</span></span>` : ''}
      </div>` : ''}`;
  }

  card.innerHTML = `
    <div class="match-card-inner">
      <div class="match-card-league">
        <img src="${leagueLogo}" class="league-logo" alt="${match.league_name||''}" loading="lazy" onerror="this.style.display='none'" />
        <span class="match-card-league-name">${match.league_name || ''} ${match.league_country ? '· ' + match.league_country : ''}</span>
        ${live ? `<div class="live-dot" style="margin-left:auto"></div>` : `<span class="match-card-time" style="margin-left:auto;font-family:var(--font-mono)">${formatDate(match.date)}</span>`}
      </div>
      <div class="match-card-teams">
        <div class="match-card-team home">
          <img src="${homeLogo}" class="team-logo" alt="${match.home_name}" loading="lazy" onerror="this.src='/icons/team-placeholder.svg'" />
          <span class="match-card-team-name">${match.home_name}</span>
        </div>
        ${scoreOrVs}
        <div class="match-card-team away">
          <img src="${awayLogo}" class="team-logo" alt="${match.away_name}" loading="lazy" onerror="this.src='/icons/team-placeholder.svg'" />
          <span class="match-card-team-name">${match.away_name}</span>
        </div>
      </div>
      ${predRow}
    </div>`;

  card.addEventListener('click', () => {
    window.location.hash = `/match/${match.id}`;
  });

  return card;
}

// ─── Skeleton Card ────────────────────────────────────────
export function createSkeletonCard() {
  const card = document.createElement('div');
  card.className = 'match-card';
  card.innerHTML = `
    <div class="match-card-inner">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <div class="skeleton" style="width:20px;height:20px;border-radius:50%"></div>
        <div class="skeleton" style="width:120px;height:10px"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center">
        <div class="skeleton" style="height:14px;width:80%"></div>
        <div class="skeleton" style="width:40px;height:28px"></div>
        <div class="skeleton" style="height:14px;width:80%;margin-left:auto"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-dim)">
        <div class="skeleton" style="height:32px"></div>
        <div class="skeleton" style="height:32px"></div>
        <div class="skeleton" style="height:32px"></div>
      </div>
    </div>`;
  return card;
}
