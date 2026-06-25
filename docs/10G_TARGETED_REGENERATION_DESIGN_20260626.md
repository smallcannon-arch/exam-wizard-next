# 10G Targeted Regeneration Design

Date: 2026-06-26

Status: design proposal, not started. This document changes no product code, prompt, schema, Worker API, deployment workflow, `tmp/`, or stash.

## Start Gate

Do not start 10G only because the design exists.

Start targeted regeneration after the partial-result MVP has produced real production feedback. The minimum observation points are:

- first real production `partial` job has been inspected end to end;
- teacher handling of gaps is understood:
  - do they use the partial preview;
  - do they restart the whole generation;
  - do they complain that a partial paper cannot be printed/exported;
  - do they manually copy usable items;
- the need for selected-item regeneration is confirmed by observed use, not only by engineering preference.

If teachers mostly restart the whole generation after a partial result, 10G should become high priority because the MVP's partial preview is not closing the workflow. If teachers can work with the preview and gaps without friction, 10G can remain a planned enhancement.

## 1. Core Principle

Targeted regeneration should use one engine:

```text
given a jobId and a set of itemIndex values,
regenerate only those requested positions,
merge successful replacements back into the original result,
then recompute the job state.
```

"Regenerate failed missing slots" and "regenerate teacher-selected unsatisfactory items" share the same engine and the same checkbox UI. The difference is only the source of the selected `itemIndex` values.

The engine accepts any subset of requested `itemIndex` values. It is not limited to Worker-detected missing slots.

## 2. Scope

This version, `10G`, should include:

- targeted regeneration engine
- unified checkbox regeneration UI
- support for missing items
- support for teacher-selected unsatisfactory generated items
- merge behavior that overwrites by original `itemIndex`

This version should not include:

- prompt changes for teacher dissatisfaction reasons
- a "reason for dissatisfaction" input
- regeneration attempt limits
- restore previous version after regeneration
- Pages deploy
- Worker deploy
- npm audit work
- PR #3 work
- `tmp/` or stash handling

Those out-of-scope items may be considered later, but they should not be bundled into the first targeted regeneration implementation.

## 3. Engine Contract

Input:

```json
{
  "jobId": "gen_12345678",
  "targetIndices": [12, 38, 44]
}
```

Behavior:

1. Validate that every `targetIndices` value is within the original job's requested slots.
2. Reject duplicate target indexes.
3. Regenerate only those indexes.
4. Use the existing batch/generation logic with the requested count equal to the subset size.
5. Run regenerated items through the same validation chain as first-generation items:
   - Worker minimum item contract
   - contract gate
   - qualityMeta gate
   - leakage gate
   - v2 validation path where applicable
6. Merge successful regenerated items back into their original positions.
7. Recompute job state:
   - `completed` if every requested slot is now filled
   - `partial` if missing slots remain above the partial threshold
   - `failed` only if the result can no longer be assembled safely

Regenerated items must not bypass any gate that first-generation items must pass.

## 4. Merge Invariants

The merge must preserve these invariants:

- The final item index set plus missing index set covers the requested slots with no gaps.
- No requested slot appears more than once.
- Successful regeneration overwrites the specified `itemIndex`; it does not append.
- Failed regeneration does not destroy prior usable content.
- A missing slot that fails regeneration remains missing.
- A teacher-selected existing item that fails regeneration keeps the previous item unchanged.
- Slot coverage validation from PR #35 should be reused.

This is the most important safety rule for teacher-selected items: a failed regeneration attempt must not make the teacher lose an item that already existed.

## 5. Idempotency

Targeted regeneration is an overwrite operation by `itemIndex`.

If the same targeted regeneration request is executed more than once:

- it must not append duplicate items
- the latest successful replacement for each target index wins
- failed targets remain in their previous state

Generation failures in the subset should not write partial replacement payloads. This follows the existing principle that failed batches do not persist unsafe item payloads.

## 6. Unified Checkbox UI

The result page should provide one checkbox model:

- Missing slots are checked by default.
- Generated items can also be checked if the teacher is unsatisfied.
- One button regenerates every selected `itemIndex`.

Recommended button label:

```text
重新生成選取題目
```

The same action handles both:

- failed/missing items
- teacher-selected unsatisfactory generated items

Do not split these into two separate flows in the first implementation.

During regeneration:

- show progress
- keep existing generated items visible
- disable duplicate submit for the same regeneration action
- update regenerated items in their original positions after success

The UI must be honest: regeneration does not guarantee a better item. Since the prompt remains the same and temperature remains probabilistic, copy should avoid implying that the replacement will necessarily improve quality.

Recommended helper copy:

```text
系統會重新生成選取題目。新題不保證一定比原題更好，請完成後再人工確認。
```

## 7. Safety Boundary

Targeted regeneration must keep the same safety boundary as first generation:

- no raw prompt storage
- no raw model output storage
- no full failed item text storage
- no option text from failed payloads
- no API key, token, header, or stack trace storage
- no full upstream error body storage

Missing and failure metadata should remain safe enums and numeric/index metadata only.

Regenerated items must pass the same leakage gate as initial items.

## 8. Validation Plan

Use mocks first. Do not depend on model randomness to validate targeted regeneration.

Required tests:

1. Regenerating a specified subset succeeds and overwrites the correct original indexes.
2. Slot coverage remains complete after merge.
3. No duplicate item appears after regeneration.
4. Partially failed subset regeneration preserves failed indexes:
   - missing slots stay missing
   - existing teacher-selected items stay unchanged
5. Job state becomes `completed` when all missing slots are filled.
6. Job state remains `partial` when missing slots remain.
7. Teacher-selected existing item regeneration overwrites only the selected indexes.
8. Repeating the same targeted regeneration does not append duplicates.
9. Targeted regeneration does not affect first-generation behavior.
10. Targeted regeneration does not affect partial-result presentation behavior.
11. No raw prompt, raw model output, option text, failed item text, API key, token, header, stack trace, or full upstream body appears in status/result responses.

## 9. Future Options

Possible follow-ups after the first targeted regeneration release:

- teacher dissatisfaction reason input
- prompt adjustment based on teacher reason
- regeneration attempt limits
- restore previous item after regeneration
- side-by-side compare old vs regenerated item

These are intentionally not included in `10G`.

## 10. Recommendation

Do not implement `10G` until the partial-result MVP is merged, deployed, and shown to be understandable to teachers.

The purpose of this document is to fix the direction now:

- one engine
- arbitrary `itemIndex` subset
- one checkbox UI
- missing and unsatisfactory items in the same action
- overwrite, never append
- failed regeneration preserves existing usable content
