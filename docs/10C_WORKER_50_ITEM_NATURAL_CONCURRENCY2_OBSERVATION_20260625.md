# 10C Worker 50-Item Natural Science Observation With Concurrency 2

Date: 2026-06-25

Status: effective 50-item production Worker sample for natural science with bounded batch concurrency `2`.

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
| subject | Natural science |
| grade | Grade 5 |
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
| jobId | `gen_518500db-a8a1-4ddf-adf7-000a058274bb` |
| terminalStatus | `completed` |
| latencySeconds | 384.83 |
| requestedItemCount | 50 |
| completedBatchCount | 13 / 13 |
| completedItemCount | 50 / 50 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 50 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 15 |
| qualityMetaPresentCount | 50 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 87173 |
| runner qualityMetaLengthEstimate | 64733 |
| runner qualityMetaRatioEstimate | 0.743 |
| effective 50-item sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.90s | running | 0 / 13 | 0 / 50 | 1 |  |
| 53.41s | running | 0 / 13 | 0 / 50 | 1 |  |
| 78.91s | running | 2 / 13 | 8 / 50 | 3 |  |
| 104.43s | running | 4 / 13 | 16 / 50 | 5 |  |
| 129.94s | running | 4 / 13 | 16 / 50 | 5 |  |
| 155.45s | running | 4 / 13 | 16 / 50 | 5 |  |
| 180.92s | running | 6 / 13 | 24 / 50 | 7 |  |
| 206.40s | running | 8 / 13 | 32 / 50 | 9 |  |
| 231.94s | running | 8 / 13 | 32 / 50 | 9 |  |
| 257.49s | running | 10 / 13 | 40 / 50 | 11 |  |
| 282.95s | running | 10 / 13 | 40 / 50 | 11 |  |
| 308.42s | running | 12 / 13 | 48 / 50 | 13 |  |
| 333.88s | running | 12 / 13 | 48 / 50 | 13 |  |
| 359.33s | running | 12 / 13 | 48 / 50 | 13 |  |
| 384.83s | completed | 13 / 13 | 50 / 50 |  |  |

## Secondary Safe Scan

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 78426 |
| raw-result qualityMetaLengthEstimate | 55986 |
| correctReasonLength total | 1777 |
| teacherExplanationLength total | 2186 |
| distractorDesignLength total | 33565 |
| selfCheckLength total | 10650 |
| invalid distractorDesign key items | 0 |
| validation repeated tag warning items | 15 |
| strict repeated tag items | 2 |
| long distractorDesign entries over 140 chars | 150 |
| long distractorDesign entries over 180 chars | 150 |
| long distractorDesign entries over 220 chars | 55 |
| visible English token findings | 0 |
| leakage finding | none |

## Validation Warning Summary

Frontend v2 validation passed, but produced 15 repeated-tag warnings.

| Warning type | Count |
| --- | ---: |
| repeated distractor misconception tags | 15 |

The stricter same-tag scan found 2 items with all wrong options sharing the same tag:

| Item | Tag |
| --- | --- |
| `Q-007` | `organ_function_reversal` |
| `Q-029` | `single_feature_error` |

This is a quality warning, not a blocking validation failure.

## Stimulus Heuristic Note

The validator passed. A secondary heuristic scan found 6 items with possible stimulus-reference wording and an empty `stimulus` field.

| Field | Value |
| --- | --- |
| heuristic item ids | `Q-004`, `Q-021`, `Q-023`, `Q-024`, `Q-032`, `Q-036` |
| blocking validation issue | no |

This is recorded as a non-blocking heuristic signal. It should be reviewed before making a broad claim that all natural science items are fully context-structured.

## Comparison Across 50-Item Samples

| Signal | Chinese | Math | Natural science | Judgment |
| --- | ---: | ---: | ---: | --- |
| requested item count | 50 | 50 | 50 | same |
| batch count | 13 | 13 | 13 | same |
| latencySeconds | 288.59 | 321.03 | 384.83 | natural science slowest |
| validation errors | 0 | 0 | 0 | stable |
| validation warnings | 9 | 26 | 15 | subject variation |
| invalid distractorDesign key items | 0 | 0 | 0 | stable |
| qualityMeta present | 50 / 50 | 50 / 50 | 50 / 50 | stable |
| runner outputLengthEstimate | 85611 | 81384 | 87173 | natural science highest |
| runner qualityMetaLengthEstimate | 62129 | 61505 | 64733 | natural science highest |
| runner qualityMetaRatioEstimate | 0.726 | 0.756 | 0.743 | stable-high |
| leakage finding | none | none | none | stable |

## Interpretation

This is an effective natural science 50-item production Worker sample:

- all 13 batches completed;
- result retrieval returned 50 items;
- frontend v2 validation passed;
- every item retained `qualityMeta`;
- no invalid `distractorDesign` key was detected;
- no leakage marker was found.

Natural science is the slowest of the three 50-item samples so far. It also has the highest raw output and qualityMeta length estimates among the three tested subjects.

## Remaining Risks

- 50-item latency is about 6.4 minutes for this natural science sample.
- `qualityMeta` remains most of the output payload.
- `distractorDesign` remains output-heavy and exceeded the compact target in all scanned entries.
- Repeated misconception tag warnings remain present.
- The stimulus-reference heuristic found 6 items that may deserve subject-matter review.
- Concurrency `3` remains unvalidated and should not be enabled based on these samples alone.

## Recommendation

The system now has three effective 50-item samples at concurrency `2`:

1. Chinese language arts, Grade 4.
2. Math, Grade 4.
3. Natural science, Grade 5.

Recommended next decision:

1. Keep Worker concurrency at `2`.
2. Treat backend 50-item generation as initially viable for the tested async path, with latency and output-cost caveats.
3. Do not raise concurrency to `3` yet.
4. Add or keep user-facing copy that 50-item generation may take several minutes.
5. Consider a follow-up quality audit for natural science stimulus handling before making broad subject-quality claims.

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
