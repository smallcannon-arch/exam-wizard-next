# 10C Worker 25-Item Regression After Bounded Concurrency

Date: 2026-06-25

Status: effective 25-item production Worker regression sample after bounded batch concurrency code was deployed with production default concurrency unchanged.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `6b51efb3-6417-43bc-b9b9-77097d521eac` |
| Worker deployment time | `2026-06-25T00:42:46.041Z` |
| main commit deployed to Worker | `8d8e38954da57334999255aee358c7028fb04d10` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | Chinese language arts |
| grade | Grade 4 |
| question type | multiple choice |
| requested item count | 25 |
| batch size | 4 |
| batch count | 7 |
| configured max concurrent batches | not set |
| effective max concurrent batches | 1 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_1fd14eff-32b3-4e26-8efc-a52b5d257a52` |
| terminalStatus | `completed` |
| latencySeconds | 223.32 |
| pollCount | 43 |
| requestedItemCount | 25 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 14 |
| validationWarningSummary | repeated distractor misconception tags |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 40916 |
| runner qualityMetaLengthEstimate | 29662 |
| runner qualityMetaRatioEstimate | 0.725 |
| effective regression sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 29.48s | running | 0 / 7 | 0 / 25 | 1 |  |
| 54.97s | running | 1 / 7 | 4 / 25 | 2 |  |
| 80.50s | running | 2 / 7 | 8 / 25 | 3 |  |
| 105.99s | running | 2 / 7 | 8 / 25 | 3 |  |
| 131.51s | running | 3 / 7 | 12 / 25 | 4 |  |
| 157.04s | running | 4 / 7 | 16 / 25 | 5 |  |
| 182.52s | running | 5 / 7 | 20 / 25 | 6 |  |
| 208.01s | running | 6 / 7 | 24 / 25 | 7 |  |
| 223.32s | completed | 7 / 7 | 25 / 25 |  |  |

## Secondary Safe Scan

A secondary summary scan of the stored job result payload, without saving raw output, produced these approximate values:

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 36826 |
| raw-result qualityMetaLengthEstimate | 25572 |
| raw-result qualityMetaRatioEstimate | 0.694 |
| correctReasonLength total | 698 |
| teacherExplanationLength total | 860 |
| distractorDesignLength total | 14896 |
| selfCheckLength total | 5325 |
| visible English token findings | 0 |
| stimulus reference count | 7 |
| stimulus reference missing same-item stimulus | 1 heuristic finding: `Q-006` |
| repeated tag items by strict same-tag scan | 5 |
| long distractorDesign entries over 180 chars | 56 |
| leakage finding | none |

## Validation Warning Summary

Frontend v2 validation passed, but produced 14 warnings:

| Warning type | Count |
| --- | ---: |
| repeated distractor misconception tags | 14 |

Affected item ids in the validator warning summary:

```text
Q-006, Q-007, Q-009, Q-010, Q-011, Q-012, Q-013,
Q-014, Q-015, Q-016, Q-021, Q-022, Q-024, Q-025
```

## Interpretation

This is a successful regression sample for the bounded concurrency code path:

- the job completed with production default concurrency still effectively `1`;
- progress remained sequential and truthful;
- all 7 batches completed;
- result retrieval returned 25 items;
- frontend v2 validation passed;
- every item retained `qualityMeta`;
- no leakage marker was found;
- no Pages deploy or frontend change was involved.

The sample also shows a quality warning regression compared with the immediately previous 25-item sample:

| Signal | Previous post-compression sample | This regression sample | Judgment |
| --- | ---: | ---: | --- |
| latencySeconds | 222.17 | 223.32 | stable |
| validation errors | 0 | 0 | stable |
| validation warnings | 3 | 14 | worse |
| qualityMeta present | 25 / 25 | 25 / 25 | stable |
| runner outputLengthEstimate | 40476 | 40916 | slightly worse |
| runner qualityMetaLengthEstimate | 29089 | 29662 | slightly worse |
| runner qualityMetaRatioEstimate | 0.719 | 0.725 | slightly worse |
| leakage finding | none | none | stable |

The warning increase appears related to repeated `distractorDesign` misconception tags rather than structural failure. This does not invalidate the bounded concurrency regression, but it does weaken confidence for broad 50-item quality.

## Risk Notes

- The bounded concurrency implementation did not cause an execution failure under default concurrency `1`.
- The current sample does not validate production concurrency `2`.
- The current sample does not validate 50-item generation.
- `distractorDesign` remains output-heavy and still frequently exceeds the desired compactness target.
- Repeated misconception tags remain the clearest quality issue before advertising 50-item readiness.

## Recommendation

Do not jump directly to a 50-item production observation yet.

Recommended next decision:

1. If the priority is infrastructure confidence, enable `concurrency=2` only for a controlled 25-item observation after explicit owner approval.
2. If the priority is item quality and cost control, first add one more narrow prompt contract focused on `distractorDesign` tag diversity and entry length, then rerun a 25-item observation.

Engineering recommendation: fix the repeated `distractorDesign` tag / length issue before running 50 items. The bounded concurrency code itself passed the conservative regression check.

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
