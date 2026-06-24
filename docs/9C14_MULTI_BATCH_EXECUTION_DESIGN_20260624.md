# 9C-14 Workflow Multi-Batch Execution Design

Date: 2026-06-24

Status: design proposal.

This document defines the recommended multi-batch execution behavior after the 9C-13 single-batch Workflow executor. It is a design artifact only. It does not change product code, prompt, schema, Worker API, frontend UI, deployment workflow, npm audit state, `tmp/`, or stash.

## 1. Background

The async generation path has reached these milestones:

- 9C-12 added a Cloudflare Workflows skeleton without Gemini calls.
- 9C-13 added a production-proven single-batch executor.
- The 9C-13 production smoke completed one single-batch job successfully.
- The current executor intentionally fails multi-batch jobs with `ASYNC_BATCH_UNSUPPORTED`.

The next target is a sequential multi-batch executor that can move the system toward stable 50-item generation without reintroducing one large synchronous API call.

## 2. Design Inputs

Relevant Cloudflare Workflows constraints:

- Workflow steps are self-contained and individually retryable.
- Workflow steps should be granular and idempotent.
- Workflow in-memory state cannot be treated as durable state across hibernation.
- Non-stream step return values should stay under 1 MiB.
- Workflow event payload size is 1 MiB.
- Persisted state per Workflow instance is limited, so large or long-lived artifacts should be stored externally or represented by a reference.
- Step timeouts should be 30 minutes or less.

References:

- Cloudflare Workflows rules: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
- Cloudflare Workflows limits: https://developers.cloudflare.com/workflows/reference/limits/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/

## 3. Goals

Support sequential multi-batch generation with:

- Safe progress updates in D1.
- Batch-level failure isolation.
- No raw prompt or raw output persistence.
- Final normalized items stored only after safe parsing and minimum contract gates.
- No user-facing partial result import in the MVP.
- A clear path to 50-item observations through controlled ramps.

## 4. Non-goals

This design does not include:

- Parallel batch execution.
- Partial result UI.
- Result retrieval endpoint implementation.
- Frontend async polling implementation.
- Prompt changes.
- Schema changes.
- Pages deploy.
- Worker deploy.
- npm audit work.
- PR #3 work.

## 5. Recommended Execution Model

Use a sequential loop over the existing batch plan:

```text
Workflow instance
  -> mark job running
  -> for each batch in plan.batches:
       mark batch running
       call Gemini for that batch
       parse JSON safely
       assert minimum Worker output contract
       normalize items
       append successful normalized items to accumulated result
       update D1 progress
  -> verify final item count
  -> store final normalized result_json
  -> mark job completed
```

Initial behavior:

| Setting | Recommendation |
| --- | --- |
| Batch size | 4 items |
| Concurrency | 1 |
| Max requested count | Keep existing configured max; design for 50 |
| Per-batch timeout | 300 seconds unless separately changed |
| Retry | None in first multi-batch implementation, or one bounded transient retry only if implemented in the same small PR |
| Partial result import | Not allowed |

The safest next implementation is **sequential multi-batch without automatic retry**. Retry policy can be added after the first two-batch production smoke proves the loop and state transitions.

## 6. D1 State Updates

D1 remains the public status source.

Recommended updates after each successful batch:

- job `status = running`
- `completed_batch_count += 1`
- `completed_item_count += batch item count`
- `current_batch = next batch index`
- batch `status = completed`
- batch latency summary

Recommended final update:

- job `status = completed`
- `completed_batch_count = batch_count`
- `completed_item_count = requested_item_count`
- `current_batch = null`
- `result_json` stores normalized final items

The implementation should avoid depending on mutable in-memory arrays as the only source of truth. Accumulated items may be built from step returns during normal execution, but successful batch progress should also be persisted in D1 so that status remains truthful if the Workflow hibernates or fails later.

## 7. Result JSON Shape

The existing 9C-13 result shape stores:

```json
{
  "items": []
}
```

For 9C-14, keep the completed result shape compatible:

```json
{
  "items": [],
  "batchCount": 3,
  "completedBatchCount": 3,
  "partial": false
}
```

If a batch fails after earlier batches completed, do not mark the job completed. The MVP should either:

1. keep `result_json` empty until all batches complete, or
2. store partial normalized items with `partial: true` while keeping job status as `partial_failed` or `failed`.

Recommendation for the first implementation: **store final `result_json` only after all batches pass**. This avoids creating a partial-result contract before the frontend can safely explain or import partial results.

## 8. Failure Policy

Terminal failure behavior:

| Failure | Job status | Batch status | Retry? | Notes |
| --- | --- | --- | --- | --- |
| Gemini upstream error | `failed` | `failed_retryable` or `failed_terminal` | Later | First MVP may fail without retry. |
| `AI_EMPTY_RESPONSE` | `failed` | `failed_retryable` or `failed_terminal` | Later | Keep raw output absent. |
| `GEMINI_TIMEOUT` | `failed` | `failed_terminal` | No by default | Retrying a 300s timeout can double cost. |
| `AI_JSON_PARSE_FAILED` | `failed` | `failed_terminal` | No for MVP | Treat as model/output contract issue. |
| `AI_ITEMS_PAYLOAD_INVALID` | `failed` | `failed_terminal` | No | Contract failure. |
| `AI_QUALITY_META_MISSING` | `failed` | `failed_terminal` | No | Contract failure. |
| `AI_OUTPUT_CONTRACT_INVALID` | `failed` | `failed_terminal` | No | Contract failure. |

If retry is implemented later, it should be one retry per batch for transient upstream/empty-response failures only. The retry must update safe metadata and must not persist raw prompt or raw output.

## 9. Partial Success Policy

Do not expose partial successful batches to the main paper UI in the MVP.

Reasons:

- The frontend does not yet have partial-review UX.
- A partial paper could confuse teachers if later slots are missing.
- Validation and leakage checks are easier to reason about with all-or-nothing import.
- Partial import would introduce a separate rollback and edit-history concern.

Allowed internal behavior:

- D1 may show completed batch counts.
- D1 may store safe failed batch status and safe `error_code`.
- D1 may store final normalized items only when the whole job completes.

Future partial-review mode should be a separate design decision.

## 10. Progress Contract

`GET /generation-jobs/:jobId` should remain safe and derived:

```json
{
  "ok": true,
  "jobId": "gen_...",
  "status": "running",
  "requestedItemCount": 12,
  "batchCount": 3,
  "completedBatchCount": 1,
  "completedItemCount": 4,
  "currentBatch": 2,
  "errorCode": null
}
```

Do not return:

- raw prompt
- raw output
- source material text
- API key
- token
- request headers
- stack trace
- full Gemini error body

## 11. Storage Boundary

D1 may store:

- job id
- status
- requested item count
- batch count
- completed batch count
- completed item count
- current batch
- safe error code
- latency summaries
- timestamps
- final normalized items after success

D1 must not store:

- raw prompt
- raw output
- source material text
- full Gemini response
- API key
- token
- headers
- stack trace

Workflow params may contain request material during execution according to the accepted 9C-11 decision.

## 12. Implementation Split

Recommended next implementation split:

### 9C-14A: Sequential multi-batch executor

Scope:

- Remove the `ASYNC_BATCH_UNSUPPORTED` hard stop.
- Loop through batches sequentially.
- Reuse existing Gemini/prompt/parse/quality gate helpers.
- Update D1 after each batch.
- Store final result only when all batches pass.
- No retry.
- No result endpoint.
- No frontend async UI.
- No deploy in the PR.

### 9C-14B: Controlled production smoke

Scope:

- Deploy Worker only after review.
- Create one two-batch job, likely 5-8 items.
- Record summarized latency, batch completion, validation, and safe status only.
- No raw prompt/output persistence.

### 9C-14C: Retry policy

Scope:

- Add one retry for selected transient failures only.
- Keep timeout and contract failures terminal.
- Add tests for retry metadata and no raw leakage.

### 9C-15: Result endpoint and frontend async polling

Scope:

- Add safe result retrieval for completed jobs.
- Add frontend polling UI.
- Keep partial result behavior out unless separately approved.

## 13. Tests Required for 9C-14A

Minimum tests:

1. Multi-batch plan completes all batches sequentially.
2. D1 job progress updates after each batch.
3. Final `result_json` includes all normalized items in order.
4. Generated item count mismatch fails safely.
5. Batch 2 failure leaves job failed and does not mark final completion.
6. Contract failure stores safe `error_code`.
7. Multi-batch status response contains safe progress only.
8. No raw prompt, raw output, API key, token, headers, or stack trace appear in failure responses.
9. Existing single-batch behavior still passes.
10. `ASYNC_BATCH_UNSUPPORTED` is removed only after multi-batch tests are in place.

Recommended verification:

```bash
npx vitest run tests/generationJobs.test.js tests/workerPayloadContract.test.js
npm test
npm run check
node --check worker/src/index.js
node --check worker/src/generationJobs.js
node --check worker/src/json.js
node --check tests/generationJobs.test.js
git diff --check
cd worker && npm run deploy -- --dry-run
```

No Gemini API call is required for unit validation.

## 14. Production Observation Ramp

Do not jump directly to 50 items.

Recommended ramp:

| Step | Requested items | Expected batches | Decision |
| --- | ---: | ---: | --- |
| Smoke 1 | 5-8 | 2 | Prove multi-batch loop. |
| Smoke 2 | 12 | 3 | Prove medium request stability. |
| Smoke 3 | 20 | 5 | Decide whether retry is needed. |
| Smoke 4 | 30 | 8 | Cost/latency review required. |
| Smoke 5 | 50 | 13 | Major release decision. |

Each observation should record summarized metrics only:

- latency
- batch count
- completed batch count
- generated item count
- parse result
- validation result
- qualityMeta completeness
- safe error code
- leakage finding
- estimated cost if available

## 15. Rollback Boundary

9C-14A rollback should be simple:

- Revert the multi-batch executor PR.
- Worker deploy rollback can return to the 9C-13 single-batch executor.
- D1 schema should not need rollback if 9C-14A only reuses existing metadata columns.
- No Pages rollback should be needed because frontend behavior is unchanged.

## 16. Decision Points

No owner decision is needed for the design document itself.

Stop for owner decision before:

- Deploying a Worker with multi-batch execution.
- Running the first two-batch production smoke.
- Enabling frontend async polling/result retrieval.
- Allowing partial result import.
- Raising observation above 20 items.
- Introducing parallel batch execution.

## 17. Recommendation

Proceed to **9C-14A: sequential multi-batch executor** as the next implementation PR.

Keep the first implementation conservative:

- sequential only,
- no retry,
- final result only after all batches pass,
- no frontend UI change,
- no deploy inside the PR.

This gives the project a clean path from the proven 9C-13 single-batch executor toward 50-item stability while preserving cost, leakage, and rollback boundaries.
