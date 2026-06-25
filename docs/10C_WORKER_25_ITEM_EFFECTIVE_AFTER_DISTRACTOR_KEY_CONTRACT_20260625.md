# 10C Worker 25-Item Effective Observation After Distractor Key Contract

Date: 2026-06-25

Status: effective 25-item production Worker sample after the distractorDesign outer-key contract fix.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `53839017-060a-4b38-af17-cdbf4b4a4009` |
| Worker deployment time | `2026-06-25T02:10:08.189Z` |
| main commit deployed to Worker | `23e3ba910fadc79523f9722f303e07e15bdd49f5` |
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
| jobId | `gen_fb0b567d-3fa3-4745-99e1-f6c9c4d993fa` |
| terminalStatus | `completed` |
| latencySeconds | 226.59 |
| pollCount | 44 |
| requestedItemCount | 25 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 4 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 41184 |
| runner qualityMetaLengthEstimate | 29704 |
| runner qualityMetaRatioEstimate | 0.721 |
| effective regression sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.86s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.36s | running | 1 / 7 | 4 / 25 | 2 |  |
| 78.83s | running | 2 / 7 | 8 / 25 | 3 |  |
| 104.30s | running | 3 / 7 | 12 / 25 | 4 |  |
| 129.78s | running | 4 / 7 | 16 / 25 | 5 |  |
| 155.27s | running | 4 / 7 | 16 / 25 | 5 |  |
| 180.75s | running | 5 / 7 | 20 / 25 | 6 |  |
| 206.23s | running | 6 / 7 | 24 / 25 | 7 |  |
| 226.59s | completed | 7 / 7 | 25 / 25 |  |  |

## Secondary Safe Scan

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 36999 |
| raw-result qualityMetaLengthEstimate | 25519 |
| correctReasonLength total | 700 |
| teacherExplanationLength total | 901 |
| distractorDesignLength total | 14910 |
| selfCheckLength total | 5325 |
| invalid distractorDesign key items | 0 |
| repeated tag warning items | `Q-001`, `Q-002`, `Q-003`, `Q-013` |
| strict repeated tag items | 4 |
| long distractorDesign entries over 140 chars | 75 |
| long distractorDesign entries over 180 chars | 41 |
| visible English token findings | 0 |
| leakage finding | none |

## Validation Warning Summary

Frontend v2 validation passed, but produced 4 warnings:

| Warning type | Count |
| --- | ---: |
| repeated distractor misconception tags | 4 |

Affected item ids in the validator warning summary:

```text
Q-001, Q-002, Q-003, Q-013
```

## Comparison

| Signal | Bounded concurrency regression | Failed tag compact sample | This sample | Judgment |
| --- | ---: | ---: | ---: | --- |
| latencySeconds | 223.32 | 237.18 | 226.59 | stable |
| validation errors | 0 | 2 | 0 | recovered |
| validation warnings | 14 | 2 | 4 | improved vs regression |
| invalid distractorDesign key items | 0 | 1 | 0 | recovered |
| long distractorDesign entries over 180 chars | 56 | 8 | 41 | improved vs regression, worse than failed sample |
| qualityMeta present | 25 / 25 | 25 / 25 | 25 / 25 | stable |
| runner outputLengthEstimate | 40916 | 39059 | 41184 | roughly stable |
| runner qualityMetaLengthEstimate | 29662 | 27731 | 29704 | roughly stable |
| runner qualityMetaRatioEstimate | 0.725 | 0.710 | 0.721 | roughly stable |
| leakage finding | none | none | none | stable |

## Interpretation

The key contract fix recovered the structural failure seen in the previous observation:

- all 7 batches completed;
- result retrieval returned 25 items;
- frontend v2 validation passed;
- every item retained `qualityMeta`;
- no invalid `distractorDesign` outer key was detected;
- no leakage marker was found.

The result still shows output weight risk. `qualityMeta` remains around 72% of the runner-estimated output, and many `distractorDesign` entries still exceed the 140-character target.

## Recommendation

This sample supports moving to the next decision point, but not to a broad 50-item claim yet.

Recommended next step:

1. Keep production concurrency at `1`.
2. Run one controlled 25-item observation with `ASYNC_GENERATION_MAX_CONCURRENT_BATCHES=2` only after explicit deployment/config approval.
3. If concurrency `2` passes, then decide whether to run a 50-item controlled observation.

Do not run 50 items before either validating concurrency `2` or accepting the current 226s+ serial wait profile.

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
