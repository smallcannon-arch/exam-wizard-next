# 10E Partial Result Design

Date: 2026-06-25

Status: design proposal. No product code, prompt, schema, Worker API, frontend UI, deployment workflow, `tmp/`, or stash is changed by this document.

## 1. Background

The 50-item async generation path is now observable enough to distinguish infrastructure failures from content-contract failures. Recent observations show that the Worker can safely classify and fail invalid batches, but the all-or-nothing job contract still makes one failed batch discard otherwise usable items.

Partial result support changes the product contract from:

```text
completed only when every batch succeeds; otherwise failed
```

to:

```text
completed when every batch succeeds;
partial when enough items succeed and failed slots are safely identified;
failed when too few items are usable or the result is unsafe.
```

This is a result-contract change, not a small validation patch. It should be implemented in phases.

## 2. Goals

- Keep the 50-item target available.
- Prevent one failed batch from discarding otherwise usable items.
- Return safe metadata for missing slots without storing raw prompt, raw model output, item text, option text, API keys, tokens, headers, or stack traces.
- Make the first implementation useful without adding item-level regeneration.
- Preserve a clear rollback boundary.

## 3. Non-goals

The first partial-result version does not include:

- one-click regeneration of missing items
- editing or merging regenerated slots
- prompt changes
- schema changes
- D1 storage of raw generated content outside the existing safe `result_json`
- Pages deploy
- npm audit work
- PR #3 work

## 4. Job State Machine

Recommended terminal states:

| State | Meaning | Result endpoint behavior |
| --- | --- | --- |
| `completed` | All requested items passed Worker gates and final result checks. | Return full result. |
| `partial` | Enough items passed to be useful, and missing slots are safely described. | Return usable items plus missing-slot metadata. |
| `failed` | Too few items are usable, or the failure prevents safe result assembly. | Return safe error only. |

Keep existing non-terminal states such as `queued`, `running`, and `validating`.

Avoid using `partial_failed` for the user-facing terminal state. The teacher-facing semantics should be "mostly completed with gaps", not "failed".

## 5. Partial vs Failed Boundary

First-version recommendation:

| Requested count | Minimum usable items for `partial` | Completion ratio |
| ---: | ---: | ---: |
| 50 | 40 | 80% |

General rule:

```text
partial if completedItemCount >= ceil(requestedItemCount * 0.8)
failed if completedItemCount < ceil(requestedItemCount * 0.8)
```

Rationale:

- A 46-49 item result should not be discarded.
- A 40-item result is still likely useful for teacher review or selection.
- Below 80%, the missing portion is large enough that the result may feel broken instead of helpful.

This threshold is an MVP recommendation. It should be rechecked after the first production partial-result observations.

Because async generation currently runs in planned batches, the boundary is experienced at batch/slot granularity rather than as a smooth item-by-item percentage.

For a 50-item request with 4-item batches:

| Failed planned slots | Typical cause | Completed items | MVP state |
| ---: | --- | ---: | --- |
| 4 | one full batch fails | 46/50 | `partial` |
| 8 | two full batches fail | 42/50 | `partial` |
| 10 | two full batches and the final 2-item batch fail | 40/50 | `partial` |
| 12 | three full batches fail | 38/50 | `failed` |

The implementation should decide from the planned missing item slots, not merely the number of failed batches, because the final batch may contain fewer than 4 items. In practice, two failed full batches are still partial, while three failed full batches fall below the MVP threshold.

## 6. Result JSON Shape

Completed result remains compatible:

```json
{
  "items": [
    { "itemIndex": 1 }
  ],
  "batchCount": 13,
  "completedBatchCount": 13,
  "completedItemCount": 50,
  "requestedItemCount": 50,
  "partial": false,
  "missingItems": []
}
```

Partial result should use the same top-level shape with explicit missing-slot metadata:

```json
{
  "items": [
    { "itemIndex": 1 },
    { "itemIndex": 2 }
  ],
  "batchCount": 13,
  "completedBatchCount": 12,
  "completedItemCount": 46,
  "requestedItemCount": 50,
  "partial": true,
  "missingItems": [
    {
      "itemIndex": 41,
      "batchNumber": 11,
      "errorCode": "AI_OUTPUT_CONTRACT_INVALID",
      "failureItemIndex": 44,
      "contractViolationTypes": ["OPTIONS_COUNT_INVALID"],
      "contractViolationField": "options",
      "contractViolationOptionCode": "E"
    },
    {
      "itemIndex": 42,
      "batchNumber": 11,
      "errorCode": "AI_OUTPUT_CONTRACT_INVALID",
      "failureItemIndex": 44,
      "contractViolationTypes": ["OPTIONS_COUNT_INVALID"],
      "contractViolationField": "options",
      "contractViolationOptionCode": "E"
    },
    {
      "itemIndex": 43,
      "batchNumber": 11,
      "errorCode": "AI_OUTPUT_CONTRACT_INVALID",
      "failureItemIndex": 44,
      "contractViolationTypes": ["OPTIONS_COUNT_INVALID"],
      "contractViolationField": "options",
      "contractViolationOptionCode": "E"
    },
    {
      "itemIndex": 44,
      "batchNumber": 11,
      "errorCode": "AI_OUTPUT_CONTRACT_INVALID",
      "failureItemIndex": 44,
      "contractViolationTypes": ["OPTIONS_COUNT_INVALID"],
      "contractViolationField": "options",
      "contractViolationOptionCode": "E"
    }
  ]
}
```

The `itemIndex` field preserves the original 1-based requested position. Partial results must not renumber successful items into a new compact 1-N sequence. Missing slots occupy their original positions through `missingItems`, so future targeted regeneration can fill the same requested positions without redefining the result contract.

Safe missing-slot metadata may include:

- `itemIndex`: 1-based requested item index
- `batchNumber`
- safe `errorCode`
- optional `failureItemIndex` when the Worker can safely identify the offending item index
- safe contract violation enum set
- safe contract violation field enum
- sanitized option code, such as `E`
- upstream HTTP status number, when relevant

Do not include:

- raw prompt
- raw model output
- item text
- option text
- distractorDesign text
- teacherExplanation text
- API key, token, headers, stack trace
- full Gemini error body

## 7. Backend MVP Scope

The first backend PR should do only the result-contract foundation:

1. Keep running later batches after a non-fatal single-batch failure when safe to do so.
2. Persist failed-batch safe metadata.
3. Assemble successful items in order.
4. Treat a failed batch as atomic for the MVP:
   - do not salvage apparently valid items from that failed batch
   - mark every planned item slot in that batch as missing
   - optionally attach the safe offending item index as `failureItemIndex`
5. Compute missing requested item indexes from the batch plan.
6. Mark the job:
   - `completed` if all items succeed
   - `partial` if completion ratio is at least 80%
   - `failed` otherwise
7. Allow the result endpoint to return `partial` results safely.

Do not add missing-item regeneration in this PR.

Per-item salvage inside a failed batch is explicitly out of scope. It would require a separate validation and merge policy because the batch-level payload has already violated a contract.

This batch-level MVP intentionally over-counts missing items when only one item inside a failed batch caused the failure. For example, if item 44 produces an invalid option code, the whole planned batch containing items 41-44 is marked missing even if items 41-43 looked usable. This is acceptable for the first version because it keeps the backend contract safe and simple, but it means missing counts may be higher than the true number of bad model outputs. Per-item salvage is a later optimization, separate from missing-item regeneration.

## 8. Frontend MVP Scope

After the backend contract is proven, the frontend PR should:

- Display completed items normally.
- Show a clear summary such as "48 / 50 items completed; 2 items need follow-up."
- List missing item indexes and safe reason labels.
- Avoid showing raw internal details or raw model content.
- Avoid a fake regeneration button.

Teacher-facing framing should be "mostly completed with gaps", not "generation failed".

## 9. Regeneration Follow-up

Missing-item regeneration is a separate follow-up, tentatively `10F`.

It should not be bundled with the MVP because it requires:

- targeted item regeneration input
- result merge semantics
- retry/idempotency rules per missing slot
- frontend controls and state management
- additional observation and rollback planning

## 10. Tests Required

Backend MVP tests:

1. All batches succeed and job remains `completed`.
2. One failed batch with at least 80% usable items marks job `partial`.
3. Multiple failed batches below 80% marks job `failed`.
4. Partial result preserves successful item order.
5. Successful items preserve original 1-based `itemIndex` values and are not renumbered.
6. Missing item indexes are 1-based and map to the batch plan.
7. A failed batch marks every planned slot in that batch missing, even if the safe failure metadata points to one offending item.
8. Partial result endpoint returns safe item and gap metadata.
9. Result endpoint rejects unsafe or malformed partial payloads.
10. No raw prompt, raw model output, option text, item text, token, header, stack trace, or full upstream body appears in status or result responses.
11. Existing completed result behavior stays compatible.
12. Existing failed job status behavior stays compatible.

Frontend MVP tests:

1. `partial` is terminal but not treated as total failure.
2. Completed items render normally.
3. Missing slots render as safe gaps.
4. No raw internal metadata leaks to student-facing output.
5. No regeneration control appears in the MVP.

## 11. Rollback Boundary

Recommended split:

1. Backend partial-result contract PR.
2. Worker deploy and observation.
3. Frontend partial-result presentation PR.
4. Pages deploy after frontend smoke.

Rollback should be possible by reverting the backend PR and deploying the previous Worker. If additive D1 metadata is added, it should remain nullable and should not need rollback.

Backend deployment must be sequenced carefully. A Worker that returns `partial` should not be exposed to normal production UI traffic until the frontend can treat `partial` as a terminal state and explain missing slots. Backend-only deploy is acceptable for controlled observation-runner smoke, but teacher-facing production use requires the frontend presentation PR or an explicit owner acceptance of the interim behavior.

## 12. Decision Points

Stop for owner decision before:

- lowering the partial threshold below 80%
- exposing partial results in production UI
- adding missing-item regeneration
- storing any additional generated-content fields
- changing prompt or schema to reduce partial frequency
- changing the 50-item target

## 13. Recommendation

Proceed in this order:

1. Backend-only partial result contract.
2. Production Worker smoke with a known partial-prone 50-item path.
3. Frontend partial result presentation.
4. Fresh 50-item observations to compare all-or-nothing failure impact against partial-result usefulness.
5. Only then decide whether `10F` targeted regeneration is necessary.
