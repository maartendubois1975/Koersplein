PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS markets (
  mic TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  exchange_group TEXT,
  country_code TEXT,
  currency TEXT,
  timezone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instruments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isin TEXT NOT NULL UNIQUE,
  mic TEXT NOT NULL REFERENCES markets(mic),
  ticker TEXT NOT NULL,
  company TEXT NOT NULL,
  country_code TEXT,
  sector TEXT,
  index_group TEXT,
  currency TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mic, ticker)
);
CREATE INDEX IF NOT EXISTS idx_instruments_market ON instruments(mic, active);
CREATE INDEX IF NOT EXISTS idx_instruments_group ON instruments(mic, index_group);

CREATE TABLE IF NOT EXISTS latest_prices (
  instrument_id INTEGER PRIMARY KEY REFERENCES instruments(id),
  trading_date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume INTEGER,
  adjusted_close REAL,
  provider TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history_status (
  instrument_id INTEGER PRIMARY KEY REFERENCES instruments(id),
  status TEXT NOT NULL DEFAULT 'NOT_LOADED',
  first_date TEXT,
  last_date TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  storage_format TEXT,
  manifest_key TEXT,
  last_checked TEXT,
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_history_status_state ON history_status(status);

CREATE TABLE IF NOT EXISTS history_partitions (
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  period TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  record_count INTEGER NOT NULL,
  first_date TEXT NOT NULL,
  last_date TEXT NOT NULL,
  provider TEXT NOT NULL,
  checksum TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(instrument_id, period)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('HISTORY_BACKFILL','DAILY_UPDATE','REPAIR_MISSING','VALIDATE_HISTORY','CHECK_AMSTERDAM')),
  mic TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  checkpoint TEXT,
  error_summary TEXT,
  requested_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);

CREATE TABLE IF NOT EXISTS job_items (
  job_id TEXT NOT NULL REFERENCES jobs(id),
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  records_added INTEGER NOT NULL DEFAULT 0,
  first_date TEXT,
  last_date TEXT,
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  PRIMARY KEY(job_id, instrument_id)
);
CREATE INDEX IF NOT EXISTS idx_job_items_queue ON job_items(job_id, status, instrument_id);

CREATE TABLE IF NOT EXISTS scheduler_runs (
  schedule_key TEXT PRIMARY KEY,
  last_date TEXT NOT NULL,
  last_job_id TEXT,
  updated_at TEXT NOT NULL
);
