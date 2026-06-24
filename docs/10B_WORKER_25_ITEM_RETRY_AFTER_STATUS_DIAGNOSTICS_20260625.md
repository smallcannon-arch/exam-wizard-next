# 10B Worker 25-Item Retry After Status Diagnostics

Date: 2026-06-25

Status: failed observation audit trail. This is not an effective 25-item baseline sample because the async job failed before completion.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `b828e9b7-bd47-427a-92c9-fbd9cbcfbe09` |
| deployed Worker version created | `2026-06-24T22:12:31.840Z` |
| main commit deployed to Worker | `2505113629a02dcb0f3cd2ab8a88b74c73d0fbfc` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` |
| subject | 國語 |
| grade | 四年級 |
| requested item count | 25 |
| question type | 選擇題 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_24551dcf-c61f-4079-bdcf-25da2f94d11a` |
| terminalStatus | `failed` |
| latencySeconds | 200.85 |
| pollCount | 39 |
| requestedItemCount | 25 |
| batchSize | 4 |
| batchCount | 7 |
| completedBatchCount | 4 / 7 |
| completedItemCount | 16 / 25 |
| currentBatch | 5 |
| errorCode | `AI_OUTPUT_CONTRACT_INVALID` |
| effective baseline sample | no |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.88s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.33s | running | 1 / 7 | 4 / 25 | 2 |  |
| 78.77s | running | 1 / 7 | 4 / 25 | 2 |  |
| 104.21s | running | 2 / 7 | 8 / 25 | 3 |  |
| 129.65s | running | 3 / 7 | 12 / 25 | 4 |  |
| 155.06s | running | 3 / 7 | 12 / 25 | 4 |  |
| 180.50s | running | 4 / 7 | 16 / 25 | 5 |  |
| 200.85s | failed | 4 / 7 | 16 / 25 | 5 | `AI_OUTPUT_CONTRACT_INVALID` |

## Interpretation

The status diagnostics fix worked: the failed async job now exposes a safe `errorCode` in the status response.

The 25-item retry still did not produce an effective baseline. It failed on batch 5 after 16 completed items with `AI_OUTPUT_CONTRACT_INVALID`.

Because the current code groups multiple Worker output gates under `AI_OUTPUT_CONTRACT_INVALID`, this observation cannot distinguish whether the failure was:

1. missing recoverable question text,
2. reading-reference question missing `stimulus`,
3. invalid item object shape,
4. another minimum output contract issue.

## Recommended Follow-Up

Open a small independent Worker diagnostics task before spending another 25-item observation:

- split minimum output contract failures into safer, more specific error codes;
- for example `AI_ITEM_TEXT_MISSING` and `AI_STIMULUS_MISSING`;
- keep response bodies summary-only and do not include raw prompt, raw output, item text, or provider errors;
- add tests for the new error codes;
- deploy Worker after merge;
- then rerun one 25-item observation.

Do not run a 50-item observation until a 25-item sample passes.

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
