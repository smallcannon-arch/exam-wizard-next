# 10C Worker 25-Item Observation With Concurrency 2

Date: 2026-06-25

Status: effective 25-item production Worker sample after enabling bounded batch concurrency `2`.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `d82210fe-8673-4359-b312-a89847121cb5` |
| Worker deployment time | `2026-06-25T02:21:21.103Z` |
| main commit deployed to Worker | `a1db593a29e8cb17b602330a66d71007e28fa6c4` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | Chinese language arts |
| grade | Grade 4 |
| question type | multiple choice |
| requested item count | 25 |
| batch size | 4 |
| batch count | 7 |
| configured max concurrent batches | 2 |
| effective max concurrent batches | 2 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_56877b53-0a95-4308-8b52-146ac857763a` |
| terminalStatus | `completed` |
| latencySeconds | 139.96 |
| pollCount | 27 |
| requestedItemCount | 25 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 5 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 40297 |
| runner qualityMetaLengthEstimate | 28531 |
| runner qualityMetaRatioEstimate | 0.708 |
| effective regression sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.74s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.28s | running | 2 / 7 | 8 / 25 | 3 |  |
| 78.77s | running | 2 / 7 | 8 / 25 | 3 |  |
| 104.27s | running | 4 / 7 | 16 / 25 | 5 |  |
| 129.76s | running | 6 / 7 | 24 / 25 | 7 |  |
| 139.96s | completed | 7 / 7 | 25 / 25 |  |  |

## Secondary Safe Scan

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 35915 |
| raw-result qualityMetaLengthEstimate | 24149 |
| correctReasonLength total | 601 |
| teacherExplanationLength total | 744 |
| distractorDesignLength total | 13718 |
| selfCheckLength total | 5325 |
| invalid distractorDesign key items | 0 |
| repeated tag warning items | `Q-001`, `Q-002`, `Q-003`, `Q-004`, `Q-023` |
| strict repeated tag items | 3 |
| long distractorDesign entries over 140 chars | 75 |
| long distractorDesign entries over 180 chars | 13 |
| visible English token findings | 0 |
| leakage finding | none |

## Comparison

| Signal | Concurrency 1 effective sample | Concurrency 2 sample | Judgment |
| --- | ---: | ---: | --- |
| latencySeconds | 226.59 | 139.96 | improved by about 38.2% |
| validation errors | 0 | 0 | stable |
| validation warnings | 4 | 5 | roughly stable |
| invalid distractorDesign key items | 0 | 0 | stable |
| long distractorDesign entries over 180 chars | 41 | 13 | improved |
| qualityMeta present | 25 / 25 | 25 / 25 | stable |
| runner outputLengthEstimate | 41184 | 40297 | slightly improved |
| runner qualityMetaLengthEstimate | 29704 | 28531 | improved |
| runner qualityMetaRatioEstimate | 0.721 | 0.708 | improved |
| leakage finding | none | none | stable |

## Interpretation

Concurrency `2` is an effective improvement for the observed 25-item workload:

- the Worker completed all 7 batches;
- progress snapshots show two batches completing per wave;
- latency dropped from 226.59s to 139.96s;
- frontend v2 validation passed;
- every item retained `qualityMeta`;
- no invalid `distractorDesign` key was detected;
- no leakage marker was found.

The sample does not prove 50-item readiness by itself. It does show that bounded backend concurrency is a viable way to reduce wait time without requiring the frontend to send multiple requests.

## Remaining Risks

- `distractorDesign` remains output-heavy.
- Validation warnings remain around repeated misconception tags.
- This is a single 25-item sample, not a 50-item run.
- Concurrency above `2` is not validated.
- 50 items will likely require roughly 13 batches at the current batch size; with concurrency `2`, expected wall-clock time may still be several minutes.

## Recommendation

This is the next major decision point.

Recommended path:

1. Keep production concurrency at `2` for now.
2. Run one controlled 50-item observation only if the owner accepts the cost and wait-time risk.
3. If the 50-item observation passes, document it as the first 50-item readiness baseline.
4. If it fails, do not raise concurrency further; inspect failure type first.

Do not enable concurrency `3` before collecting a 50-item result at concurrency `2`.

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
