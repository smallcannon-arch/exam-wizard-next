# 9C-11 Async Execution Input Storage Decision

Date: 2026-06-24

Status: decision package.

This document records the next decision before implementing real async batch execution for `queued` generation jobs. It does not change product code, prompt, schema, Worker API, UI, deployment workflow, npm audit state, `tmp/`, or stash.

## 1. Background

The current async job path is intentionally metadata-only:

- `POST /generation-jobs` creates D1 job metadata.
- `GET /generation-jobs/:jobId` returns safe queued progress from D1.
- D1 stores job status, batch counts, timestamps, safe error codes, and a placeholder for final normalized result JSON.
- D1 does not store raw prompt, raw model output, source material text, API keys, tokens, headers, or stack traces.
- 9C-9 added an internal expired-job cleanup helper.
- The helper is deployed to the Worker, but no cleanup has been executed.

This is safe, but it means the Worker currently cannot execute a queued D1 job later because the data required to build the generation prompt is not persisted with the job.

## 2. Current Blocker

To execute a queued job, the executor needs at least:

- `project`
- `materialText`
- `objectives`
- `intents`
- `checkedChineseSubcategories`

The current D1 schema does not store these fields. That is intentional because `materialText` may contain classroom source material, copied passages, or other sensitive input.

Therefore, a real async executor cannot safely be added until the project chooses where the generation request payload lives while the async job is running.

## 3. Decision Options

| Option | Summary | Pros | Risks | Recommendation |
| --- | --- | --- | --- | --- |
| A. Cloudflare Workflows params + D1 metadata | Start a Workflow instance with request params; keep D1 as metadata/result store. | Avoids writing source material into D1; matches 9A/9B direction; enables durable execution and progress updates. | Workflow state still contains request params inside Cloudflare; requires Workflow binding and deploy. | Recommended. |
| B. D1 request snapshot | Store a sanitized request snapshot in D1 with TTL. | Easy to inspect and replay; executor can recover from Worker restarts using D1 alone. | D1 would store source material/objectives/intents; stronger privacy and retention decision required. | Not recommended for MVP. |
| C. Queue message payload | Push batch or job payload into Cloudflare Queues. | Strong async worker pattern; good retry controls. | More moving parts; queue messages would carry request material; separate DLQ/retention policy needed. | Good fallback after Workflows. |
| D. Keep frontend serial batching only | Do not implement durable async executor yet. | Lowest backend risk; already deployed. | Browser must stay open; not reliable enough for 50 items. | Not enough for target. |

## 4. Recommended Decision

Choose **Option A: Cloudflare Workflows params + D1 metadata**.

Recommended behavior:

1. `POST /generation-jobs` validates the request and creates D1 metadata.
2. The Worker starts a Workflow instance using the same `jobId`.
3. Workflow params contain the generation request and batch plan.
4. D1 remains the source of safe public job status.
5. The Workflow executes batches sequentially.
6. Each batch updates D1 with safe progress, safe error code, latency, and completed counts.
7. Final D1 `result_json` stores normalized generated items only, not raw provider output.

Do not store raw prompt or raw Gemini response anywhere.

## 5. MVP Execution Flow

```text
POST /generation-jobs
  -> validate request
  -> create D1 job metadata
  -> create Workflow instance with params
  -> return 202 jobId

Workflow instance
  -> mark job running
  -> for each batch:
       mark batch running
       call Gemini with batch intents
       parse JSON
       assert minimum Worker item contract
       mark batch completed or failed_terminal
       update D1 progress
  -> validate merged item count
  -> write final normalized result_json
  -> mark job completed

GET /generation-jobs/:jobId
  -> read D1 status only
  -> return safe progress

Future GET /generation-jobs/:jobId/result
  -> return final normalized items only when completed
```

## 6. Data Safety Requirements

The async execution path must not expose or persist:

- raw prompt
- raw model output
- full Gemini response body
- API key
- token
- request headers
- stack trace
- source material in D1 metadata

Allowed D1 metadata:

- job id
- status
- requested item count
- batch size/count
- completed batch/item counts
- current batch
- safe error code
- batch latency
- timestamps
- final normalized result JSON after success

Workflow params may contain request material only as the execution input. This requires owner acceptance because it still places request content into Cloudflare-managed Workflow state during execution.

## 7. Suggested Implementation Split

### 9C-12: Workflow binding and no-Gemini executor skeleton

Scope:

- Add Workflows binding/config.
- Add Workflow class skeleton.
- Start Workflow from `POST /generation-jobs` after D1 metadata creation.
- Workflow updates D1 from `queued` to `running` and back to a safe terminal placeholder in tests only.
- No Gemini call.
- No result endpoint.
- No Pages deploy.

Purpose:

- Prove binding shape and state update mechanics.
- Keep API cost at zero.
- Avoid mixing platform setup with model execution.

### 9C-13: Single-batch real executor behind low-count gate

Scope:

- Execute one 4-item batch through existing prompt/Gemini helpers.
- Assert item contract.
- Update D1 progress and final result JSON.
- Keep concurrency at 1.
- One controlled production observation only after deploy approval.

Purpose:

- Validate real Worker execution path with bounded API cost.

### 9C-14: Multi-batch sequential executor

Scope:

- Process multiple 4-item batches.
- Merge normalized items.
- Handle batch-level safe failures.
- No parallelism yet.

Purpose:

- Build toward 50-item stability without introducing concurrency risk.

## 8. Tests Required Before 9C-12 Merge

Minimum tests:

- D1 metadata creation still stores no request material.
- Workflow create is called with safe job id and batch plan.
- If D1 insert fails, Workflow is not created.
- If Workflow create fails, job creation returns safe error and does not leak request data.
- Status polling still reads only D1 metadata.
- Error response does not contain raw prompt, raw output, API key, token, headers, or stack trace.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Workflow binding config differs from current Wrangler expectations | Use dry-run and a small draft PR. |
| Request material exists in Workflow state | Owner must explicitly accept this retention boundary. |
| D1 metadata and Workflow state diverge | D1 update logic must be idempotent and safe to retry. |
| Workflow starts after D1 insert but then fails | Return safe error and leave D1 status recoverable or mark failed. |
| Real execution burns API cost | Keep 9C-12 no-Gemini; defer real generation to 9C-13. |

## 10. Owner Decision Needed

Before implementation beyond design, owner should confirm:

```text
[ ] Accept Cloudflare Workflows as the async orchestrator.
[ ] Accept that Workflow params may contain request material during execution.
[ ] Keep D1 metadata-only; do not store source material in D1.
[ ] Start with no-Gemini Workflow skeleton in 9C-12.
[ ] Defer real generation to 9C-13 with one low-count observation.
```

## 11. Recommendation

Proceed with 9C-12 only after owner confirms Option A.

Do not implement real batch generation, D1 request snapshots, Queues, result endpoint, async UI, or 50-item observations in the same PR.
