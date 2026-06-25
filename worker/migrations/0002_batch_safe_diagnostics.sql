-- Safe per-batch parse diagnostics for async generation.
-- These columns intentionally store only metadata, never raw prompts, raw model output,
-- API keys, tokens, headers, or stack traces.

ALTER TABLE generation_job_batches
  ADD COLUMN finish_reason TEXT;

ALTER TABLE generation_job_batches
  ADD COLUMN output_length INTEGER CHECK (output_length IS NULL OR output_length >= 0);

ALTER TABLE generation_job_batches
  ADD COLUMN json_candidate_length INTEGER CHECK (json_candidate_length IS NULL OR json_candidate_length >= 0);

ALTER TABLE generation_job_batches
  ADD COLUMN json_classification_source TEXT CHECK (
    json_classification_source IS NULL
    OR json_classification_source IN ('none', 'parser', 'finish_reason')
  );
