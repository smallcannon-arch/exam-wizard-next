# 10B Worker 25-Item Effective Observation After Chinese Polish Contract

Date: 2026-06-25

Status: effective 25-item baseline sample after Chinese visible-text polish prompt contract.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `327d8ebd-bac4-44ff-802c-1c6cda1bd395` |
| main commit deployed to Worker | `a0fb45efb5869d22eba567d49b35023e626ecdc9` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | 國語 |
| grade | 四年級 |
| question type | 選擇題 |
| requested item count | 25 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_2b822fa2-0377-4d6c-8dfa-34aee12075db` |
| terminalStatus | `completed` |
| latencySeconds | 251.92 |
| pollCount | 49 |
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
| validationWarningCount | 8 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| outputLengthEstimate | 42813 |
| qualityMetaLengthEstimate | 31536 |
| qualityMetaRatioEstimate | 0.737 |
| effective baseline sample | yes |

## Quality Scan Summary

| Signal | Previous effective 25-item sample | This sample | Judgment |
| --- | ---: | ---: | --- |
| Visible English token findings | 1 | 0 | improved |
| v2 validation errors | 0 | 0 | stable |
| v2 validation warnings | 12 | 8 | improved, not fully solved |
| repeated distractor tag warning items | 12 | 8 | improved, not fully solved |
| stimulus references missing same-item stimulus | 0 | 0 | stable |
| qualityMeta present | 25 / 25 | 25 / 25 | stable |
| leakage finding | none | none | stable |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.86s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.30s | running | 1 / 7 | 4 / 25 | 2 |  |
| 78.75s | running | 2 / 7 | 8 / 25 | 3 |  |
| 104.23s | running | 2 / 7 | 8 / 25 | 3 |  |
| 129.68s | running | 3 / 7 | 12 / 25 | 4 |  |
| 155.15s | running | 4 / 7 | 16 / 25 | 5 |  |
| 180.63s | running | 4 / 7 | 16 / 25 | 5 |  |
| 206.09s | running | 5 / 7 | 20 / 25 | 6 |  |
| 231.59s | running | 5 / 7 | 20 / 25 | 6 |  |
| 251.92s | completed | 7 / 7 | 25 / 25 |  |  |

## Interpretation

The Chinese visible-text polish prompt contract improved the most visible issue from the manual audit:

- no stray English token was detected in `question`, `options`, or `explanation`;
- the 25-item job completed successfully;
- frontend v2 validation passed;
- every generated item retained `qualityMeta`;
- all detected text-reference questions had same-item `stimulus`;
- no leakage marker was detected in the summary scan.

The remaining quality issue is narrower:

- 8 items still repeated distractor misconception tags within the same item.
- This is not an import blocker, but it reduces the diagnostic value of `qualityMeta`.

## Risk Notes

- Latency increased from 221.16s to 251.92s for 25 items.
- `qualityMeta` remains output-heavy, with an estimated ratio of 0.737.
- The warning count improved but remains nonzero.
- This sample supports 25-item stability, but still does not prove 50-item user experience or cost acceptability.

## Recommendation

Do not move directly to broad 50-item rollout. There are now two viable next paths:

1. Controlled 50-item async observation:
   - appropriate if the owner accepts one larger cost-bearing test;
   - goal is to test stability and wait time, not to claim final release readiness.

2. Output / qualityMeta compression design before 50:
   - appropriate if latency and output size are the bigger concern;
   - would aim to reduce `qualityMeta` payload while preserving teacher-review value.

Given the current 25-item latency of 251.92s and `qualityMeta` ratio of 0.737, the safer engineering recommendation is to design output compression before spending a 50-item observation.

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
