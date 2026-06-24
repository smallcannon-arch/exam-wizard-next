# 10B Worker 25-Item Retry After Split Error Codes

Date: 2026-06-25

Status: failed observation audit trail. This is not an effective 25-item baseline sample because the async job failed before completion.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `76a30baf-17cc-4224-9da5-ab17837f3cc8` |
| deployed Worker version created | `2026-06-24T23:05:31.793Z` |
| main commit deployed to Worker | `44e51b64a3260dda47a2fbf0a21db1d3a45d1561` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` |
| subject | 國語 |
| grade | 四年級 |
| requested item count | 25 |
| question type | 選擇題 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_11dd6489-2740-4d2d-b0de-e4a669e55d43` |
| terminalStatus | `failed` |
| latencySeconds | 180.35 |
| pollCount | 35 |
| requestedItemCount | 25 |
| batchSize | 4 |
| batchCount | 7 |
| completedBatchCount | 3 / 7 |
| completedItemCount | 12 / 25 |
| currentBatch | 4 |
| errorCode | `AI_STIMULUS_MISSING` |
| effective baseline sample | no |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.78s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.22s | running | 0 / 7 | 0 / 25 | 1 |  |
| 78.61s | running | 1 / 7 | 4 / 25 | 2 |  |
| 104.05s | running | 2 / 7 | 8 / 25 | 3 |  |
| 129.45s | running | 2 / 7 | 8 / 25 | 3 |  |
| 154.87s | running | 3 / 7 | 12 / 25 | 4 |  |
| 180.35s | failed | 3 / 7 | 12 / 25 | 4 | `AI_STIMULUS_MISSING` |

## Interpretation

The split error-code diagnostics worked. The failed job now identifies the specific minimum contract failure as `AI_STIMULUS_MISSING`.

This confirms the current remaining blocker for a valid 25-item baseline is not the previously observed missing question text issue. The blocking pattern is:

- a generated item references reading text / prior text;
- the item does not include a non-empty `stimulus`;
- Worker correctly rejects the batch before the job can complete.

## Recommended Follow-Up

Before spending another 25-item observation, open a targeted prompt / output-contract task:

- For ordinary 選擇題 batches, avoid wording that references `本文`, `上文`, or `這段文字` unless a self-contained `stimulus` is included.
- If a question requires reading context, require `stimulus` in the same item.
- Keep the change narrow and test prompt text / contract behavior.
- Do not weaken the Worker gate.

After that fix is merged and Worker-deployed, rerun one 25-item observation. Do not run a 50-item observation until a 25-item sample passes.

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
