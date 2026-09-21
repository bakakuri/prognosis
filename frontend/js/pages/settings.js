export default async function settingsPage() {
  return {
    async render(view) {
      view.innerHTML = `
        <div class="page-section">
          <h2 style="color:var(--text-bright);margin-bottom:var(--space-4)">Settings</h2>
          <div class="prediction-card">
            <div class="stat-row"><span class="stat-row-label">Version</span><span class="stat-row-value font-mono">1.0.0</span></div>
            <div class="stat-row"><span class="stat-row-label">Data Source</span><span class="stat-row-value">API-Football v3</span></div>
            <div class="stat-row"><span class="stat-row-label">Models</span><span class="stat-row-value">Elo · Poisson · DC · Form · xG</span></div>
          </div>
          <div style="margin-top:var(--space-4)">
            <p style="color:var(--text-muted);font-size:var(--text-sm)">PredictX is free, open-source, and ad-free. No accounts. No subscriptions.</p>
          </div>
        </div>`;
    }
  };
}
