# 10C Worker 50-Item Math Observation With Concurrency 2

Date: 2026-06-25

Status: effective 50-item production Worker sample for math with bounded batch concurrency `2`.

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
| subject | Math |
| grade | Grade 4 |
| question type | multiple choice |
| requested item count | 50 |
| batch size | 4 |
| batch count | 13 |
| configured max concurrent batches | 2 |
| effective max concurrent batches | 2 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_46f8c46d-45ff-4c45-9b36-91a703e58657` |
| terminalStatus | `completed` |
| latencySeconds | 321.03 |
| pollCount | 62 |
| requestedItemCount | 50 |
| completedBatchCount | 13 / 13 |
| completedItemCount | 50 / 50 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 50 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 26 |
| qualityMetaPresentCount | 50 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 81384 |
| runner qualityMetaLengthEstimate | 61505 |
| runner qualityMetaRatioEstimate | 0.756 |
| effective 50-item sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 28.32s | running | 0 / 13 | 0 / 50 | 1 |  |
| 53.82s | running | 2 / 13 | 8 / 50 | 3 |  |
| 79.46s | running | 2 / 13 | 8 / 50 | 3 |  |
| 105.34s | running | 2 / 13 | 8 / 50 | 3 |  |
| 131.00s | running | 4 / 13 | 16 / 50 | 5 |  |
| 156.64s | running | 6 / 13 | 24 / 50 | 7 |  |
| 182.28s | running | 6 / 13 | 24 / 50 | 7 |  |
| 208.09s | running | 8 / 13 | 32 / 50 | 9 |  |
| 234.02s | running | 8 / 13 | 32 / 50 | 9 |  |
| 259.67s | running | 10 / 13 | 40 / 50 | 11 |  |
| 285.20s | running | 10 / 13 | 40 / 50 | 11 |  |
| 310.77s | running | 12 / 13 | 48 / 50 | 13 |  |
| 321.03s | completed | 13 / 13 | 50 / 50 |  |  |

## Secondary Safe Scan

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 72155 |
| raw-result qualityMetaLengthEstimate | 52276 |
| correctReasonLength total | 1546 |
| teacherExplanationLength total | 2091 |
| distractorDesignLength total | 30643 |
| selfCheckLength total | 10650 |
| invalid distractorDesign key items | 0 |
| validation repeated tag warning items | 26 |
| strict repeated tag items | 1 |
| long distractorDesign entries over 140 chars | 150 |
| long distractorDesign entries over 180 chars | 149 |
| long distractorDesign entries over 220 chars | 0 |
| visible English token findings | 0 |
| leakage finding | none |

## Validation Warning Summary

Frontend v2 validation passed, but produced 26 warnings:

| Warning type | Count |
| --- | ---: |
| repeated distractor misconception tags | 26 |

The stricter same-tag scan found 1 item with all wrong options sharing the same tag. The broader validator warning count is still worth tracking because math tag diversity remains weaker than desired.

## Comparison With Chinese 50-Item Sample

| Signal | Chinese 50-item concurrency 2 | Math 50-item concurrency 2 | Judgment |
| --- | ---: | ---: | --- |
| requested item count | 50 | 50 | same |
| batch count | 13 | 13 | same |
| latencySeconds | 288.59 | 321.03 | math slower |
| validation errors | 0 | 0 | stable |
| validation warnings | 9 | 26 | math worse |
| invalid distractorDesign key items | 0 | 0 | stable |
| qualityMeta present | 50 / 50 | 50 / 50 | stable |
| runner outputLengthEstimate | 85611 | 81384 | math lower |
| runner qualityMetaLengthEstimate | 62129 | 61505 | similar |
| runner qualityMetaRatioEstimate | 0.726 | 0.756 | math higher |
| leakage finding | none | none | stable |

## Interpretation

This is an effective math 50-item production Worker sample:

- all 13 batches completed;
- result retrieval returned 50 items;
- frontend v2 validation passed;
- every item retained `qualityMeta`;
- no invalid `distractorDesign` key was detected;
- no leakage marker was found.

Math is slower than the Chinese 50-item sample and produced more repeated-tag warnings. It remains structurally stable, but qualityMeta and distractorDesign output cost remain high.

## Remaining Risks

- 50-item latency is about 5.35 minutes for this math sample.
- Math `distractorDesign` tag diversity is weaker than desired.
- `qualityMeta` remains most of the output payload.
- Natural science has not yet been validated at 50 items.
- Concurrency `3` remains unvalidated and should not be enabled based on these samples alone.

## Recommendation

The system now has two effective 50-item samples at concurrency `2`:

1. Chinese language arts, Grade 4.
2. Math, Grade 4.

Recommended next decision:

1. Keep Worker concurrency at `2`.
2. Run one controlled natural science 50-item observation before claiming broad 50-item readiness.
3. If natural science also passes, document a first cross-subject 50-item readiness baseline.
4. Do not raise concurrency to `3` yet.

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
