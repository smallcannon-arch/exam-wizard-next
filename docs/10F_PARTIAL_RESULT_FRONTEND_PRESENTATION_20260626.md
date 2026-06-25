# 10F Partial Result Frontend Presentation

Date: 2026-06-26

Status: implemented and deployed as part of the partial-result MVP on 2026-06-26. This document remains the frontend presentation contract and release note; it does not itself change product code, prompt, schema, Worker API, deployment workflow, `tmp/`, or stash.

## Release Status Update

PR #37 implemented this presentation layer and was deployed together with backend partial-result support. The production release used main commit `a950d2dac115b3a2846d827d0944126d26511ed6`, Worker version `9fe372c9-0219-4de0-bcff-e54a0e409066`, and GitHub Pages workflow run `28196911672`.

Post-release checks confirmed:

- the production page loads with HTTP 200 and title `命題系統`;
- the main UI can switch steps without fatal console errors;
- deployed frontend JS contains the partial final-output block;
- normal 50-item generation still completes successfully.

The release smoke did not naturally trigger a real `partial` job. The first real production partial should be inspected end to end: missing cards in original positions, success framing, no raw `errorCode` or enum in teacher copy, consistent review/audit/output summaries, and disabled print/Word/Excel output while gaps remain.

## 1. Background

`10E` defines the backend partial-result contract. The Worker can now finish an async generation job as:

- `completed`: every requested slot produced a safe item.
- `partial`: enough slots produced safe items, and missing slots are safely described.
- `failed`: too few slots are usable, or the result cannot be assembled safely.

The frontend still treats async generation as a completed-or-failed flow. A production Worker that returns `partial` should not be exposed to normal teacher-facing traffic until the frontend can treat `partial` as a terminal state and explain the missing slots.

This document defines the first frontend presentation for `partial`. It is a UI contract proposal, not an implementation.

## 2. Goals

- Present `partial` as "mostly completed with gaps", not as total generation failure.
- Preserve original requested item positions.
- Show missing slots as safe placeholders.
- Keep generated items and missing-slot metadata separate in frontend state.
- Avoid exposing raw internal diagnostics to teachers or student-facing output.
- Present missing slots without result-page regeneration controls in the MVP.
- Keep targeted missing-item regeneration out of the MVP.

## 3. Non-goals

This frontend MVP does not include:

- targeted missing-item regeneration
- per-item salvage from a failed batch
- backend result-contract changes
- prompt changes
- schema changes
- Worker deploy
- Pages deploy
- npm audit work
- PR #3 work
- `tmp/` or stash handling

Targeted missing-item regeneration moves to a later `10G` follow-up.

## 4. Teacher-facing Framing

Use success framing:

```text
已完成 47 / 50 題，3 題待補
```

Do not frame a partial result as:

```text
生成失敗
```

Recommended copy:

- Title: `已完成 X / Y 題，N 題待補`
- Body: `可先檢視已完成題目；待補題位已保留，可於後續補齊。`
- Missing slot label: `此題待補`

Avoid overly alarming wording. A `partial` result has crossed the backend usefulness threshold and is not the same as a failed job.

## 5. State Model

Do not store missing-slot placeholders as generated items.

Recommended state shape:

```js
{
  items: [/* valid generated items only */],
  partialResult: {
    partial: true,
    requestedItemCount: 50,
    completedItemCount: 47,
    missingItems: [
      {
        itemIndex: 38,
        batchNumber: 10,
        errorCode: "AI_OUTPUT_CONTRACT_INVALID"
      }
    ]
  }
}
```

`state.items` remains the source of real generated items for editing, validation, audit, and exports.

`partialResult.missingItems` stores safe missing-slot metadata only. It must not contain:

- raw prompt
- raw model output
- item text
- option text
- distractorDesign text
- teacherExplanation text
- API key, token, headers, stack trace
- full upstream error body

The review UI should build a presentation view model by combining real `items` and `partialResult.missingItems` by original 1-based `itemIndex`.

## 6. Slot Rendering

Preserve original requested positions.

The item review screen should render slots in requested order:

```text
1. generated item
2. generated item
3. missing slot placeholder
4. generated item
```

Do not compact partial results into a new 1-N sequence. If slot 38 failed, the teacher should see that slot 38 is waiting for follow-up.

Missing slot card requirements:

- Show the original item number.
- Show a safe teacher-facing reason label.
- Do not show raw internal error codes as primary copy.
- Do not include raw item or option content.
- Do not offer targeted regeneration in the MVP.

Example:

```text
第 38 題待補
此題未能生成，可於後續補齊。
```

## 7. Missing Slot Copy

The MVP should use one teacher-facing missing-slot sentence.

Recommended copy:

```text
此題未能生成，可於後續補齊。
```

Do not render the raw `errorCode`, contract violation enum, upstream status, sanitized option code, or batch diagnostics in the normal teacher-facing UI.

Do not classify missing slots in teacher-facing copy for the MVP. The result page should communicate that a slot is preserved and waiting for follow-up, not ask teachers to interpret technical failure classes.

If a future debug view is needed, it must remain separate from student-facing output and should still use only safe metadata.

## 8. Gap Handling in the MVP

The first version should not place any regeneration button on the result page.

The partial result page is responsible only for truthful presentation:

- Display successfully generated items while preserving original item positions.
- Mark missing slots with success framing such as `已完成 X / Y 題，N 題待補`.
- Give each missing slot one human-readable sentence, such as `此題未能生成，可於後續補齊`.
- Do not classify missing slots in teacher-facing copy.
- Do not show raw `errorCode`, contract violation enum, upstream status, sanitized option code, or batch diagnostics.

Whole-generation rerun is not a result-page feature. If a teacher wants to start over, they can launch a new generation through the existing generation workflow. The result page should not duplicate that entry point.

Targeted regeneration for missing items and teacher-selected unsatisfactory items belongs to `10G`. The MVP marks gaps only and provides no in-result regeneration action.

Change note: the original 10F draft treated `重新產生整份` as the missing-slot escape route. After product-flow review, whole-generation rerun is considered equivalent to starting a new generation and does not need a duplicate result-page control. The API-saving follow-up is targeted regeneration, so it moves to `10G`.

## 9. Audit and Export Behavior

Because `state.items` contains only real generated items, existing validation, audit, and export code must not treat missing placeholders as real questions.

Recommended MVP behavior:

- Review screen: show generated items plus missing-slot placeholders.
- Audit screen: show a partial-result notice before the existing validation summary.
- Student and teacher output preview: include a clear notice if missing slots remain.
- Export/download/print: keep final output disabled while missing slots remain.

MVP policy: when a partial result still has missing slots, keep the output preview visible but disable print, Word export, and Excel export. Show a clear message such as `這份試卷仍有待補題位，暫不匯出正式卷。請先補齊後再輸出。`

The important invariant is that placeholders must never appear as fake generated questions, and the UI must not silently export a shorter paper as if it were final.

## 10. Frontend Implementation Targets

Likely frontend files:

- `frontend/src/app.js`
- `frontend/src/style.css`
- a small helper such as `frontend/src/core/partialResult.js`
- focused tests such as `tests/partialResult.test.js`

Expected app-level changes:

1. Treat async status `partial` as a terminal success-like state.
2. Fetch the result endpoint for `partial` jobs.
3. Accept result payloads with `partial: true`, `items`, and `missingItems`.
4. Map generated items to slots without renumbering `itemIndex`.
5. Store valid items separately from partial missing metadata.
6. Render missing placeholders in the item review screen.
7. Show a partial-result notice in later audit/export steps.
8. Avoid regeneration controls on the partial-result page in the MVP.

## 11. Tests Required

Frontend MVP tests:

1. `partial` async status is terminal and fetches the result endpoint.
2. Partial result payload stores valid generated items separately from missing slots.
3. Slot view model preserves original 1-based item positions.
4. Missing slots render as placeholders instead of generated item cards.
5. Teacher UI uses success framing such as `已完成 X / Y 題，N 題待補`.
6. Teacher UI does not expose raw `errorCode`, contract violation enum, upstream status, raw prompt, raw output, API key, token, headers, item text from failed batches, or option text from failed batches.
7. No result-page regeneration button appears in the MVP.
8. Existing generation start flow remains unchanged outside the result page.
9. Existing completed-result behavior remains unchanged.
10. Existing failed-result behavior remains unchanged.

Manual smoke after frontend implementation:

1. Use a controlled partial-capable result or mocked response.
2. Confirm the UI shows completed count and missing count.
3. Confirm missing slots occupy original item positions.
4. Confirm valid generated items remain editable.
5. Confirm raw internal metadata is not visible in the teacher-facing UI.
6. Confirm export/audit behavior is safe when missing slots remain.

## 12. Deployment Note

PR #35 merged the backend contract into `main`, but it should not be deployed to normal production teacher-facing traffic alone.

Recommended release sequence:

1. Merge the frontend partial presentation PR.
2. Run final frontend and Worker smoke.
3. Deploy Worker and Pages as one coordinated partial-result release decision.
4. Run production smoke that verifies:
   - `partial` is terminal.
   - the review screen shows `已完成 X / Y 題，N 題待補`.
   - missing slots occupy original positions.
   - raw internal metadata is not visible.
   - existing completed and failed jobs still behave normally.

Do not deploy Pages or Worker as part of this design document.

## 13. Follow-up: 10G Targeted Regeneration

Targeted missing-item regeneration remains a separate follow-up.

It should not start until the MVP proves that teachers can understand and use partial results without item-level regeneration.

`10G` should define:

- targeted regeneration request shape
- support for both missing slots and teacher-selected unsatisfactory items
- arbitrary `itemIndex` subset input
- missing-slot and overwrite idempotency
- merge semantics
- handling repeated failure for the same slot
- unified checkbox UI
- observation and rollback criteria

## 14. Recommendation

Proceed with a docs-only PR for this design, then implement the frontend MVP in a separate code PR.

The frontend code PR should keep its first release narrow:

1. terminal `partial` handling
2. safe partial state
3. missing-slot placeholders
4. success-framed teacher copy
5. no targeted regeneration
6. no deploy until Worker and Pages can be released together
