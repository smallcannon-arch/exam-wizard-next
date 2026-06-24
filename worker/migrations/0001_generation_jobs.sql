-- Async generation job metadata for up-to-50-item generation.
-- This schema intentionally stores only safe metadata and normalized results.
-- It must not store raw prompts, raw model output, API keys, tokens, headers, or stack traces.

CREATE TABLE IF NOT EXISTS generation_jobs (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'validating',
      'completed',
      'failed',
      'partial_failed',
      'expired'
    )
  ),
  requested_item_count INTEGER NOT NULL CHECK (requested_item_count BETWEEN 1 AND 50),
  batch_size INTEGER NOT NULL CHECK (batch_size BETWEEN 1 AND 10),
  batch_count INTEGER NOT NULL CHECK (batch_count >= 1),
  completed_batch_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_batch_count >= 0),
  completed_item_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_item_count >= 0),
  current_batch INTEGER CHECK (current_batch IS NULL OR current_batch >= 1),
  error_code TEXT,
  result_item_count INTEGER CHECK (result_item_count IS NULL OR result_item_count >= 0),
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  failed_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS generation_job_batches (
  job_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL CHECK (batch_number >= 1),
  status TEXT NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'validating',
      'completed',
      'failed_retryable',
      'failed_terminal'
    )
  ),
  expected_item_count INTEGER NOT NULL CHECK (expected_item_count BETWEEN 1 AND 10),
  completed_item_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_item_count >= 0),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  error_code TEXT,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  PRIMARY KEY (job_id, batch_number),
  FOREIGN KEY (job_id) REFERENCES generation_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created
  ON generation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_expires_at
  ON generation_jobs(expires_at);

CREATE INDEX IF NOT EXISTS idx_generation_job_batches_status
  ON generation_job_batches(job_id, status);
