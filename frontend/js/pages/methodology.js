export default async function methodologyPage() {
  return {
    async render(view) {
      view.innerHTML = `
        <div class="page-section" style="padding-bottom:0">
          <h2 style="color:var(--text-bright);margin-bottom:var(--space-2)">How PredictX Works</h2>
          <p style="color:var(--text-secondary);font-size:var(--text-sm)">An ensemble of statistical models — not machine learning guesswork.</p>
        </div>
        <div class="method-section">
          <div class="method-warning">⚠️ Predictions are statistical models only. Not betting advice. No guarantees. Variance exists.</div>
        </div>
        ${[
          {name:'Elo Rating System',desc:'Each team has a dynamic Elo rating updated after every match. Higher K-factor for early-season matches, adjusted by goal margin. Home advantage adds 100 Elo points.',formula:'E = 1 / (1 + 10^((Ra − Rb) / 400))'},
          {name:'Poisson Model',desc:'Models goals as independent Poisson processes. Attack/defense strengths computed from season statistics relative to league average. Expected goals fed into score matrix.',formula:'P(X=k) = (λᵏ × e⁻λ) / k!'},
          {name:'Dixon-Coles Correction',desc:'Corrects Poisson underestimation of low scores (0-0, 1-0, 0-1, 1-1) using a ρ (rho) correlation parameter estimated from historical data.',formula:'τ(x,y,λ,μ,ρ) = correction factor for x,y ∈ {0,1}'},
          {name:'Recent Form',desc:'Last 10 matches with exponential decay weighting (most recent = most important). Multi-factor score: result + goal difference + opponent strength + xG where available.',formula:'formScore = Σ weight(i) × matchScore(i)'},
          {name:'xG (Expected Goals)',desc:'Where xG data is available, we use historical expected goals to estimate attack/defense quality independent of finishing variance.',formula:'xG_match = homeAttack × awayDefense / leagueAvg'},
          {name:'Ensemble',desc:'Weighted combination across models based on data availability and model quality. Weights: Poisson 35%, Dixon-Coles 20%, Elo 20%, Form 15%, xG 10%. Adjusted for lineup and injury data.',formula:'P_final = Σ (weight_i × P_model_i)'},
        ].map(m=>`
          <div class="method-section">
            <div class="method-title">${m.name}</div>
            <div class="method-desc">${m.desc}</div>
            <div class="method-formula">${m.formula}</div>
          </div>`).join('')}
      `;
    }
  };
}
