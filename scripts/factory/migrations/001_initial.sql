PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  mic TEXT NOT NULL UNIQUE,
  country TEXT,
  currency TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instruments (
  id INTEGER PRIMARY KEY,
  company TEXT NOT NULL,
  ticker TEXT NOT NULL,
  isin TEXT NOT NULL UNIQUE,
  mic TEXT NOT NULL,
  market_id INTEGER NOT NULL REFERENCES markets(id),
  index_group TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  provider_symbol TEXT,
  identity_source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_prices (
  instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  trading_date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume INTEGER,
  adjusted_close REAL,
  provider TEXT NOT NULL,
  provider_metadata TEXT,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (instrument_id, trading_date)
);

CREATE TABLE IF NOT EXISTS history_status (
  instrument_id INTEGER PRIMARY KEY REFERENCES instruments(id) ON DELETE CASCADE,
  first_available_date TEXT,
  last_available_date TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'MISSING',
  last_checked TEXT,
  error TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  checkpoint TEXT,
  error_summary TEXT,
  requested_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_items (
  id INTEGER PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_date TEXT,
  last_date TEXT,
  records_added INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (job_id, instrument_id)
);

CREATE TABLE IF NOT EXISTS scheduler_runs (
  schedule_key TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instruments_market ON instruments(market_id, active);
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(trading_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_job_items_status ON job_items(job_id, status);
