# ⚡ PredictX — Football Prediction Platform

Free, self-hosted football prediction and analytics PWA. No subscriptions, no ads, no guarantees.

## What It Does

- Predicts match outcomes (1X2, O/U 2.5, BTTS, exact scores) using an ensemble of statistical models
- Live match tracking with automatic updates
- Full match detail with prediction breakdown and model components
- PWA — installable on any device, works offline

## Models

| Model | Weight | Purpose |
|-------|--------|---------|
| Elo | 20% | Team strength relative rating |
| Poisson | 35% | Expected goals from attack/defense stats |
| Dixon-Coles | 20% | Low-score correction on Poisson |
| Recent Form | 15% | Last 10 matches with decay weighting |
| xG | 10% | Where xG data available from API |

> Predictions are statistical models only. Not betting advice. Past accuracy ≠ future results.

## Stack

- **Backend**: Node.js + Express + PostgreSQL (Supabase)
- **Frontend**: Vanilla JS + ES Modules + PWA (zero frameworks)
- **Data**: API-Football v3

## Quick Start

### 1. Database

Apply the schema to your Supabase project:

```bash
psql $DATABASE_URL -f database/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp ../.env.example ../.env
# Edit .env — fill in DATABASE_URL and API_FOOTBALL_KEY
node server/index.js
```

### 3. Frontend

Serve the `frontend/` folder with any static file server:

```bash
# With serve (npm i -g serve)
serve frontend -p 5000

# Or with Python
cd frontend && python3 -m http.server 5000
```

Open http://localhost:5000

## Environment Variables

See `.env.example` for all required variables.

Key ones:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `API_FOOTBALL_KEY` — from api-football.com (free: 100 calls/day)
- `CORS_ORIGINS` — comma-separated frontend origins

## Free Tier Limits

API-Football free tier: **100 calls/day**. With 10 leagues × 2 sync types, you'll use ~20 calls per full sync cycle. At default schedules (every 6h fixtures, every 15min results), this stays well within free tier limits.

## File Structure

```
predictx/
├── backend/
│   ├── config/          # Database and env config
│   ├── providers/       # API-Football integration
│   ├── prediction/      # All prediction models
│   │   ├── elo/
│   │   ├── poisson/
│   │   ├── dixon-coles/
│   │   ├── form/
│   │   ├── xg/
│   │   ├── lineup/
│   │   ├── injuries/
│   │   ├── ensemble/
│   │   └── calibration/
│   ├── jobs/            # Cron sync jobs
│   ├── routes/          # REST API routes
│   ├── middleware/
│   ├── cache/
│   ├── utils/
│   └── server/          # Express entry point
├── frontend/
│   ├── css/             # Design system CSS
│   ├── js/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page modules (lazy-loaded)
│   │   ├── app.js       # Entry point + router setup
│   │   ├── api.js       # Backend API client
│   │   ├── router.js    # Hash-based SPA router
│   │   └── state.js     # Reactive store
│   ├── index.html
│   ├── sw.js            # Service worker
│   └── manifest.webmanifest
└── database/
    └── schema.sql
```

## License

MIT — free to use, fork, deploy.
