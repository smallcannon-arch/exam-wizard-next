# 9A Async Generation Architecture for 50-item Stability

Date: 2026-06-24

Status: design proposal.

This document defines the recommended architecture for stable generation of up to 50 items. It is a design artifact only. It does not change product code, prompt, schema, Worker API, UI, deployment workflow, npm audit state, `tmp/`, or stash.

## 1. Background

The current production system has already improved the synchronous generation path:

- Worker timeout policy was raised from 90 seconds to 300 seconds.
- Frontend retry policy no longer retries long timeout / contract failures.
- Frontend serial batching is available for 7-12 item requests.
- Low-count observations cover language arts, math, natural science, and 8-item scenarios.
- Observation #005 showed 8-item single-call generation can pass validation but reached 69.84 seconds.
- Observation #006 confirmed a 4-item natural science sample passed after the timeout policy update.

These improvements are useful, but they do not make 50-item generation stable enough. A 50-item request should not depend on one browser tab waiting on one long HTTP request.

## 2. Goal

Support reliable generation of up to 50 items with:

- Real progress visibility.
- Bounded API cost exposure.
- Batch-level retry, not whole-paper retry.
- Contract validation before final import.
- No raw prompt / raw output stored in repo or user-visible UI.
- No leakage of `qualityMeta`, `distractorDesign`, `teacherExplanation`, `selfCheck`, API key, token, headers, or stack traces.

## 3. Non-goals

This design does not propose:

- Increasing sync timeout indefinitely.
- Generating 50 items in one Gemini call.
- Storing raw prompt or raw output.
- Exposing raw provider errors to the frontend.
- Immediate 20/30/50 item production tests.
- npm audit work.
- PR #3 work.
- Deploy workflow changes.

## 4. Why Sync Requests Are Not Enough

For 50 items, a single synchronous request has poor failure boundaries:

- One malformed item can fail the whole paper.
- One timeout can waste the entire request.
- Browser tab closure or network interruption loses the result.
- User cannot see trustworthy progress.
- Retrying the entire 50-item request is costly.
- Raw output size and JSON fragility increase with item count.

The correct unit of reliability should be the batch, not the whole paper.

## 5. Platform Options

| Option | Summary | Pros | Risks | Recommendation |
|---|---|---|---|---|
| A. Keep frontend serial batching | Browser calls `/generate-items` in chunks. | Already partially implemented; low backend complexity. | Browser must stay open; no durable state; poor recovery for 50 items. | Not enough for 50 items. |
| B. Cloudflare Workflows | A durable multi-step job orchestrates batches. | Durable steps, retries, error handling, long-running orchestration. | Requires Workflows binding/setup and account capability check. | Preferred path. |
| C. Cloudflare Queues + D1/R2 | Queue messages per batch and persist job state separately. | Explicit queueing, retry, delay, DLQ support. | More moving parts; retry behavior must be carefully controlled. | Strong fallback. |
| D. Durable Object coordinator | One Durable Object tracks each job and dispatches batch work. | Strong per-job state coordination. | More custom orchestration; still needs queue/workflow-like execution. | Use only if Workflows/Queues do not fit. |

Primary recommendation: **Cloudflare Workflows**.

Fallback recommendation: **Cloudflare Queues + D1/R2**.

Reference sources:

- Cloudflare Workflows overview: https://developers.cloudflare.com/workflows/
- Cloudflare Workflows retry / sleep support: https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/
- Cloudflare Queues overview: https://developers.cloudflare.com/queues/
- Cloudflare Queues batching / retries / delays: https://developers.cloudflare.com/queues/configuration/batching-retries/
- Cloudflare Queues limits: https://developers.cloudflare.com/queues/platform/limits/
- Cloudflare Workers storage options: https://developers.cloudflare.com/workers/platform/storage-options/

## 6. Recommended Architecture

### 6.1 API shape

Add async job endpoints instead of making `/generate-items` carry 50-item synchronous traffic.

| Endpoint | Method | Purpose |
|---|---|---|
| `/generation-jobs` | POST | Create a job and return `jobId`. |
| `/generation-jobs/:jobId` | GET | Return safe status / progress. |
| `/generation-jobs/:jobId/result` | GET | Return final normalized items after success. |

MVP response examples:

```json
{
  "ok": true,
  "jobId": "job_...",
  "status": "queued"
}
```

```json
{
  "ok": true,
  "jobId": "job_...",
  "status": "running",
  "requestedItemCount": 50,
  "batchCount": 10,
  "completedBatchCount": 4,
  "completedItemCount": 20,
  "currentBatch": 5
}
```

### 6.2 Batch policy

Initial defaults:

| Setting | Initial value |
|---|---|
| max item count | 50 |
| batch size | 4-6 items |
| initial concurrency | 1 |
| later concurrency | 2, only after observation |
| per-batch timeout | 300 seconds |
| retry policy | retry transient upstream / empty response only |
| non-retryable | timeout, contract failure, qualityMeta missing, validation failure |

Rationale:

- Batch size 4 is already validated by observations.
- 8-item single-call worked but reached 69.84 seconds.
- Smaller batches reduce JSON fragility and isolate failures.
- Concurrency should start at 1 to avoid provider overload and surprise cost.

### 6.3 Job states

| State | Meaning |
|---|---|
| `queued` | Job accepted, not yet generating. |
| `running` | At least one batch is active. |
| `validating` | Batches completed, final paper validation running. |
| `completed` | Final result available. |
| `failed` | Job cannot complete. |
| `partial_failed` | Some batches failed; no final import. |
| `expired` | Job result exceeded retention window. |

### 6.4 Batch states

| State | Meaning |
|---|---|
| `queued` | Batch waiting. |
| `running` | Batch generating. |
| `validating` | Batch output is being checked. |
| `completed` | Batch passed minimum Worker gate and v2 contract. |
| `failed_retryable` | Transient failure eligible for retry. |
| `failed_terminal` | Contract / validation failure; no retry. |

## 7. Storage Model

Preferred minimal storage:

| Data | Suggested storage | Notes |
|---|---|---|
| job metadata | D1 | status, timestamps, counts, safe errorCode. |
| batch metadata | D1 | batch status, retry count, latency, safe errorCode. |
| final normalized items | R2 or D1 JSON column | Store final items, not raw provider response. |
| raw prompt / raw output | none | Do not store. |
| transient progress cache | KV optional | Only derived safe progress, TTL-limited. |

Do not store:

- raw prompt
- raw output
- full Gemini response
- API key
- token
- request headers
- stack trace

## 8. Validation and Contract Gates

Each batch must pass:

1. Worker safe JSON extraction.
2. `items` array check.
3. minimum `qualityMeta` gate.
4. item count check for that batch.
5. answer / options / distractorDesign contract.

Final paper must pass:

1. total item count.
2. total score / slot mapping.
3. objective mapping.
4. v2 quality validation.
5. student projection leakage check.

No partial result should be imported into the main UI unless a separate partial-review mode is designed.

## 9. Retry Policy

Retry only when the failure is likely transient:

| errorCode | Retry? |
|---|---|
| `GEMINI_UPSTREAM_ERROR` | yes, bounded |
| `AI_EMPTY_RESPONSE` | yes, bounded |
| network 502 / 503 without contract signal | yes, bounded |
| `GEMINI_TIMEOUT` | no by default after 300s |
| `CLIENT_TIMEOUT` | no |
| `AI_JSON_PARSE_FAILED` | no for MVP |
| `AI_ITEMS_PAYLOAD_INVALID` | no |
| `AI_QUALITY_META_MISSING` | no |
| `AI_OUTPUT_CONTRACT_INVALID` | no |

Retrying contract failures usually burns cost without improving reliability.

## 10. Frontend UX

Frontend should display real job progress:

- Job accepted.
- Batch count.
- Completed batch count.
- Completed item count.
- Current batch index.
- Safe errorCode if failed.
- No fake percentage.
- No raw provider error.

The user should be able to refresh the page and resume progress by job ID in a later phase. MVP can require the same tab if persistence UI is not yet ready, but the backend job itself should be durable.

## 11. Security and Leakage Boundary

Never show or persist:

- raw prompt
- raw output
- API key
- token
- request headers
- stack trace
- full Gemini error body

Student view must not include:

- `qualityMeta`
- `distractorDesign`
- `teacherExplanation`
- `selfCheck`
- `outputDiagnostics`

## 12. Rollout Plan

### 9B - Platform selection spike

Goal: verify whether Cloudflare Workflows is available and suitable in the current account/repo.

Deliverables:

- Confirm Workflows binding / Wrangler config shape.
- Confirm local and dry-run behavior.
- Confirm whether D1/R2 is required for result storage.
- No Gemini calls.
- No deploy unless separately approved.

### 9C - Async job API skeleton

Goal: add endpoints and safe status contract without real Gemini generation.

Deliverables:

- `POST /generation-jobs`
- `GET /generation-jobs/:jobId`
- fake job state or local mock workflow
- tests for safe response shape

### 9D - Batch executor

Goal: process real batches in controlled low-count mode.

Deliverables:

- batch splitting
- per-batch Gemini call
- safe retry policy
- batch validation
- final validation

### 9E - Async progress UI

Goal: frontend consumes job status.

Deliverables:

- job progress panel
- safe failure display
- no fake percentage
- no partial result import

### 9F - Observation ramp

Goal: measure stability before 50 items.

Sequence:

1. 12 items.
2. 20 items.
3. 30 items.
4. 50 items.

Each step requires:

- one or two low-frequency observations,
- summarized metrics only,
- no raw prompt/output stored,
- rollback plan.

## 13. Decision Needed Before Implementation

The next implementation branch should not start until this decision is made:

| Decision | Recommendation |
|---|---|
| Orchestrator | Cloudflare Workflows first. |
| Storage | D1 for metadata, R2 or D1 JSON for final normalized result. |
| Batch size | Start with 4 items. |
| Concurrency | Start with 1. |
| Max count | Design for 50, test progressively. |
| Retry | Transient upstream only. |

## 14. Recommendation

Proceed with **9B: Cloudflare Workflows platform selection spike**.

Do not start 50-item generation, async UI, Queues, D1 schema, or Workflows implementation in one mixed PR. The next PR should only prove the platform shape and define the minimal skeleton needed for durable async generation.
