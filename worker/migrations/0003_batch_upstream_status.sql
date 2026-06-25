-- Safe upstream diagnostics for async generation.
-- Stores only HTTP status metadata, never raw response bodies, prompts, model output,
-- API keys, tokens, headers, or stack traces.

ALTER TABLE generation_job_batches
  ADD COLUMN upstream_status INTEGER CHECK (
    upstream_status IS NULL
    OR upstream_status BETWEEN 100 AND 599
  );
