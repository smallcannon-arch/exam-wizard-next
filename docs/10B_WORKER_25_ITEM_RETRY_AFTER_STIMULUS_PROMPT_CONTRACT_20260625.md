# 10B Worker 25-Item Retry After Stimulus Prompt Contract

Date: 2026-06-25

Status: invalid observation audit trail. This is not an effective 25-item baseline sample because the temporary observation script corrupted the local validation slot `questionType` through PowerShell stdin encoding.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `63752451-e812-460f-b22a-5107c9ddfe47` |
| deployed Worker version created | `2026-06-24T23:20:04.680Z` |
| main commit deployed to Worker | `def288120c35ca962ca6d4bf39b46336915b76dc` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| intended subject | 國語 |
| intended grade | 四年級 |
| intended question type | 選擇題 |
| requested item count | 25 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_0222b62a-700b-4249-9a9a-f79401cdf5f5` |
| terminalStatus | `completed` |
| latencySeconds | 261.69 |
| pollCount | 51 |
| requestedItemCount | 25 |
| batchSize | 4 |
| batchCount | 7 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | invalid local validation |
| validationErrorCount | 25 |
| validationWarningCount | 12 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| outputLengthEstimate | 41095 |
| qualityMetaLengthEstimate | 31561 |
| qualityMetaRatioEstimate | 0.768 |
| effective baseline sample | no |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.68s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.14s | running | 1 / 7 | 4 / 25 | 2 |  |
| 78.58s | running | 1 / 7 | 4 / 25 | 2 |  |
| 103.99s | running | 2 / 7 | 8 / 25 | 3 |  |
| 129.40s | running | 3 / 7 | 12 / 25 | 4 |  |
| 154.83s | running | 4 / 7 | 16 / 25 | 5 |  |
| 180.28s | running | 4 / 7 | 16 / 25 | 5 |  |
| 205.72s | running | 5 / 7 | 20 / 25 | 6 |  |
| 231.17s | running | 5 / 7 | 20 / 25 | 6 |  |
| 256.61s | running | 6 / 7 | 24 / 25 | 7 |  |
| 261.69s | completed | 7 / 7 | 25 / 25 |  |  |

## Validation Issue

The job completed and no longer failed with `AI_STIMULUS_MISSING`. However, the temporary observation script was passed to Node through PowerShell stdin with literal Chinese text. The local validation slots were corrupted before validation:

| Field | Value |
| --- | --- |
| intended slot questionType | `選擇題` |
| local validation slot questionType | `???` |
| generated item questionType summary | `選擇題`, `圖表判讀題`, `實驗探究題` |

Because the local slot contract was corrupted, the 25 validation errors are not a trustworthy product validation signal. This sample should only be used as an audit trail that the async job completed, preserved `qualityMeta`, and did not expose obvious leakage markers.

## Interpretation

Useful signals:

- The prompt contract fix and Worker deploy allowed the async job to complete all 7 batches.
- The job returned 25 / 25 items.
- `qualityMeta` was present on 25 / 25 items.
- No leakage marker was found in the summarized scan.
- No `AI_STIMULUS_MISSING` failure occurred.

Invalidating factor:

- The observation runner corrupted Chinese slot text, so frontend v2 validation against the intended blueprint cannot be trusted.

## Follow-Up

Before spending another 25-item observation:

1. Use a repo-local observation runner that encodes Chinese payload constants with Unicode escapes.
2. Require an explicit `--confirm-api-call` flag before any production API call.
3. Keep the runner summary-only and never print or save raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, or cookies.
4. Rerun one 25-item observation only after the runner passes `node --check`.

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
