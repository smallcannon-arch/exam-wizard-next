# 10B Worker 25-Item Observation After QualityMeta Compression

Date: 2026-06-25

Status: effective 25-item production Worker sample after Chinese `qualityMeta` output compression prompt contract.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `b99a1d1d-efa7-4aa9-a3e7-e75562e12599` |
| Worker deployment time | `2026-06-25T00:16:10.073Z` |
| main commit deployed to Worker | `c7510b9376a6efa2fc7c12274db2a588e8114170` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | Chinese language arts |
| grade | Grade 4 |
| question type | multiple choice |
| requested item count | 25 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_0a414853-3e5c-4aee-ba6b-bd2cb96eb1e9` |
| terminalStatus | `completed` |
| latencySeconds | 222.17 |
| pollCount | 43 |
| requestedItemCount | 25 |
| batchSize | 4 |
| batchCount | 7 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 3 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 40476 |
| runner qualityMetaLengthEstimate | 29089 |
| runner qualityMetaRatioEstimate | 0.719 |
| effective baseline sample | yes |

## Quality Scan Summary

| Signal | Before compression | After compression | Judgment |
| --- | ---: | ---: | --- |
| Visible English token findings | 0 | 0 | stable |
| v2 validation errors | 0 | 0 | stable |
| v2 validation warnings | 8 | 3 | improved |
| repeated distractor tag warning items | 8 | 2 | improved |
| stimulus references missing same-item stimulus | 0 | 0 | stable |
| qualityMeta present | 25 / 25 | 25 / 25 | stable |
| leakage finding | none | none | stable |
| runner outputLengthEstimate | 42813 | 40476 | improved by about 5.5% |
| runner qualityMetaLengthEstimate | 31536 | 29089 | improved by about 7.8% |
| runner qualityMetaRatioEstimate | 0.737 | 0.719 | improved slightly |

## Secondary Raw-Result Scan

The observation runner normalizes items before estimating output length. A second scan against the stored job result payload, without saving raw output, produced these approximate values:

| Field | Value |
| --- | --- |
| raw-result outputLengthEstimate | 36332 |
| raw-result qualityMetaLengthEstimate | 24945 |
| raw-result qualityMetaRatioEstimate | 0.687 |
| correctReasonLength total | 662 |
| teacherExplanationLength total | 816 |
| distractorDesignLength total | 14439 |
| selfCheckLength total | 5325 |
| visible English token findings | 0 |
| stimulus reference count | 7 |
| missing stimulus | 0 |
| repeated tag items | 2 |
| long distractorDesign entries over 180 chars | 35 |
| leakage finding | none |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 28.09s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.64s | running | 1 / 7 | 4 / 25 | 2 |  |
| 79.18s | running | 2 / 7 | 8 / 25 | 3 |  |
| 104.76s | running | 2 / 7 | 8 / 25 | 3 |  |
| 130.38s | running | 3 / 7 | 12 / 25 | 4 |  |
| 155.85s | running | 4 / 7 | 16 / 25 | 5 |  |
| 181.41s | running | 5 / 7 | 20 / 25 | 6 |  |
| 206.90s | running | 6 / 7 | 24 / 25 | 7 |  |
| 222.17s | completed | 7 / 7 | 25 / 25 |  |  |

## Interpretation

The compression prompt contract improved the observed output profile without breaking the generation contract:

- the 25-item job completed successfully;
- frontend v2 validation passed;
- every generated item retained `qualityMeta`;
- visible English token findings remained at 0;
- all detected text-reference questions had same-item `stimulus`;
- validation warnings fell from 8 to 3;
- repeated distractor tag warning items fell from 8 to 2;
- runner-estimated `qualityMeta` length fell by about 7.8%.

The compression is useful but not enough to remove output-size concern. The raw-result scan still found 35 `distractorDesign` entries over 180 JSON characters, and `qualityMeta` still accounts for most of the payload.

## Risk Notes

- 25-item latency improved from 251.92s to 222.17s, but this is still a long wait.
- `qualityMeta` remains output-heavy, with runner-estimated ratio `0.719`.
- The current result supports continued staged observation, not a broad 50-item declaration.
- The next 50-item test should be treated as a separate cost-bearing decision.

## Recommendation

The project can proceed to the next decision point:

1. Run one controlled 50-item async observation if the owner accepts the cost and wait-time risk.
2. Or add one more narrow compression pass focused specifically on `distractorDesign` field length before spending the 50-item observation.

Given the current 25-item result, the engineering recommendation is to stop here for a decision before 50 items. If the owner prioritizes empirical confidence, run one 50-item controlled observation. If the owner prioritizes cost containment, do one more `distractorDesign`-specific compression pass first.

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
