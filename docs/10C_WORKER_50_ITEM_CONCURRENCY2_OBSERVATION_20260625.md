# 10C Worker 50-Item Observation With Concurrency 2

Date: 2026-06-25

Status: effective 50-item production Worker sample with bounded batch concurrency `2`.

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
| requested item count | 50 |
| batch size | 4 |
| batch count | 13 |
| configured max concurrent batches | 2 |
| effective max concurrent batches | 2 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_454ab9cf-a534-42cc-a37c-d4c8a5641e0f` |
| terminalStatus | `completed` |
| latencySeconds | 288.59 |
| pollCount | 56 |
| requestedItemCount | 50 |
| completedBatchCount | 13 / 13 |
| completedItemCount | 50 / 50 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 50 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 9 |
| qualityMetaPresentCount | 50 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 85611 |
| runner qualityMetaLengthEstimate | 62129 |
| runner qualityMetaRatioEstimate | 0.726 |
| effective 50-item sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 28.35s | running | 0 / 13 | 0 / 50 | 1 |  |
| 53.87s | running | 2 / 13 | 8 / 50 | 3 |  |
| 79.36s | running | 2 / 13 | 8 / 50 | 3 |  |
| 104.89s | running | 4 / 13 | 16 / 50 | 5 |  |
| 130.40s | running | 4 / 13 | 16 / 50 | 5 |  |
| 155.94s | running | 6 / 13 | 24 / 50 | 7 |  |
| 181.44s | running | 8 / 13 | 32 / 50 | 9 |  |
| 206.91s | running | 8 / 13 | 32 / 50 | 9 |  |
| 232.44s | running | 10 / 13 | 40 / 50 | 11 |  |
| 257.99s | running | 10 / 13 | 40 / 50 | 11 |  |
| 283.49s | running | 12 / 13 | 48 / 50 | 13 |  |
| 288.59s | completed | 13 / 13 | 50 / 50 |  |  |

## Secondary Safe Scan

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 76705 |
| raw-result qualityMetaLengthEstimate | 53223 |
| correctReasonLength total | 1559 |
| teacherExplanationLength total | 1913 |
| distractorDesignLength total | 31719 |
| selfCheckLength total | 10650 |
| invalid distractorDesign key items | 0 |
| repeated tag warning items | `Q-001`, `Q-027`, `Q-034`, `Q-036`, `Q-039`, `Q-045`, `Q-047`, `Q-048`, `Q-050` |
| strict repeated tag items | 3 |
| long distractorDesign entries over 140 chars | 150 |
| long distractorDesign entries over 180 chars | 96 |
| visible English token findings | 0 |
| leakage finding | none |

## Stimulus Heuristic Note

The validator passed. A secondary heuristic scan found two items with `根據` in the question and empty `stimulus`, but both questions appear structurally self-contained by containing inline quoted sentence context.

| Field | Value |
| --- | --- |
| heuristic item ids | `Q-012`, `Q-042` |
| stimulusLength | 0 |
| inline quoted context | yes |
| blocking validation issue | no |

This is recorded as a non-blocking heuristic signal, not a failed sample.

## Comparison With 25-Item Concurrency 2 Sample

| Signal | 25-item concurrency 2 | 50-item concurrency 2 | Judgment |
| --- | ---: | ---: | --- |
| requested item count | 25 | 50 | doubled |
| batch count | 7 | 13 | expected |
| latencySeconds | 139.96 | 288.59 | roughly scales with batch count |
| validation errors | 0 | 0 | stable |
| validation warnings | 5 | 9 | roughly proportional |
| invalid distractorDesign key items | 0 | 0 | stable |
| qualityMeta present | 25 / 25 | 50 / 50 | stable |
| runner outputLengthEstimate | 40297 | 85611 | roughly doubled |
| runner qualityMetaLengthEstimate | 28531 | 62129 | roughly doubled |
| runner qualityMetaRatioEstimate | 0.708 | 0.726 | stable-high |
| leakage finding | none | none | stable |

## Interpretation

This is the first effective 50-item production Worker sample:

- all 13 batches completed;
- result retrieval returned 50 items;
- frontend v2 validation passed;
- every item retained `qualityMeta`;
- no invalid `distractorDesign` key was detected;
- no leakage marker was found.

The result shows that the current backend async architecture can complete a 50-item generation under concurrency `2`, but the wait time remains long at about 4.8 minutes.

## Remaining Risks

- 50-item latency is still long for users, even after concurrency `2`.
- `qualityMeta` remains most of the output payload.
- `distractorDesign` remains output-heavy and frequently exceeds the compact target.
- Repeated misconception tag warnings remain present.
- This is a single Chinese-language 50-item sample; math and natural science still need separate observations before broad all-subject readiness claims.
- Concurrency `3` remains unvalidated and should not be enabled based on this sample alone.

## Recommendation

This sample supports an initial 50-item readiness claim for the tested path:

> Chinese language arts, Grade 4, 50 multiple-choice items, async generation, batch size 4, concurrency 2.

Recommended next decision:

1. Keep Worker concurrency at `2`.
2. Do not raise to concurrency `3`.
3. Run cross-subject observations before claiming broad 50-item stability:
   - Math Grade 4, 25 or 50 items.
   - Natural science Grade 5, 25 or 50 items.
4. If the product will advertise 50 items generally, add UI copy that generation may take several minutes.

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
