# 10B Production Worker 25-Item Observation

Date: 2026-06-25

Status: failed observation audit trail. This is not an effective 25-item baseline sample because frontend v2 validation failed after the Worker job completed.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, or cookies.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | 國語 |
| grade | 四年級 |
| requested item count | 25 |
| question type | 選擇題 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_ccf2f02c-28e9-4dab-95cf-835647d3a1f9` |
| terminalStatus | `completed` |
| latencySeconds | 246.68 |
| pollCount | 47 |
| batchCount | 7 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | fail |
| validationErrorCount | 1 |
| validationWarningCount | 9 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| outputLengthEstimate | 43196 |
| qualityMetaLengthEstimate | 31721 |
| qualityMetaRatioEstimate | 0.734 |

## Validation Failure

The single blocking validation error was:

- `Q-015`: missing `question`.

A follow-up safe summary check of `Q-015` found:

| Field | Value |
| --- | --- |
| itemId | `Q-015` |
| has question | false |
| has stem / prompt / problem / questionText / itemText / text | false |
| qualityMeta present | true |
| options count | 4 |
| answer present | true |
| raw leakage key detected | false |

This confirms the item had answer/options/qualityMeta but no question-like field that frontend normalization could recover.

## Progress Snapshots

| Elapsed | Status |
| --- | --- |
| 83.66s | running; 2 / 7 batches completed; 8 / 25 items completed |
| 129.44s | running; 3 / 7 batches completed; 12 / 25 items completed |
| 160.06s | running; 4 / 7 batches completed; 16 / 25 items completed |
| 205.96s | running; 5 / 7 batches completed; 20 / 25 items completed |
| 236.49s | running; 6 / 7 batches completed; 24 / 25 items completed |
| 246.68s | completed; 7 / 7 batches completed; 25 / 25 items completed |

## Interpretation

The async Worker job infrastructure completed all seven batches and preserved `qualityMeta` for every returned item, but the result was not import-ready because one item missed the required question text.

This points to a narrower contract gap than the earlier `qualityMeta` issue:

1. The Worker minimum gate currently blocks missing `qualityMeta`.
2. It does not yet block a completed item missing the canonical question / stem text.
3. The frontend v2 validator correctly prevented import.
4. A production UI request of this shape would likely wait for the full job and then fail at frontend validation.

## Recommended Follow-Up

Open a small independent Worker hardening task:

- Add a minimum item-content gate before marking generated batch payloads as valid.
- Require each item to have recoverable question text via one of the accepted fields: `question`, `stem`, `prompt`, `problem`, `questionText`, `itemText`, or `text`.
- Keep response errors safe and summary-only.
- Do not add full frontend v2 validation to Worker.
- Add tests for missing question-like fields.

After that hardening is merged and Worker-deployed, rerun one 25-item observation. Do not run a 50-item observation until a 25-item sample passes.

## Data Boundary

This file intentionally does not include:

- raw prompt
- raw output
- full generated item text
- full API response
- API key
- token
- request headers
- cookies
- repo-external raw output files
