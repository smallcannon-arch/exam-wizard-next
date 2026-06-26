-- Allow async generation jobs to persist terminal partial results.
-- SQLite/D1 cannot alter an existing CHECK constraint in place, so this rebuilds
-- generation_jobs with the same columns and indexes while adding 'partial' to
-- the status allowlist.
--
-- generation_job_batches references generation_jobs with ON DELETE CASCADE, so
-- this migration backs up and restores batch rows around the parent-table
-- rebuild. It intentionally preserves all existing job and batch rows.

PRAGMA defer_foreign_keys = ON;

DROP TABLE IF EXISTS generation_job_batches_0005_backup;

CREATE TABLE generation_job_batches_0005_backup (
  job_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  expected_item_count INTEGER NOT NULL,
  completed_item_count INTEGER NOT NULL,
  retry_count INTEGER NOT NULL,
  error_code TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  finish_reason TEXT,
  output_length INTEGER,
  json_candidate_length INTEGER,
  json_classification_source TEXT,
  upstream_status INTEGER,
  contract_violation_type TEXT,
  contract_violation_types TEXT,
  contract_violation_item_index INTEGER,
  contract_violation_field TEXT,
  contract_violation_option_code TEXT
);

INSERT INTO generation_job_batches_0005_backup (
  job_id,
  batch_number,
  status,
  expected_item_count,
  completed_item_count,
  retry_count,
  error_code,
  latency_ms,
  created_at,
  updated_at,
  started_at,
  completed_at,
  failed_at,
  finish_reason,
  output_length,
  json_candidate_length,
  json_classification_source,
  upstream_status,
  contract_violation_type,
  contract_violation_types,
  contract_violation_item_index,
  contract_violation_field,
  contract_violation_option_code
)
SELECT
  job_id,
  batch_number,
  status,
  expected_item_count,
  completed_item_count,
  retry_count,
  error_code,
  latency_ms,
  created_at,
  updated_at,
  started_at,
  completed_at,
  failed_at,
  finish_reason,
  output_length,
  json_candidate_length,
  json_classification_source,
  upstream_status,
  contract_violation_type,
  contract_violation_types,
  contract_violation_item_index,
  contract_violation_field,
  contract_violation_option_code
FROM generation_job_batches;

CREATE TABLE generation_jobs_new (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'validating',
      'completed',
      'partial',
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

INSERT INTO generation_jobs_new (
  job_id,
  status,
  requested_item_count,
  batch_size,
  batch_count,
  completed_batch_count,
  completed_item_count,
  current_batch,
  error_code,
  result_item_count,
  result_json,
  created_at,
  updated_at,
  completed_at,
  failed_at,
  expires_at
)
SELECT
  job_id,
  status,
  requested_item_count,
  batch_size,
  batch_count,
  completed_batch_count,
  completed_item_count,
  current_batch,
  error_code,
  result_item_count,
  result_json,
  created_at,
  updated_at,
  completed_at,
  failed_at,
  expires_at
FROM generation_jobs;

DROP TABLE generation_jobs;

ALTER TABLE generation_jobs_new RENAME TO generation_jobs;

DELETE FROM generation_job_batches;

INSERT INTO generation_job_batches (
  job_id,
  batch_number,
  status,
  expected_item_count,
  completed_item_count,
  retry_count,
  error_code,
  latency_ms,
  created_at,
  updated_at,
  started_at,
  completed_at,
  failed_at,
  finish_reason,
  output_length,
  json_candidate_length,
  json_classification_source,
  upstream_status,
  contract_violation_type,
  contract_violation_types,
  contract_violation_item_index,
  contract_violation_field,
  contract_violation_option_code
)
SELECT
  job_id,
  batch_number,
  status,
  expected_item_count,
  completed_item_count,
  retry_count,
  error_code,
  latency_ms,
  created_at,
  updated_at,
  started_at,
  completed_at,
  failed_at,
  finish_reason,
  output_length,
  json_candidate_length,
  json_classification_source,
  upstream_status,
  contract_violation_type,
  contract_violation_types,
  contract_violation_item_index,
  contract_violation_field,
  contract_violation_option_code
FROM generation_job_batches_0005_backup;

DROP TABLE generation_job_batches_0005_backup;

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created
  ON generation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_expires_at
  ON generation_jobs(expires_at);
