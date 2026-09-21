-- ============================================================
-- PredictX — PostgreSQL Database Schema
-- ============================================================
-- Run this against your Supabase / PostgreSQL database
-- psql -d $DATABASE_URL -f schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fast text search

-- ============================================================
-- LEAGUES
-- ============================================================
CREATE TABLE IF NOT EXISTS leagues (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id     VARCHAR(50) NOT NULL,
  provider_name   VARCHAR(50) NOT NULL DEFAULT 'api-football',
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(20),           -- 'League' or 'Cup'
  logo            TEXT,
  country         VARCHAR(100),
  country_code    VARCHAR(10),
  is_active       BOOLEAN DEFAULT TRUE,
  priority        INTEGER DEFAULT 100,   -- Lower = higher priority display
  current_season  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_leagues_provider ON leagues(provider_id, provider_name);
CREATE INDEX IF NOT EXISTS idx_leagues_country ON leagues(country);
CREATE INDEX IF NOT EXISTS idx_leagues_active ON leagues(is_active);

-- ============================================================
-- SEASONS
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  start_date  DATE,
  end_date    DATE,
  is_current  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, year)
);

CREATE INDEX IF NOT EXISTS idx_seasons_league ON seasons(league_id);
CREATE INDEX IF NOT EXISTS idx_seasons_current ON seasons(is_current);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id   VARCHAR(50) NOT NULL,
  provider_name VARCHAR(50) NOT NULL DEFAULT 'api-football',
  name          VARCHAR(150) NOT NULL,
  code          VARCHAR(10),
  country       VARCHAR(100),
  founded       INTEGER,
  national      BOOLEAN DEFAULT FALSE,
  logo          TEXT,
  venue_name    VARCHAR(150),
  venue_city    VARCHAR(100),
  venue_capacity INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_teams_provider ON teams(provider_id, provider_name);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams USING GIN(name gin_trgm_ops);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id   VARCHAR(50) NOT NULL,
  provider_name VARCHAR(50) NOT NULL DEFAULT 'api-football',
  name          VARCHAR(150) NOT NULL,
  firstname     VARCHAR(100),
  lastname      VARCHAR(100),
  age           INTEGER,
  nationality   VARCHAR(100),
  height        VARCHAR(20),
  weight        VARCHAR(20),
  photo         TEXT,
  injured       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_players_provider ON players(provider_id, provider_name);
CREATE INDEX IF NOT EXISTS idx_players_name ON players USING GIN(name gin_trgm_ops);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id     VARCHAR(50) NOT NULL,
  provider_name   VARCHAR(50) NOT NULL DEFAULT 'api-football',
  league_id       UUID NOT NULL REFERENCES leagues(id),
  season_id       UUID REFERENCES seasons(id),
  home_team_id    UUID NOT NULL REFERENCES teams(id),
  away_team_id    UUID NOT NULL REFERENCES teams(id),
  date            TIMESTAMPTZ NOT NULL,
  timezone        VARCHAR(50) DEFAULT 'UTC',
  venue_name      VARCHAR(150),
  venue_city      VARCHAR(100),
  status_code     VARCHAR(10) NOT NULL DEFAULT 'NS',  -- NS, 1H, HT, 2H, FT, AET, PEN, PST, CANC, ABD
  status_long     VARCHAR(50),
  elapsed         INTEGER,                             -- Match minute (for live)
  home_goals      INTEGER,
  away_goals      INTEGER,
  home_goals_ht   INTEGER,
  away_goals_ht   INTEGER,
  home_goals_et   INTEGER,
  away_goals_et   INTEGER,
  home_goals_pen  INTEGER,
  away_goals_pen  INTEGER,
  league_round    VARCHAR(50),
  home_xg         DECIMAL(5,3),
  away_xg         DECIMAL(5,3),
  is_live         BOOLEAN DEFAULT FALSE,
  prediction_status VARCHAR(20) DEFAULT 'pending',     -- pending, predicted, no_signal
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_matches_provider ON matches(provider_id, provider_name);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status_code);
CREATE INDEX IF NOT EXISTS idx_matches_live ON matches(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_date_status ON matches(date, status_code);
CREATE INDEX IF NOT EXISTS idx_matches_prediction_status ON matches(prediction_status);

-- ============================================================
-- MATCH EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS match_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id       UUID REFERENCES teams(id),
  player_id     UUID REFERENCES players(id),
  assist_id     UUID REFERENCES players(id),
  time_elapsed  INTEGER,
  time_extra    INTEGER,
  type          VARCHAR(30),    -- 'Goal', 'Card', 'Subst', 'Var'
  detail        VARCHAR(100),   -- 'Normal Goal', 'Yellow Card', etc.
  comments      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_match ON match_events(match_id);

-- ============================================================
-- MATCH STATISTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS match_statistics (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id              UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id               UUID NOT NULL REFERENCES teams(id),
  is_home               BOOLEAN NOT NULL,
  shots_total           INTEGER,
  shots_on_target       INTEGER,
  shots_off_target      INTEGER,
  shots_blocked         INTEGER,
  possession            DECIMAL(5,2),
  passes_total          INTEGER,
  passes_accurate       INTEGER,
  pass_accuracy         DECIMAL(5,2),
  fouls                 INTEGER,
  corners               INTEGER,
  offsides              INTEGER,
  yellow_cards          INTEGER,
  red_cards             INTEGER,
  goalkeeper_saves      INTEGER,
  xg                    DECIMAL(5,3),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_statistics_match ON match_statistics(match_id);
CREATE INDEX IF NOT EXISTS idx_statistics_team ON match_statistics(team_id);

-- ============================================================
-- LINEUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS lineups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id),
  formation     VARCHAR(20),
  start_xi      JSONB DEFAULT '[]',
  substitutes   JSONB DEFAULT '[]',
  coach         JSONB,
  is_confirmed  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_lineups_match ON lineups(match_id);

-- ============================================================
-- INJURIES & SUSPENSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS injuries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id     UUID REFERENCES players(id),
  team_id       UUID NOT NULL REFERENCES teams(id),
  league_id     UUID REFERENCES leagues(id),
  match_id      UUID REFERENCES matches(id),
  player_name   VARCHAR(150),
  player_photo  TEXT,
  type          VARCHAR(100),   -- 'Injury' or 'Suspension'
  reason        TEXT,
  date          DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injuries_team ON injuries(team_id);
CREATE INDEX IF NOT EXISTS idx_injuries_match ON injuries(match_id);
CREATE INDEX IF NOT EXISTS idx_injuries_player ON injuries(player_id);

-- ============================================================
-- TEAM RATINGS (Elo + Attack/Defense)
-- ============================================================
CREATE TABLE IF NOT EXISTS team_ratings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  league_id       UUID REFERENCES leagues(id),
  elo_rating      DECIMAL(8,2) DEFAULT 1500,
  attack_rating   DECIMAL(5,3),    -- Normalized attack strength
  defense_rating  DECIMAL(5,3),    -- Normalized defense strength
  home_elo        DECIMAL(8,2),
  away_elo        DECIMAL(8,2),
  matches_played  INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, COALESCE(league_id::TEXT, 'global'))
);

CREATE INDEX IF NOT EXISTS idx_ratings_team ON team_ratings(team_id);

-- ============================================================
-- TEAM RATING HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS team_rating_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id),
  elo_before      DECIMAL(8,2),
  elo_after       DECIMAL(8,2),
  elo_change      DECIMAL(6,2),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_history_team ON team_rating_history(team_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_match ON team_rating_history(match_id);

-- ============================================================
-- TEAM FORM (cached form calculations)
-- ============================================================
CREATE TABLE IF NOT EXISTS team_form (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id           UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  league_id         UUID REFERENCES leagues(id),
  form_string       VARCHAR(10),     -- e.g. "WDWLW"
  win_rate          DECIMAL(5,4),
  draw_rate         DECIMAL(5,4),
  loss_rate         DECIMAL(5,4),
  avg_goals_for     DECIMAL(5,3),
  avg_goals_against DECIMAL(5,3),
  avg_xg_for        DECIMAL(5,3),
  avg_xg_against    DECIMAL(5,3),
  form_score        DECIMAL(5,4),
  matches_used      INTEGER,
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, COALESCE(league_id::TEXT, 'all'))
);

CREATE INDEX IF NOT EXISTS idx_form_team ON team_form(team_id);

-- ============================================================
-- STANDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS standings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id       UUID REFERENCES seasons(id),
  team_id         UUID NOT NULL REFERENCES teams(id),
  rank            INTEGER NOT NULL,
  points          INTEGER DEFAULT 0,
  goals_diff      INTEGER DEFAULT 0,
  form            VARCHAR(15),
  status          VARCHAR(50),
  description     VARCHAR(100),
  played_total    INTEGER DEFAULT 0,
  win_total       INTEGER DEFAULT 0,
  draw_total      INTEGER DEFAULT 0,
  lose_total      INTEGER DEFAULT 0,
  goals_for       INTEGER DEFAULT 0,
  goals_against   INTEGER DEFAULT 0,
  played_home     INTEGER DEFAULT 0,
  played_away     INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, season_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_league ON standings(league_id);
CREATE INDEX IF NOT EXISTS idx_standings_team ON standings(team_id);

-- ============================================================
-- ODDS
-- ============================================================
CREATE TABLE IF NOT EXISTS odds (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker_id  INTEGER,
  bookmaker_name VARCHAR(100),
  market        VARCHAR(100),   -- '1X2', 'Over/Under', 'BTTS'
  outcome       VARCHAR(50),    -- 'Home', 'Draw', 'Away', 'Over 2.5', etc.
  value         DECIMAL(10,4),  -- Decimal odds
  implied_prob  DECIMAL(6,4),   -- 1/odds (overround included)
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odds_match ON odds(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_market ON odds(match_id, market);

-- ============================================================
-- PREDICTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  model_version       VARCHAR(50) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'signal',  -- signal, no_signal
  no_signal_reason    VARCHAR(100),

  -- 1X2
  prob_home           DECIMAL(6,4),
  prob_draw           DECIMAL(6,4),
  prob_away           DECIMAL(6,4),

  -- Goals markets
  over_0_5            DECIMAL(6,4),
  over_1_5            DECIMAL(6,4),
  over_2_5            DECIMAL(6,4),
  over_3_5            DECIMAL(6,4),
  under_2_5           DECIMAL(6,4),
  under_3_5           DECIMAL(6,4),

  -- BTTS
  btts_yes            DECIMAL(6,4),
  btts_no             DECIMAL(6,4),

  -- Expected goals
  xg_home             DECIMAL(5,3),
  xg_away             DECIMAL(5,3),

  -- Top exact scores (JSON)
  exact_scores        JSONB,

  -- Model breakdown
  components          JSONB,
  adjustments         JSONB,
  model_agreement     JSONB,

  confidence          VARCHAR(20),   -- very_high, high, medium, low, no_signal
  data_quality_label  VARCHAR(20),
  data_quality_score  DECIMAL(4,3),

  lineup_status       VARCHAR(50),   -- both_confirmed, both_predicted, etc.
  is_lineup_adjusted  BOOLEAN DEFAULT FALSE,

  predicted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_model ON predictions(model_version);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions(predicted_at);
CREATE INDEX IF NOT EXISTS idx_predictions_confidence ON predictions(confidence);

-- ============================================================
-- PREDICTION RESULTS (after match finishes)
-- ============================================================
CREATE TABLE IF NOT EXISTS prediction_results (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id     UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  actual_home_goals INTEGER NOT NULL,
  actual_away_goals INTEGER NOT NULL,
  actual_outcome    VARCHAR(10) NOT NULL,  -- 'home', 'draw', 'away'
  predicted_outcome VARCHAR(10),
  correct           BOOLEAN,
  brier_score       DECIMAL(8,6),
  log_loss          DECIMAL(8,6),
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pred_results_prediction ON prediction_results(prediction_id);
CREATE INDEX IF NOT EXISTS idx_pred_results_match ON prediction_results(match_id);
CREATE INDEX IF NOT EXISTS idx_pred_results_correct ON prediction_results(correct);

-- ============================================================
-- MODEL METRICS (aggregated accuracy stats)
-- ============================================================
CREATE TABLE IF NOT EXISTS model_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_version   VARCHAR(50) NOT NULL,
  league_id       UUID REFERENCES leagues(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  sample_size     INTEGER NOT NULL DEFAULT 0,
  accuracy        DECIMAL(6,4),
  brier_score     DECIMAL(8,6),
  log_loss        DECIMAL(8,6),
  calibration_err DECIMAL(6,4),
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_model ON model_metrics(model_version);
CREATE INDEX IF NOT EXISTS idx_metrics_league ON model_metrics(league_id);

-- ============================================================
-- BACKTEST RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS backtest_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_version VARCHAR(50) NOT NULL,
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  league_ids    UUID[],
  sample_size   INTEGER DEFAULT 0,
  accuracy      DECIMAL(6,4),
  brier_score   DECIMAL(8,6),
  log_loss      DECIMAL(8,6),
  calibration   JSONB,
  status        VARCHAR(20) DEFAULT 'running',  -- running, complete, failed
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ============================================================
-- PROVIDER LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider      VARCHAR(50) NOT NULL,
  endpoint      VARCHAR(200),
  status        VARCHAR(20) NOT NULL,  -- 'success', 'error', 'rate_limited'
  response_time INTEGER,               -- ms
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_logs_provider ON provider_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_logs_status ON provider_logs(status);
CREATE INDEX IF NOT EXISTS idx_provider_logs_date ON provider_logs(logged_at);

-- ============================================================
-- XG STATISTICS (separate from match statistics)
-- ============================================================
CREATE TABLE IF NOT EXISTS xg_statistics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES teams(id),
  is_home         BOOLEAN NOT NULL,
  xg              DECIMAL(5,3),
  xg_first_half   DECIMAL(5,3),
  xg_second_half  DECIMAL(5,3),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

-- ============================================================
-- FAVORITES (localStorage sync backup, no auth required)
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    VARCHAR(100),    -- Anonymous session token from client
  type          VARCHAR(20) NOT NULL,  -- 'team', 'league', 'match'
  entity_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_favorites_session ON favorites(session_id);
CREATE INDEX IF NOT EXISTS idx_favorites_entity ON favorites(type, entity_id);

-- ============================================================
-- HELPER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_lineups_updated_at
  BEFORE UPDATE ON lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INITIAL DATA: Top monitored leagues
-- ============================================================
INSERT INTO leagues (provider_id, name, type, country, country_code, priority, current_season)
VALUES
  ('39',  'Premier League',          'League', 'England',   'GB',  10, 2025),
  ('140', 'La Liga',                 'League', 'Spain',     'ES',  10, 2025),
  ('78',  'Bundesliga',              'League', 'Germany',   'DE',  10, 2025),
  ('135', 'Serie A',                 'League', 'Italy',     'IT',  10, 2025),
  ('61',  'Ligue 1',                 'League', 'France',    'FR',  10, 2025),
  ('2',   'UEFA Champions League',   'Cup',    'World',     null,  5,  2025),
  ('3',   'UEFA Europa League',      'Cup',    'World',     null,  6,  2025),
  ('848', 'UEFA Conference League',  'Cup',    'World',     null,  7,  2025),
  ('88',  'Eredivisie',              'League', 'Netherlands','NL', 20, 2025),
  ('94',  'Primeira Liga',           'League', 'Portugal',  'PT',  20, 2025)
ON CONFLICT (provider_id, provider_name) DO NOTHING;
