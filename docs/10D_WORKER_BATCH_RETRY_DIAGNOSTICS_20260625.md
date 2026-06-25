# Worker Batch Retry and Safe Parse Diagnostics

## Background

The 50-item replication baseline found one hard failure:

- Subject: Chinese
- Requested count: 50
- Completed before failure: 36/50
- Failed batch: 10
- Error code: `AI_JSON_PARSE_FAILED`

The production schema intentionally does not store raw prompts, raw model output, API keys, tokens, headers, or stack traces. This is the correct safety boundary. The fix should improve safe diagnostics and recovery without storing raw model output.

## Idempotency Check

Batch retry is safe to implement because the async generation flow does not persist item payloads per batch. Successful batch items are kept in workflow memory and are only written to `generation_jobs.result_json` after all batches pass final validation.

Per-batch database writes currently store status, item count, latency, retry count, and error code metadata. A failed parse attempt therefore cannot leave partial item payloads that would be duplicated by a retry.

## Implemented Decision

- Add safe JSON parse classification:
  - `AI_JSON_NO_OBJECT`
  - `AI_JSON_PARSE_FAILED`
  - `AI_JSON_TRUNCATED`
- Use Gemini `finishReason: MAX_TOKENS` as hard evidence for `AI_JSON_TRUNCATED`.
- Do not label heuristic truncation as hard truncation without `finishReason`.
- Retry only retryable parse failures at the batch level.
- Maximum retry count: 1.
- Do not retry hard truncation.
- Do not retry qualityMeta, item contract, timeout, or output contract failures.
- Keep frontend whole-job retry from retrying the new JSON parse error codes.

## Not Included

- No raw prompt storage.
- No raw model output storage.
- No API key, token, header, or stack trace storage.
- No prompt changes.
- No schema contract changes.
- No frontend UI change.
- No partial result contract.
- No deploy.

## Partial Result Follow-up Gate

Partial results remain out of scope for this small fix because they would change the result contract and frontend behavior.

Reconsider partial result support if, after this retry fix is deployed and re-observed, the 50-item job-level pass rate remains below 95% across at least 15 fresh 50-item observations, or if repeated single-batch failures still cause otherwise usable 46-49 item jobs to fail.

## Validation Plan

- Parser regression tests for fenced and prose-wrapped JSON.
- JSON error classification tests.
- Worker batch retry tests:
  - malformed JSON succeeds after one retry
  - hard truncation is not retried
  - retry exhaustion fails safely
- Leakage tests ensure errors do not expose raw prompt, raw output, API key, token, headers, or stack traces.

## After-Deploy Observation

The previous 88.9% pass-rate baseline was measured before batch retry. It must not be used as the post-retry success rate.

After deployment, run a fresh 50-item after-retry baseline and compare:

- job-level pass rate
- per-subject pass rate
- latency p50 / max
- retry count
- failure error code distribution
- leakage findings

## Completed-but-invalid Contract Gate Follow-up

The first UTF-8-safe Chinese 50-item observation after diagnostics persistence completed at the Worker layer but failed v2 validation because one item produced an option outside the A/B/C/D contract.

Decision for the small follow-up:

- Add a Worker minimum gate for choice items:
  - options must contain exactly A/B/C/D.
  - answer must be A/B/C/D.
  - `qualityMeta.distractorDesign` keys must be wrong option codes only.
  - each wrong option must have the required distractorDesign fields.
- Do not retry this output contract failure in the batch retry path.
- Mark the batch/job as failed instead of completed when this contract is violated.

Out of scope for this small follow-up:

- Full parity between the Worker gate and frontend v2 validation.
- Partial result support.
- Prompt changes.

Reconsider a fuller Worker/frontend validation alignment if another distinct completed-but-invalid contract class appears after this minimum gate is deployed.
