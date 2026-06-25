# 10I — Mixed Question Type Contract Spec

## Status

Design spec. No implementation in this document.

Production is currently protected by PR #38, which limits generation plans to standard four-choice `選擇題`. Mixed question types must remain disabled until the prompt, Worker gate, and frontend validation all follow this shared contract.

## Background

The first real mixed-type production blueprint exposed a contract mismatch:

- Requested blueprint: 44 items.
- Shape: 20 `選擇題`, 10 `是非題`, 10 `填充題`, 4 scenario/group items.
- Production jobs observed:
  - Batches 1-5 completed, 20/44 items.
  - Batches 6-10 failed with `AI_OUTPUT_CONTRACT_INVALID`.
  - Contract violation: `OPTIONS_COUNT_INVALID`.
  - `finishReason`: `STOP`.
  - `upstream_status`: `null`.
  - Batch 11 failed with `AI_ITEMS_PAYLOAD_INVALID`.

Conclusion: Gemini completed normally, and the upstream was not the problem. The current prompt and Worker gate still apply a standard four-choice contract globally. Non-choice items were measured with the wrong ruler.

## Core Principle

Question type support must be split by contract, not by patching individual failures.

The same contract must be used in three places:

1. Prompt instructions.
2. Worker contract gate.
3. Frontend v2 validation and rendering.

If one layer changes without the others, mixed-type support will remain unstable.

## Shared Base Fields

Every generated item, regardless of type, must include:

| Field | Required | Notes |
| --- | --- | --- |
| `itemId` | yes | Must match the requested slot. |
| `questionType` | yes | Must match the requested slot. |
| `question` | yes | Student-facing stem. No raw prompt or hidden notes. |
| `answer` | yes | Shape depends on question type. |
| `explanation` | yes | Teacher-facing concise explanation. |
| `score` | yes | Must match requested slot score. |
| `primaryObjectiveId` / `objectiveIds` | yes | Must stay aligned with blueprint/objectives. |
| `qualityMeta.teacherExplanation` | yes | Teacher-facing rationale. |
| `qualityMeta.correctReason` | yes | Why the answer is correct. |
| `qualityMeta.selfCheck` | yes | Contract/self-check summary. |

`qualityMeta.distractorDesign` is type-specific. It is required for choice-like items and optional or empty for non-choice items unless the type defines distractors.

## Type Contracts

### Standard Four-Choice `選擇題`

Canonical shape:

```json
{
  "questionType": "選擇題",
  "question": "題幹",
  "options": ["選項A", "選項B", "選項C", "選項D"],
  "answer": "A",
  "qualityMeta": {
    "teacherExplanation": "...",
    "correctReason": "...",
    "distractorDesign": {
      "B": { "misconception": "...", "designReason": "..." },
      "C": { "misconception": "...", "designReason": "..." },
      "D": { "misconception": "...", "designReason": "..." }
    },
    "selfCheck": "..."
  }
}
```

Rules:

- `options` must be a JSON array of exactly 4 non-empty strings.
- `answer` must be one of `A`, `B`, `C`, `D`.
- `qualityMeta.distractorDesign` must not include the correct answer key.
- Every wrong option key must have distractor design metadata.
- No `E` option or extra option keys.

### True/False `是非題`

Canonical shape:

```json
{
  "questionType": "是非題",
  "question": "敘述句",
  "answer": "O",
  "qualityMeta": {
    "teacherExplanation": "...",
    "correctReason": "...",
    "distractorDesign": {
      "X": { "misconception": "...", "designReason": "..." }
    },
    "selfCheck": "..."
  }
}
```

Rules:

- `answer` must be `O` or `X`.
- `options` must be omitted. It must not be a 2-item array during the first mixed-type implementation.
- The wrong answer key may be represented in `qualityMeta.distractorDesign`.
- Frontend rendering should not display A/B/C/D options.

### Fill-In `填充題`

Canonical shape:

```json
{
  "questionType": "填充題",
  "question": "題幹（含空格或明確作答位置）",
  "answer": "標準答案文字",
  "acceptedAnswers": ["可接受答案一", "可接受答案二"],
  "qualityMeta": {
    "teacherExplanation": "...",
    "correctReason": "...",
    "distractorDesign": {},
    "selfCheck": "..."
  }
}
```

Rules:

- `answer` must be a non-empty text answer, not `A/B/C/D` and not `O/X`.
- `acceptedAnswers` is optional, but if present it must be an array of non-empty strings.
- `options` must be omitted.
- `qualityMeta.distractorDesign` may be `{}`.
- Frontend rendering should show an answer blank and not display options.

### Scenario / Group Item `學力檢測題`

Canonical group model:

- A group has a shared `groupId`.
- The group has a shared `stimulus`.
- Each child item has its own `itemId`, `question`, `answer`, `score`, and `qualityMeta`.

Preferred response shape for generated child items:

```json
[
  {
    "itemId": "Q-041-1",
    "groupId": "G-041",
    "questionType": "學力檢測題",
    "stimulus": "共同情境文字",
    "question": "子題一",
    "options": ["選項A", "選項B", "選項C", "選項D"],
    "answer": "A",
    "qualityMeta": {
      "teacherExplanation": "...",
      "correctReason": "...",
      "distractorDesign": {
        "B": { "misconception": "...", "designReason": "..." },
        "C": { "misconception": "...", "designReason": "..." },
        "D": { "misconception": "...", "designReason": "..." }
      },
      "selfCheck": "..."
    }
  }
]
```

Rules:

- At least one child in the group must include a non-empty `stimulus`.
- Preferred: every child repeats the same `stimulus` to avoid inheritance ambiguity.
- Child items are choice-like in the first mixed-type implementation unless a later contract explicitly supports non-choice group children.
- Child item `options` and `answer` follow the standard four-choice contract.
- Group score and child scores must match the requested slot configuration.

## Prompt Requirements

The prompt must remove the current global contradiction.

Do not say globally:

- `options` must always be an array.
- `answer` must always be `A/B/C/D`.
- every item must have distractor keys `A/B/C/D`.

Instead, prompt rules must be type-specific:

- `選擇題`: exactly 4 options, answer `A/B/C/D`.
- `是非題`: no options, answer `O/X`.
- `填充題`: no options, answer text.
- `學力檢測題`: shared stimulus plus child items; first implementation uses choice-like child items.

## Worker Gate Requirements

Worker validation must switch on the requested slot `questionType`, not only on what the model returned.

Minimum gates:

- Reject if returned `questionType` differs from requested slot type.
- Apply the four-choice option gate only to `選擇題` and choice-like `學力檢測題` child items.
- Apply the `O/X` gate to `是非題`.
- Apply the text answer gate to `填充題`.
- Apply the stimulus/group gate to `學力檢測題`.
- Continue using safe error metadata only. Do not store raw prompt, raw output, item text, option text, API keys, tokens, headers, or stack traces.

Recommended error codes:

- `AI_TYPE_CONTRACT_INVALID`
- `AI_CHOICE_OPTIONS_INVALID`
- `AI_TRUE_FALSE_ANSWER_INVALID`
- `AI_FILL_IN_ANSWER_INVALID`
- `AI_GROUP_STIMULUS_INVALID`
- `AI_GROUP_CHILD_CONTRACT_INVALID`

Existing codes such as `AI_OUTPUT_CONTRACT_INVALID`, `AI_STIMULUS_MISSING`, and `AI_ITEMS_PAYLOAD_INVALID` may remain as compatibility wrappers, but typed subcodes should identify the exact rule.

## Frontend Validation And Rendering Requirements

Frontend v2 validation must use the same type split:

- `選擇題`: require 4 options and answer key.
- `是非題`: require `O/X`, do not require options.
- `填充題`: require text answer, do not require options.
- `學力檢測題`: require group/stimulus integrity and child item contract.

Rendering:

- `選擇題`: display options.
- `是非題`: show an answer blank, no options.
- `填充題`: show an answer blank, no options.
- `學力檢測題`: render stimulus once per group and render child items underneath.

Export must follow the same rendering rules so preview, print, Word, and Excel do not disagree.

## Regression Case

Preserve the mixed blueprint that exposed the issue as the first regression case:

- Subject: natural science.
- Content theme: stars / burning.
- Requested count: 44.
- Shape: 20 `選擇題`, 10 `是非題`, 10 `填充題`, 4 scenario/group items.
- Current failure pattern:
  - `OPTIONS_COUNT_INVALID` on non-choice batches.
  - `AI_ITEMS_PAYLOAD_INVALID` on scenario/group batch.

Typed contract support is not complete until this blueprint can complete or return a valid partial result with typed, safe diagnostics.

## Acceptance Criteria

Before re-enabling mixed question types:

1. Prompt, Worker gate, and frontend validation all use this shared type contract.
2. Unit tests cover each type contract.
3. Mock tests cover invalid payloads for each type without leaking raw content.
4. The 44-item mixed regression blueprint is run as a low-frequency production observation.
5. If failure occurs, status exposes safe typed diagnostics that identify the failed type/rule.
6. No raw prompt, raw output, item text, option text, token, API key, headers, or stack trace are stored in repo or returned to the teacher-facing UI.

## Out Of Scope

- Changing the model.
- Loosening the current production stopgap.
- Supporting open-ended essay scoring.
- Supporting non-choice children inside scenario/group items.
- Targeted regeneration changes from 10G.

## Current Decision

Keep production limited to standard four-choice `選擇題` until this typed contract is implemented across all three layers.
