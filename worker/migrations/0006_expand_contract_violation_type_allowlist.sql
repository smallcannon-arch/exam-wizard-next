-- Expand safe contract violation diagnostics for typed question contracts.
-- Rebuilds generation_job_batches because SQLite/D1 cannot alter an existing
-- CHECK constraint in place. This preserves all existing batch rows and keeps
-- diagnostics limited to controlled metadata only.

PRAGMA defer_foreign_keys = ON;

DROP TABLE IF EXISTS generation_job_batches_new;

CREATE TABLE generation_job_batches_new (
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
  finish_reason TEXT,
  output_length INTEGER CHECK (output_length IS NULL OR output_length >= 0),
  json_candidate_length INTEGER CHECK (json_candidate_length IS NULL OR json_candidate_length >= 0),
  json_classification_source TEXT CHECK (
    json_classification_source IS NULL
    OR json_classification_source IN ('none', 'parser', 'finish_reason')
  ),
  upstream_status INTEGER CHECK (
    upstream_status IS NULL
    OR upstream_status BETWEEN 100 AND 599
  ),
  contract_violation_type TEXT CHECK (
    contract_violation_type IS NULL
    OR contract_violation_type IN (
      'QUESTION_TYPE_MISSING',
      'QUESTION_TYPE_MISMATCH',
      'OPTIONS_COUNT_INVALID',
      'OPTIONS_TEXT_INVALID',
      'ANSWER_CODE_INVALID',
      'TRUE_FALSE_OPTIONS_INVALID',
      'TRUE_FALSE_ANSWER_INVALID',
      'FILL_IN_OPTIONS_INVALID',
      'FILL_IN_ANSWER_INVALID',
      'ACCEPTED_ANSWERS_INVALID',
      'DISTRACTOR_KEY_INVALID',
      'DISTRACTOR_CORRECT_ANSWER_INCLUDED',
      'DISTRACTOR_MISSING_WRONG_OPTION',
      'DISTRACTOR_REQUIRED_FIELD_MISSING',
      'GROUP_STIMULUS_INVALID'
    )
  ),
  contract_violation_types TEXT,
  contract_violation_item_index INTEGER CHECK (
    contract_violation_item_index IS NULL
    OR contract_violation_item_index > 0
  ),
  contract_violation_field TEXT CHECK (
    contract_violation_field IS NULL
    OR contract_violation_field IN (
      'questionType',
      'options',
      'answer',
      'correctAnswer',
      'acceptedAnswers',
      'groupId',
      'stimulus',
      'qualityMeta.distractorDesign',
      'misconceptionTag',
      'misconceptionDescription',
      'whyStudentsMayChooseIt',
      'whyItIsWrong',
      'revisionNote'
    )
  ),
  contract_violation_option_code TEXT CHECK (
    contract_violation_option_code IS NULL
    OR contract_violation_option_code IN (
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
      'U', 'V', 'W', 'X', 'Y', 'Z', 'OTHER'
    )
  ),
  PRIMARY KEY (job_id, batch_number),
  FOREIGN KEY (job_id) REFERENCES generation_jobs(job_id) ON DELETE CASCADE
);

INSERT INTO generation_job_batches_new (
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

DROP TABLE generation_job_batches;

ALTER TABLE generation_job_batches_new RENAME TO generation_job_batches;

CREATE INDEX IF NOT EXISTS idx_generation_job_batches_status
  ON generation_job_batches(job_id, status);
