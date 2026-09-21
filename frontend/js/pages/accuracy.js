import { predictionsAPI } from '../api.js';
export default async function accuracyPage() {
  return {
    async render(view) {
      view.innerHTML = `<div class="page-loader" style="display:flex"><div class="loader-spinner"></div></div>`;
      try {
        const data = await predictionsAPI.getAccuracy();
        const metrics = data.data || [];
        if (!metrics.length) {
          view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No accuracy data yet</div><div class="empty-state-desc">Accuracy stats accumulate as predictions are resolved.</div></div>`;
          return;
        }
        const overall = metrics[0];
        view.innerHTML = `
          <div class="page-section">
            <h2 style="color:var(--text-bright);margin-bottom:var(--space-4)">Prediction Accuracy</h2>
            <div class="accuracy-grid">
              <div class="accuracy-metric">
                <span class="accuracy-metric-value">${overall.accuracy ? Math.round(overall.accuracy*100)+'%' : '—'}</span>
                <span class="accuracy-metric-label">Overall Accuracy</span>
              </div>
              <div class="accuracy-metric">
                <span class="accuracy-metric-value">${overall.brier_score ? parseFloat(overall.brier_score).toFixed(3) : '—'}</span>
                <span class="accuracy-metric-label">Brier Score ↓</span>
              </div>
              <div class="accuracy-metric">
                <span class="accuracy-metric-value">${overall.sample_size || 0}</span>
                <span class="accuracy-metric-label">Predictions</span>
              </div>
              <div class="accuracy-metric">
                <span class="accuracy-metric-value">${overall.log_loss ? parseFloat(overall.log_loss).toFixed(3) : '—'}</span>
                <span class="accuracy-metric-label">Log Loss ↓</span>
              </div>
            </div>
          </div>
          <div class="page-section">
            <p style="color:var(--text-muted);font-size:var(--text-sm)">Random baseline for 3-outcome football: ~33% accuracy, Brier ~0.67. Calibration is more important than raw accuracy.</p>
          </div>`;
      } catch { view.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load</div></div>`; }
    }
  };
}
