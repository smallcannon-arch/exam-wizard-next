# 9C-14 Workflow Multi-Batch Executor

Date: 2026-06-24

Status: implementation note.

## Scope

This task moves the async generation Workflow from the 9C-13 single-batch executor to a sequential multi-batch executor.

The implementation is intentionally conservative:

- batch concurrency remains 1,
- no automatic retry is added,
- final `result_json` is written only after every batch passes,
- frontend async polling and result retrieval remain out of scope,
- no Worker deploy is included in this PR.

## What Changed

- `GenerationWorkflow` now loops through every batch in the Workflow payload.
- Each batch is marked `running` before its Gemini call.
- Each batch reuses the existing prompt, Gemini, JSON extraction, and minimum `qualityMeta` gate.
- Successful batches update D1 progress:
  - completed batch count,
  - completed item count,
  - current batch pointer,
  - batch latency.
- The job is completed only after all batches pass.
- Final `result_json` stores normalized generated items plus safe batch metadata:

```json
{
  "items": [],
  "batchCount": 2,
  "completedBatchCount": 2,
  "partial": false
}
```

## Failure Behavior

If a later batch fails:

- the failed batch is marked `failed_terminal`,
- the job is marked `failed`,
- the job stores only a safe `error_code`,
- final `result_json` is not written,
- raw prompt and raw model output are not stored.

The old `ASYNC_BATCH_UNSUPPORTED` hard stop is no longer used for normal multi-batch plans.

## Data Boundary

D1 may store:

- job metadata,
- batch progress,
- safe error codes,
- batch latency,
- final normalized items after complete success.

D1 must not store:

- raw prompt,
- raw model output,
- source material text,
- API key,
- token,
- request headers,
- stack trace.

Workflow params may contain request material during execution, following the accepted 9C-11 decision.

## Not Included

- No retry policy.
- No parallel execution.
- No partial result import.
- No async frontend polling.
- No result retrieval endpoint.
- No prompt change.
- No schema change.
- No Pages deploy.
- No Worker deploy in this PR.
- No npm audit fix.
- No D1 cleanup execution.

## Validation

Expected validation:

- `npx vitest run tests/generationJobs.test.js tests/workerPayloadContract.test.js`
- `npm test`
- `npm run check`
- `node --check worker/src/index.js`
- `node --check worker/src/generationJobs.js`
- `node --check worker/src/json.js`
- `node --check tests/generationJobs.test.js`
- `git diff --check`
- `npm run deploy -- --dry-run` from `worker/`

## Next Step

After this PR merges, the next major decision point is Worker deployment.

After Worker deployment, the controlled production smoke should start with a two-batch job only. Do not jump directly to 20, 30, or 50 items.

Recommended smoke:

1. 5-8 items, expected 2 batches.
2. Record summarized metrics only.
3. No raw prompt or raw output persistence.
4. Stop before retry policy or frontend async UI.
