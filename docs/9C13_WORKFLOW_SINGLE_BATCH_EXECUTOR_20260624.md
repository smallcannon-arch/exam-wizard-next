# 9C-13 Workflow Single-Batch Executor

Date: 2026-06-24

Status: implementation note.

## Scope

This task moves the async generation Workflow from a no-Gemini skeleton to a single-batch executor.

The executor is intentionally limited to one batch. It is meant to prove the production execution path before the project moves to multi-batch generation for 50-item papers.

## What Changed

- `GenerationWorkflow` can execute one batch.
- The Workflow builds the existing item-generation prompt for the batch intents.
- The Workflow calls Gemini from inside a durable `step.do`.
- The Workflow parses the JSON response and applies the existing Worker minimum `qualityMeta` gate.
- Successful single-batch output is stored in D1 `generation_jobs.result_json` as normalized `items`.
- Job and batch metadata are updated:
  - job `running`
  - batch `running`
  - job `completed`
  - batch `completed`
  - completed item counts
  - batch latency
- Failed batch output updates safe metadata:
  - batch `failed_terminal`
  - job `failed`
  - safe `error_code`

## Data Boundary

D1 may store normalized generated `items` in `result_json`.

D1 must not store:

- raw prompt
- raw model output
- source material text
- API key
- token
- headers
- stack trace

Workflow params may contain request material during execution, following the accepted 9C-11 decision.

## Single-Batch Gate

This implementation only supports `batchCount = 1`.

If a Workflow receives more than one batch, it fails safely with:

```text
ASYNC_BATCH_UNSUPPORTED
```

This prevents a multi-batch job from remaining indefinitely in `running` state before the 9C-14 multi-batch executor exists.

## Failure Behavior

If Gemini, JSON parsing, item payload validation, or the minimum `qualityMeta` gate fails:

- the batch is marked `failed_terminal`,
- the job is marked `failed`,
- only a safe `error_code` is stored,
- raw provider output and prompt material are not stored.

## Not Included

- No multi-batch execution.
- No retry policy.
- No partial success behavior.
- No async frontend polling.
- No result retrieval endpoint.
- No Worker deploy in this PR.
- No Pages deploy.
- No prompt/schema/UI change.
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

After Worker deployment, the controlled smoke should use a single-batch job only.

9C-14 should design and implement multi-batch execution separately, including:

- batch loop behavior,
- retry limits,
- partial success policy,
- final result assembly,
- frontend polling/result retrieval.
