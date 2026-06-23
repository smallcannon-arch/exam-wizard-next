# 8D Frontend Serial Batching Implementation Design

Date: 2026-06-23

Status: design only. No implementation, no API call, no deployment.

This document turns the 8D batching feasibility note into an implementation-ready design for a frontend serial batching MVP. It does not change product code, prompt text, schema, Worker API, deployment workflow, or UI behavior.

## Background

The current production path sends one synchronous `/generate-items` request with the full `intents` array. The Worker builds one prompt, calls Gemini once, checks a minimum output contract, and returns generated items. The frontend then normalizes, maps items back to blueprint slots, performs v2 validation, and imports the validated paper.

Observation baseline:

| Observation | Subject | Grade | Requested | Generated | Latency | v2 Validation | qualityMeta | Effective |
|---|---|---:|---:|---:|---:|---|---|---|
| #001 | 國語 | 四年級 | 4 | 4 | 24.54s | PASS | 4/4 | yes |
| #002 | 數學 | 四年級 | 4 | 4 | 33.84s | PASS | 4/4 | yes |
| #003 | 自然 | 五年級 | 4 | 4 | 37.39s | PASS | 4/4 | yes |
| #004 | 社會 | 四年級 | 4 | 4 | 36.02s | PASS | 4/4 | yes |
| #005 | 數學 | 四年級 | 8 | 8 | 69.84s | PASS | 8/8 | yes |

The 8-item single-call sample succeeded, but the 69.84s latency is long enough to justify a batching implementation design. It does not by itself justify immediate production rollout or an async job queue.

## Goals

1. Reduce single-call response size and upstream failure blast radius for medium item counts.
2. Show real batch progress instead of only frontend stage hints.
3. Preserve the current Worker `/generate-items` API.
4. Preserve existing v2 validation and student leakage boundaries.
5. Keep failures safe, understandable, and free of raw model data.

## Non-goals

- Do not implement async job queue.
- Do not implement persistent background jobs.
- Do not stream partial model output.
- Do not expose partial unvalidated items in the final paper.
- Do not add fake item-level progress.
- Do not add a fake cancel button.
- Do not change prompt text.
- Do not change canonical schema.
- Do not change Worker API contract for the first MVP.
- Do not store raw prompt or raw output.
- Do not deploy as part of the implementation PR.

## Current Code Touchpoints

| Area | Current role | Design impact |
|---|---|---|
| `frontend/src/app.js` | Owns `generateItems()`, progress state, API call, item mapping, v2 validation, and import. | Add orchestration around the existing one-call path. |
| `frontend/src/apiClient.js` | Exposes `generateItemsViaApi()` for `/generate-items`. | Reuse without changing the Worker API. |
| `frontend/src/core/generationProgress.js` | Provides stage-based loading UI and timeout guidance. | Extend to represent real batch counts. |
| `frontend/src/core/validateGeneratedPaper.js` | Performs v2 validation after generation. | Reuse after each batch and after final merge. |
| `worker/src/json.js` | Provides safe `errorCode` and minimum `qualityMeta` gate. | Surface safe batch-level failure classes without raw data. |

## Proposed Architecture

Use frontend serial batching against the existing Worker endpoint:

1. Build the same full `state.intents` blueprint as today.
2. Decide whether batching is needed by item count.
3. If not needed, use the existing single-call path.
4. If needed, split `state.intents` into ordered chunks.
5. Send one chunk at a time to `generateItemsViaApi()`.
6. Validate each batch before accepting it.
7. Merge validated batches in original blueprint order.
8. Run final whole-paper validation before import.

No Worker API changes are required for the first MVP.

## Trigger Thresholds

Initial threshold proposal:

| Requested item count | Behavior |
|---:|---|
| 1-6 | Single call, unchanged. |
| 7-12 | Frontend serial batching, 2 batches. |
| 13-20 | Frontend serial batching, 3-4 batches after separate owner approval. |
| More than 20 | Do not support without a separate release decision. |

Recommended MVP scope:

- Implement the 7-12 item path first.
- Keep 13+ disabled or behind an explicit guard until more observation data exists.
- Use chunk size 4 as the default because all 4-item observations passed and the 8-item single-call sample was slow.

## Chunking Rules

Chunking must be deterministic and blueprint-preserving:

1. Split by the original `state.intents` order.
2. Preserve every original `itemId`.
3. Preserve group item boundaries. If a grouped item spans child IDs, do not split its children across batches.
4. Pass the same `project`, `materialText`, `objectives`, and `checkedChineseSubcategories` into each batch.
5. Pass only the batch's `intents` array to the Worker.
6. Never mutate the source `state.intents` while batching.

Suggested helper:

```js
createGenerationBatches(intents, { maxItemsPerBatch = 4 })
```

Expected properties:

- Returns an ordered array of batches.
- Each batch has `batchIndex`, `batchCount`, `intents`, `expectedItemIds`, and `requestedCount`.
- Throws or returns a safe local error when a group boundary cannot be preserved.

## Batch Validation Rules

Each batch must pass all of these before it can be merged:

1. Worker response is `{ ok: true, items: [...] }`.
2. Generated item count matches the batch expected count.
3. Every generated item can map back to a batch slot.
4. No duplicate normalized item IDs exist within the batch.
5. Every expected batch item ID is present after normalization.
6. `validateGeneratedPaper(..., { qualityMode: "v2" })` passes for the batch.
7. No student leakage fields are introduced by the batch import path.

After all batches pass, the merged paper must also pass whole-paper v2 validation before import.

## Merge Rules

The merge step must be all-or-nothing:

1. Keep successful batch results in memory only until all batches pass.
2. Preserve final order using the original full `state.intents` order.
3. Reject duplicate final item IDs.
4. Reject missing final item IDs.
5. Reject extra generated items that do not map to a blueprint slot.
6. Do not import partial results into `state.items` if any batch fails.

This prevents a failed second batch from leaving a half-generated paper in the UI.

## Retry Rules

Keep retry bounded:

| Failure type | Retry recommendation |
|---|---|
| Network, timeout, Gemini upstream, empty response, JSON parse | Retry the failed batch once. |
| v2 validation failure | Do not retry automatically in MVP. Show safe failure and ask teacher to retry or reduce item count. |
| `AI_QUALITY_META_MISSING` | Do not retry automatically in MVP unless future observations prove transient behavior. |
| Local merge contract failure | Do not retry automatically; treat as implementation/contract failure. |

The MVP should avoid infinite retry loops. A batch should have at most 2 total attempts, matching the current full-paper retry shape.

## Progress UI Design

The current progress panel should be extended to show real batch progress when batching is active.

Recommended visible fields:

- Title: `正在分批產生試題`
- Status: `正在處理第 1 / 2 批`
- Completed count: `已完成 4 / 8 題`
- Current action: `正在產生題目` / `正在檢查題目格式` / `正在準備結果`
- Timeout guidance remains elapsed-time based.

Do not show fake precision:

- No `73%`.
- No fake per-item progress inside a batch.
- No cancel button unless cancellation is actually implemented.

The generate button remains disabled during all batches.

## Safe Error Model

Frontend should preserve and display safe Worker error classes where available:

| errorCode | User-facing handling |
|---|---|
| `GEMINI_UPSTREAM_ERROR` | AI service temporarily failed; suggest retry later. |
| `GEMINI_TIMEOUT` | Generation timed out; suggest reducing item count or retrying. |
| `AI_EMPTY_RESPONSE` | AI returned no usable content; suggest retry. |
| `AI_JSON_PARSE_FAILED` | AI response could not be parsed into question JSON. |
| `AI_ITEMS_PAYLOAD_INVALID` | Returned item payload did not match expected shape. |
| `AI_QUALITY_META_MISSING` | Returned items missed required quality metadata. |
| `AI_OUTPUT_CONTRACT_INVALID` | Returned output failed the minimum contract. |

Error UI must not display:

- raw prompt
- raw output
- API key
- token
- headers
- stack trace
- Gemini full raw error body

## Suggested Implementation Units

The later implementation PR should be small and frontend-focused:

| Unit | Suggested file |
|---|---|
| batching helpers | `frontend/src/core/generationBatching.js` |
| progress view extension | `frontend/src/core/generationProgress.js` |
| orchestration | `frontend/src/app.js` |
| tests | `tests/generationBatching.test.js`, `tests/generationProgress.test.js` |

Avoid changing:

- `worker/src/prompts.js`
- `worker/src/index.js`
- `worker/src/json.js`
- `frontend/src/core/schema.js`
- deployment workflows

If implementation reveals that the Worker API must change, stop and open a separate design review.

## Test Plan

Minimum tests before merge:

1. Chunking preserves order.
2. Chunking preserves item IDs.
3. Chunking does not split grouped item children across batches.
4. Single-call threshold keeps 1-6 items unchanged.
5. 8 items becomes 2 batches of 4.
6. Batch merge preserves original order.
7. Batch merge rejects duplicate IDs.
8. Batch merge rejects missing IDs.
9. Batch merge rejects extra unmapped IDs.
10. Batch failure prevents partial import.
11. Safe error message does not contain raw prompt, raw output, token, headers, or stack trace.
12. Progress view shows batch count and completed item count without fake percentages.
13. Existing `validateGeneratedPaper` tests still pass.
14. Existing student projection / leakage tests still pass.

Recommended verification commands:

```bash
npm test
npm run check
node --check frontend/src/app.js
node --check frontend/src/core/generationBatching.js
node --check frontend/src/core/generationProgress.js
node --check tests/generationBatching.test.js
```

No generation API call is required for unit-test validation. A later observation run can validate production behavior after merge and deployment.

## Rollback Plan

Frontend serial batching should be rollback-friendly:

1. Keep the existing single-call path intact.
2. Put batching behind a small local threshold helper.
3. Roll back by setting the batching threshold above the supported maximum or reverting the batching PR.
4. No Worker rollback should be required if the initial MVP does not change Worker API.
5. Pages deployment remains manual and must be separately approved.

## Release Boundary

The implementation PR must clearly state:

- no deploy included
- no Worker API change
- no prompt change
- no schema change
- no async queue
- no partial result UI
- no npm audit fix
- no `tmp/`
- no raw output committed

Deployment, if approved later, should be followed by one low-cost batching observation.

## Open Decisions

| Decision | Recommendation |
|---|---|
| Start coding now or run 12-item single-call first? | Start a Draft implementation PR for frontend serial batching MVP; do not deploy until reviewed. |
| Chunk size 4 or 6? | Start with 4, because all 4-item observations passed. |
| Should partial successful batches be shown? | No for MVP. Keep all-or-nothing import. |
| Should v2 validation run per batch and whole paper? | Yes. |
| Should Worker API change? | No for MVP. |
| Should 13+ items be enabled immediately? | No. Require separate owner decision. |

## Recommendation

Proceed to a Draft frontend serial batching MVP PR only after this design is accepted.

Recommended next task:

`8D-1: frontend serial batching MVP implementation`

Initial implementation should:

1. Add pure batching helpers and tests.
2. Integrate serial batch orchestration into `generateItems()`.
3. Extend progress UI with real batch count.
4. Preserve existing single-call path for 1-6 items.
5. Keep all-or-nothing validation and import.
6. Avoid deployment until merge and release review.

## Data Boundary

This document intentionally does not contain:

- raw prompt
- raw output
- full API response
- generated item text
- API key
- token
- request headers
- cookies

Only summarized observations and implementation design guidance are recorded.
