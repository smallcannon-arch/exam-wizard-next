# 8D Batching Feasibility Design Note

Date: 2026-06-23

Status: design note only. Do not implement batching yet.

This document evaluates whether the project should move from one synchronous full-paper generation call toward batched generation. It uses the current low-count observation baseline and existing frontend / Worker flow as the decision basis. It does not change product behavior, prompt text, Worker API, schema, deployment, or UI.

## Current Flow

| Layer | Current behavior |
|---|---|
| Frontend | Sends one `/generate-items` request with the full `intents` array. |
| Worker | Builds one generation prompt and performs one Gemini call. |
| Validation | Worker now blocks missing `qualityMeta`; frontend performs v2 validation before importing. |
| UX | Progress UI shows synchronous waiting states and timeout guidance. |
| Retry | Frontend retries once for connection / timeout / format failure classes. |
| Deployment | Pages deploy is manual; Worker deploy is separate. |

## Observation Baseline

| Observation | Subject | Grade | Requested | Generated | Latency | v2 Validation | qualityMeta | Effective |
|---|---|---:|---:|---:|---:|---|---|---|
| #001 | 國語 | 四年級 | 4 | 4 | 24.54s | PASS | 4/4 | yes |
| #002 | 數學 | 四年級 | 4 | 4 | 33.84s | PASS | 4/4 | yes |
| #003 | 自然 | 五年級 | 4 | 4 | 37.39s | PASS | 4/4 | yes |
| #004 | 社會 | 四年級 | 4 | 4 | 36.02s | PASS | 4/4 | yes |

Additional failed signal:

- Observation #002 first attempt returned HTTP 502 after 40.25s with 0/4 items.
- The failure is retained as audit trail, not counted as an effective baseline sample.

## Problem To Solve

Batching should not be treated as a feature by itself. It is only worth doing if it solves at least one of these problems:

1. Latency for larger papers becomes too high for a single synchronous call.
2. A single upstream failure wastes the entire generation attempt.
3. Worker / upstream response size or JSON shape becomes less reliable as item count grows.
4. Cost / output diagnostics need clearer per-batch observation.
5. User perception needs progress tied to real completed chunks rather than frontend-only stage hints.

Current evidence supports design exploration for latency and reliability, but does not yet prove implementation is required.

## Non-goals For 8D

- Do not implement asynchronous job queue.
- Do not implement persistent background jobs.
- Do not change prompt content in this design step.
- Do not change the canonical item schema.
- Do not remove `qualityMeta`.
- Do not store raw prompt or raw output.
- Do not expose partial generated item text to students before validation.
- Do not deploy as part of this design step.

## Candidate Strategies

### Option A: Keep Single-call Synchronous Generation

| Aspect | Assessment |
|---|---|
| Summary | Keep current behavior and continue collecting observations. |
| Pros | Lowest implementation risk; current 4-item samples pass; no API contract changes. |
| Cons | Larger papers may remain slow; one failure loses all items; progress remains approximate. |
| Best fit | Near-term default while evidence remains limited. |
| Recommendation | Keep as current production behavior. |

### Option B: Frontend Serial Batching Against Existing Worker Endpoint

| Aspect | Assessment |
|---|---|
| Summary | Frontend splits `intents` into chunks and calls existing `/generate-items` multiple times sequentially. |
| Pros | No new Worker endpoint required; can show real batch progress; smaller model outputs may reduce JSON failure risk. |
| Cons | More API calls; total latency may increase; partial failure handling becomes user-visible; item ordering and validation must be carefully merged. |
| Best fit | First implementation candidate if observations show larger requests are unreliable. |
| Recommendation | Feasible, but only after another design pass and tests. |

### Option C: Worker Internal Batching

| Aspect | Assessment |
|---|---|
| Summary | Frontend sends full paper once; Worker splits intents and calls Gemini per chunk, then merges responses. |
| Pros | Frontend API remains stable; Worker can centralize merge and error semantics. |
| Cons | Worker request duration may approach platform limits; multiple upstream calls inside one request can still timeout; harder to stream real progress. |
| Best fit | Only if frontend contract must stay one-call and total batches remain small. |
| Recommendation | Not first choice unless frontend batching proves awkward. |

### Option D: Async Job Queue

| Aspect | Assessment |
|---|---|
| Summary | Generation becomes a background job with polling or push updates. |
| Pros | Best long-term shape for large papers and durable retries. |
| Cons | Much larger architecture change; requires job state, status model, cleanup, failure semantics, and likely new UI states. |
| Best fit | Later phase after batching evidence or repeated production pain. |
| Recommendation | Do not start yet. |

## Proposed Batch Boundaries If Implemented Later

Initial candidate:

| Paper size | Behavior |
|---|---|
| 1-6 items | Single call |
| 7-12 items | Consider 2 batches |
| 13-20 items | Consider 3-4 batches |
| More than 20 items | Do not implement without separate owner decision |

Chunking rule candidate:

- Split by `intents` order.
- Keep each chunk around 4-6 items.
- Preserve item IDs from the original blueprint.
- Validate every batch independently before merge.
- Merge only validated items.
- If one batch fails, show a safe batch-level error and avoid importing partial unvalidated output.

These thresholds are not final. They need more observations with 8, 12, and 16 item samples before implementation.

## Contract Requirements

Any batching design must preserve:

1. Every generated item must map back to one original slot.
2. Every item must include `qualityMeta`.
3. Worker must continue returning safe `errorCode` values for failures.
4. Frontend v2 validation must still pass before import.
5. Student projection must not include `qualityMeta`, `distractorDesign`, `teacherExplanation`, `selfCheck`, raw prompt, raw output, or diagnostics.
6. Raw model output must not be committed or saved into repo.
7. Batch merge must not duplicate item IDs.
8. Batch merge must not silently drop failed items.

## Partial Failure Model

If batching is implemented later, failures should be represented without raw data:

| Failure | Safe user-facing outcome |
|---|---|
| One batch upstream failure | "部分題目生成失敗，請稍後重試或減少題數。" |
| One batch invalid JSON | Safe `AI_JSON_PARSE_FAILED` class; do not expose raw output. |
| Missing `qualityMeta` | Safe `AI_QUALITY_META_MISSING`; do not import partial batch. |
| Item count mismatch | Safe `AI_ITEMS_PAYLOAD_INVALID`; show failed batch range. |
| Repeated failure | Offer retry / reduce item count guidance, not automatic infinite retry. |

## Test Requirements Before Implementation

Minimum tests:

- Chunking preserves original order.
- Chunking preserves original item IDs.
- Merge rejects duplicate IDs.
- Merge rejects missing items.
- Batch failure does not import partial invalid output.
- Batch success still passes existing v2 validation.
- Student projection still hides internal fields.
- User-facing batch error does not contain raw prompt, raw output, token, header, or stack trace.

Suggested test files:

- `tests/generationBatching.test.js`
- Existing `tests/validateGeneratedPaper.test.js`
- Existing `tests/itemViews.test.js`
- Existing `tests/workerPayloadContract.test.js`

## Observation Plan Before Implementation

Recommended next observations:

| Step | Sample | Purpose |
|---|---|---|
| 8B-4 | 社會 4 items | Completed; added fourth low-count subject. |
| 8C-lite | 8-item single-call sample | Check whether latency roughly doubles or failure rate changes. |
| 8C-lite | 12-item single-call sample | Decide whether sync path remains tolerable. |

Constraints:

- Each step should be separately approved.
- No raw prompt / raw output storage.
- No large generation jump directly to 20 or 30 items.
- Record only summary metrics.

## Recommendation

Do not implement batching yet.

Recommended sequence:

1. Keep current single-call synchronous generation in production.
2. Preserve Worker safe diagnostics and `qualityMeta` gate.
3. Treat the four low-count core-subject observations as baseline coverage.
4. Run a separate owner-approved 8-item single-call observation before implementation work.
5. If 8-item or 12-item samples show unacceptable latency or repeated failures, open an 8D implementation PR for frontend serial batching first.

## Decision

Current decision:

| Question | Answer |
|---|---|
| Is batching justified for immediate implementation? | No |
| Is batching justified for design exploration? | Yes |
| Should async job queue start now? | No |
| Should prompt compression start now? | No |
| Should observations continue? | Yes, low-count or carefully staged medium-count only |

## Data Boundary

This design note intentionally does not contain:

- raw prompt
- raw output
- full API response
- generated item text
- API key
- token
- request headers
- cookies

Only summarized observations and design guidance are recorded.
