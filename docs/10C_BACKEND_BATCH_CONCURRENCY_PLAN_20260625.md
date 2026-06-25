# 10C Backend Batch Concurrency Plan

Date: 2026-06-25

Status: design proposal. This document does not change product code, prompt, schema, Worker API, frontend UI, deployment workflow, npm audit state, `tmp/`, or stash.

## Background

The project has moved past the original synchronous full-paper generation risk:

- The frontend can submit one generation request and poll a backend job.
- The Worker creates generation jobs and splits requested items into batches.
- The current production path has completed 25 requested items as 7 backend batches.
- The current executor runs batches sequentially.
- The latest 25-item production observation completed successfully:
  - jobId `gen_0a414853-3e5c-4aee-ba6b-bd2cb96eb1e9`
  - latency `222.17s`
  - generated items `25/25`
  - JSON parse `success`
  - frontend v2 validation `pass`
  - `qualityMeta` `25/25`
  - leakage finding `none`

The user-facing target is still:

```text
User clicks once
Backend splits work into batches
Backend may run a bounded number of batches concurrently
Frontend polls real progress
Final result returns as one complete paper
```

## Current Implementation Shape

Relevant files:

| Area | File |
| --- | --- |
| Workflow executor | `worker/src/index.js` |
| Job planning and D1 state | `worker/src/generationJobs.js` |
| Safe parsing and Worker gates | `worker/src/json.js` |
| Gemini call wrapper | `worker/src/gemini.js` |
| Async job tests | `tests/generationJobs.test.js` |

Current behavior:

- `ASYNC_GENERATION_BATCH_SIZE = 4`.
- `ASYNC_GENERATION_MAX_ITEM_COUNT = 50`.
- A 50-item request creates about 13 batches.
- `GenerationWorkflow.run()` iterates batches sequentially.
- The frontend receives safe status through `/generation-jobs/:jobId`.
- Final result is only stored after all batches pass.

This is a good base. The next change should not replace it. It should add **bounded concurrency** on top of the same job and batch model.

## Design Goal

Support configurable backend batch concurrency while keeping the frontend one-click flow.

Initial production behavior should remain conservative:

| Setting | Initial value |
| --- | ---: |
| batch size | 4 |
| max item count | 50 |
| max concurrent batches | 1 |
| retry per batch | 0 or 1, but only for explicitly retryable failures |
| partial result import | no |
| frontend API contract | unchanged |

The implementation should make it easy to raise `MAX_CONCURRENT_BATCHES` to `2` later, but should not enable higher concurrency without observation.

## Why Not Run 13 Batches At Once

Running all 13 batches for a 50-item paper at the same time is technically possible, but unsafe as a first production step.

Risks:

- API rate limit / upstream throttling risk.
- Higher burst cost.
- Harder failure diagnosis if many batches fail together.
- Less consistent style across the paper.
- More pressure on Workflow step output and D1 update ordering.
- Harder rollback if the first concurrent release behaves badly.

Recommended ramp:

| Phase | Requested items | Concurrency | Purpose |
| --- | ---: | ---: | --- |
| 10C-2 implementation | no real generation | 1 default | Add code path safely. |
| 10C-3 unit tests | no real generation | 1 and 2 simulated | Prove ordering and progress. |
| 10C-4 Worker deploy | no generation | 1 default | Deploy code safely. |
| 10C-5 observation | 25 | 1 | Confirm no regression. |
| 10C-6 observation | 25 | 2 | Test bounded concurrency. |
| 10C-7 decision | none | decide | Decide if 50-item observation is acceptable. |
| 10C-8 observation | 50 | 1 or 2 | Cost-bearing owner decision. |

## Recommended Executor Model

The executor should process a queue of planned batches with a bounded worker pool:

```text
planned batches -> pending queue

while pending batches remain:
  take up to MAX_CONCURRENT_BATCHES pending batches
  mark those batches running
  generate and validate each selected batch
  persist completed / failed batch state
  append successful batch result by batchNumber
  stop job on terminal failure

after all batches pass:
  sort accumulated results by batchNumber
  verify final item count
  complete job with final result_json
```

Important: the public progress contract should remain based on D1 state, not on temporary in-memory state alone.

## Concurrency Configuration

Use an environment/config helper with safe bounds:

```text
ASYNC_GENERATION_MAX_CONCURRENT_BATCHES
```

Recommended parsing:

- default to `1`;
- clamp minimum to `1`;
- clamp maximum to `3` initially;
- production should start with `1`;
- raising to `2` should require deploy decision and observation;
- values above `3` should not be supported until there is production evidence.

No frontend setting should expose this in MVP.

## Progress Semantics

With concurrency `1`, existing progress remains mostly unchanged.

With concurrency `2`, `currentBatch` becomes less precise. The current API has one `currentBatch` field, but two batches may be running. To avoid an API contract change in the first implementation:

- keep `completedBatchCount`;
- keep `completedItemCount`;
- set `currentBatch` to the lowest running batch number;
- do not expose `runningBatchNumbers` yet.

If the frontend later needs richer display, add `runningBatchNumbers` in a separate contract PR.

## Failure Policy

MVP failure behavior should stay all-or-nothing:

- no partial paper import;
- final `result_json` only after all batches pass;
- safe `errorCode` only;
- no raw prompt or raw output persistence;
- no stack trace, API key, token, headers, or Gemini raw error body in responses.

Recommended retry policy:

| Failure | Retry in first concurrency PR? | Notes |
| --- | --- | --- |
| `GEMINI_UPSTREAM_ERROR` | optional 1 retry | Only if implementation remains small. |
| `AI_EMPTY_RESPONSE` | optional 1 retry | May be transient. |
| `GEMINI_TIMEOUT` | no | Retrying can double long waits and cost. |
| `AI_JSON_PARSE_FAILED` | no | Usually output contract issue. |
| `AI_ITEMS_PAYLOAD_INVALID` | no | Contract failure. |
| `AI_QUALITY_META_MISSING` | no | Contract failure. |
| `AI_OUTPUT_CONTRACT_INVALID` | no | Contract failure. |

If retry is added, it must be per-batch, bounded, and recorded only as safe metadata.

## Result Ordering

Concurrent execution can finish out of order. The completed result must be sorted by the original batch number and then by item order within that batch.

Required checks before completing the job:

- each batch has exactly its expected item count;
- every expected batch number appears once;
- final item count equals requested item count;
- final item ids are unique enough for frontend normalization;
- frontend v2 validation remains the source of full import validation.

## D1 State Requirements

Current D1 state already tracks job and batch progress. The concurrency implementation should preserve these rules:

- mark selected batches `running` before generation;
- mark each batch `completed` only after safe parse and minimum Worker gates;
- mark failed batches with safe `error_code`;
- update `completed_batch_count` and `completed_item_count` after each successful batch;
- do not store raw prompt or raw output;
- do not store partial completed items as public result unless a future partial-review design explicitly allows it.

If concurrent updates can race, the implementation should prefer a small sequential persistence phase after `Promise.allSettled()` for the selected window.

## Testing Plan

No production API call is needed for implementation tests.

Recommended test coverage:

1. Existing sequential behavior remains valid when concurrency defaults to `1`.
2. Concurrency parser defaults invalid values to `1`.
3. Concurrency parser clamps high values.
4. Simulated concurrency `2` processes multiple batches and returns ordered results.
5. A failed batch marks job failed with safe `errorCode`.
6. Out-of-order completion is sorted before final result.
7. `completedBatchCount` and `completedItemCount` progress remain safe.
8. Result endpoint returns only final result after all batches pass.
9. Error payload does not contain raw prompt, raw output, API key, token, headers, or stack trace.
10. Existing single-batch jobs still pass.

Suggested commands:

```bash
npx vitest run tests/generationJobs.test.js tests/workerPayloadContract.test.js
npm test
npm run check
node --check worker/src/index.js
node --check worker/src/generationJobs.js
node --check worker/src/json.js
```

## Validation Ramp

After implementation and deploy, do not jump straight to 50 items.

Recommended observation sequence:

| Step | Request | Concurrency | Expected decision |
| --- | ---: | ---: | --- |
| Smoke A | health only | 1 | Worker deploy sanity. |
| Smoke B | 25 items | 1 | Regression check against current baseline. |
| Smoke C | 25 items | 2 | First bounded concurrency check. |
| Decision | none | 2 | Decide if 50-item cost is acceptable. |
| Smoke D | 50 items | 1 or 2 | Major decision; owner approval required. |

## Rollback

Rollback options:

1. Revert the bounded concurrency PR.
2. Keep the code but set `ASYNC_GENERATION_MAX_CONCURRENT_BATCHES=1`.
3. Roll back Worker deployment to the previous known-good version.

Production should not enable concurrency `2` without an easy path back to `1`.

## Decision Boundary

Small decisions that can proceed without owner interruption:

- docs updates;
- unit-test design;
- implementation that preserves default concurrency `1`;
- no API generation;
- no deploy;
- no Pages workflow changes.

Major decisions that should stop for owner confirmation:

- enabling production concurrency above `1`;
- running a 50-item production observation;
- adding partial-result UI/import;
- increasing max item count above `50`;
- changing prompt/schema/API contracts;
- deploying Worker after concurrency implementation;
- running cost-bearing production observations above the existing 25-item baseline.

## Recommendation

Proceed with a small implementation PR:

```text
10C-2: Worker bounded batch concurrency implementation
```

Scope:

- add bounded concurrency helper;
- preserve default `1`;
- support simulated `2` in tests;
- preserve frontend API contract;
- do not deploy;
- do not run generation API;
- do not change prompt/schema/UI.

After that PR passes tests, stop for a deploy decision before changing production behavior.
