# 9C-14 Production Smoke

Date: 2026-06-24

Status: passed.

## Scope

This document records the first production smoke after deploying the 9C-14 sequential multi-batch Workflow executor.

This is an observation note only. It does not change product code, prompt, schema, Worker API, frontend UI, deployment workflow, npm audit state, `tmp/`, or stash.

## Deployment

| Item | Value |
| --- | --- |
| PR | https://github.com/smallcannon-arch/exam-wizard-next/pull/17 |
| Merge commit | `23153b764cb9db5de838c5e237b02a5418a62c1f` |
| Worker | `exam-wizard-next-proxy` |
| Deployment ID | `bb9f6bea-8945-48b1-b35e-601684b3cb4e` |
| Worker version | `1aca5810-a1e9-47fe-bc91-3ce4bb157c7d` |
| Deployment time | `2026-06-24T11:56:34.429992Z` |
| Worker route | `https://exam-wizard-next-proxy.smallcannon.workers.dev` |

## Health Check

| Check | Result |
| --- | --- |
| `/health` HTTP status | 200 |
| `/health` body | `{ "ok": true, "service": "exam-wizard-next-proxy" }` |

## Smoke Request

| Field | Value |
| --- | --- |
| Job ID | `gen_e1008a8b-f930-4ca9-baa4-1daba599a74d` |
| Environment | production Worker |
| Subject | 國語 |
| Grade | 四年級 |
| Requested item count | 5 |
| Expected batch count | 2 |
| Batch size | 4 |
| Generation calls | 2 batches |

The request used short synthetic classroom text only. The raw prompt and raw model output were not saved.

## Smoke Result

| Metric | Result |
| --- | --- |
| Final status | `completed` |
| Total elapsed polling time | 58.11s |
| Completed batches | 2 / 2 |
| Completed items | 5 / 5 |
| Final current batch | `null` |
| Safe error code | none |
| Pages deploy triggered | no |
| `workflow_dispatch` triggered | no |

Observed status progression:

```text
queued
running batch 1
running batch 2 after completedBatches = 1 and completedItems = 4
completed with completedBatches = 2 and completedItems = 5
```

## Data Boundary

This note intentionally does not include:

- raw prompt,
- raw model output,
- full Gemini response,
- generated item text,
- API key,
- token,
- request headers,
- stack trace.

## Findings

No blocking findings.

The sequential multi-batch executor successfully processed a two-batch production job and exposed safe status progression through D1-backed polling.

## Not Included

- No retry policy validation.
- No parallel batch execution.
- No partial result import.
- No async frontend polling UI.
- No result retrieval endpoint validation.
- No Pages deploy.
- No 20 / 30 / 50 item observation.

## Next Recommendation

Proceed to 9C-15 design / implementation planning for safe async result retrieval and frontend polling.

Do not jump directly to 50-item generation. The next observation ramp should remain controlled and should only increase item counts after the result retrieval and frontend polling boundary is clear.
