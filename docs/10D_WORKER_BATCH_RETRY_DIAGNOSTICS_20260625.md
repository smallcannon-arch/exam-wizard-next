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

## Upstream Error Classification Follow-up

The first Chinese 50-item smoke after the option contract gate deploy failed at 4/50 with:

- Error code: `GEMINI_UPSTREAM_ERROR`
- Batches: 1 completed / 1 failed_terminal / 11 queued
- Finish reason: unavailable for the failed batch
- Diagnostics: present for the completed batch only

This indicates an upstream Gemini/API failure before normal model output was available. It did not exercise the option contract gate.

Decision for the small follow-up:

- Split upstream failures into safe error codes using HTTP status metadata:
  - `GEMINI_RATE_LIMIT` for HTTP 429.
  - `GEMINI_UPSTREAM_SERVER_ERROR` for HTTP 5xx.
  - `GEMINI_NETWORK_ERROR` for fetch/network failures without an upstream status.
  - `GEMINI_UPSTREAM_REQUEST_ERROR` for non-429 HTTP 4xx.
- Store only safe `upstream_status` metadata for batch diagnostics.
- Do not store raw Gemini response bodies, raw prompts, raw model output, API keys, tokens, headers, or stack traces.
- Retry only transient upstream errors:
  - HTTP 429 with backoff and jitter.
  - HTTP 5xx with backoff and jitter.
  - Network failure with backoff and jitter.
- Keep the maximum batch retry count bounded.
- Do not retry:
  - timeout
  - hard truncation
  - JSON truncation from `finishReason: MAX_TOKENS`
  - qualityMeta missing
  - output contract invalid
  - non-429 HTTP 4xx

Backoff with jitter is required for upstream retry because immediate or synchronized retry may hit the same rate-limit window. This differs from malformed JSON retry, which can retry immediately because it depends on a new sampling path.

## Partial Result Trigger Expansion

Partial results remain out of scope for the upstream classification fix. They still require a result contract and frontend behavior change.

The upstream failure adds another partial-result signal: a single transient failed batch can fail the entire 50-item job and leave later batches queued. Reconsider partial result support if either condition is met after transient retry is deployed:

- job-level pass rate remains below 95% across at least 15 fresh 50-item observations; or
- repeated parse failures or repeated upstream transient failures continue to fail otherwise usable jobs after bounded retry.

## 50-item Reliability Meta Gate

The 50-item path has now exposed several distinct failure modes: parse failure, diagnostics persistence gaps, observation script encoding, option contract drift, and upstream API failure.

After upstream classification and transient retry are deployed, run fresh Chinese 50-item smoke observations before restarting the full baseline. If the next 3 Chinese 50-item observations each expose a new, previously unseen failure mode, pause the patch-by-patch loop and reassess the broader 50-item reliability strategy, including:

- batch size
- batch concurrency
- partial result contract
- dependency on Gemini single-call behavior per batch

If the next observations converge without new failure classes, continue the baseline collection.

## Contract Violation Diagnostics Follow-up

After upstream classification was deployed, fresh 50-item observations showed `AI_OUTPUT_CONTRACT_INVALID` across more than one subject. The current error code is safe but too coarse: it cannot distinguish option count drift, answer code drift, distractorDesign key drift, missing wrong-option design, or missing required distractorDesign fields.

Decision for the next small follow-up:

- Do not add contract-invalid retry yet.
- Do not change prompt, schema, frontend, or partial result contract in this step.
- Store safe contract violation metadata only:
  - controlled violation type enum
  - controlled violation type set
  - 1-based item index
  - controlled field name
  - sanitized option code when relevant
- Do not store raw prompt, raw model output, full item text, full option text, full distractorDesign text, API keys, tokens, headers, or stack traces.
- Use a new additive nullable D1 migration so old batch rows remain readable.

Use the next observed contract-invalid samples to decide between:

- prompt constraint hardening, if violations concentrate in one repeated type;
- bounded contract retry, if violations are scattered and appear random;
- partial result support, if all-or-nothing reliability remains below the accepted threshold.

Collect 3-5 contract-invalid samples with safe violation types before choosing the next fix path.
