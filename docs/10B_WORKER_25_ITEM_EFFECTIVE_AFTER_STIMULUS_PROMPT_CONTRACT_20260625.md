# 10B Worker 25-Item Effective Observation After Stimulus Prompt Contract

Date: 2026-06-25

Status: effective 25-item baseline sample.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `63752451-e812-460f-b22a-5107c9ddfe47` |
| deployed Worker version created | `2026-06-24T23:20:04.680Z` |
| main commit deployed to Worker | `def288120c35ca962ca6d4bf39b46336915b76dc` |
| observation runner commit | `f114a72a84f318a1e5ff8109c5f010db21928f1c` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | 國語 |
| grade | 四年級 |
| question type | 選擇題 |
| requested item count | 25 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_a3e03199-75bd-4ca9-a2e5-34e6737378d5` |
| terminalStatus | `completed` |
| latencySeconds | 221.16 |
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
| validationWarningCount | 12 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| outputLengthEstimate | 41942 |
| qualityMetaLengthEstimate | 30949 |
| qualityMetaRatioEstimate | 0.738 |
| effective baseline sample | yes |

## Progress Snapshots

| Elapsed | Status | Completed batches | Completed items | Current batch | errorCode |
| --- | --- | --- | --- | --- | --- |
| 27.82s | running | 0 / 7 | 0 / 25 | 1 |  |
| 53.27s | running | 1 / 7 | 4 / 25 | 2 |  |
| 78.70s | running | 2 / 7 | 8 / 25 | 3 |  |
| 104.11s | running | 2 / 7 | 8 / 25 | 3 |  |
| 129.54s | running | 3 / 7 | 12 / 25 | 4 |  |
| 154.98s | running | 4 / 7 | 16 / 25 | 5 |  |
| 180.42s | running | 5 / 7 | 20 / 25 | 6 |  |
| 205.88s | running | 5 / 7 | 20 / 25 | 6 |  |
| 221.16s | completed | 7 / 7 | 25 / 25 |  |  |

## Interpretation

This observation is the first effective 25-item baseline after the following hardening sequence:

1. Worker rejected missing item text instead of returning incomplete payloads.
2. Worker rejected item text that referenced missing `stimulus`.
3. Worker exposed safe terminal job error codes.
4. Prompt contract was tightened so items that refer to `本文`, `上文`, or `這段文字` must provide same-item `stimulus`.
5. Worker was redeployed with the prompt contract.
6. The observation runner was changed to avoid PowerShell stdin corruption of Chinese slot text.

The result passed the main contract gates for a 25-item async generation:

- job completed;
- generated item count matched the requested item count;
- JSON parse succeeded;
- frontend v2 validation passed;
- `qualityMeta` was present on every item;
- no leakage marker was found in the summarized scan.

## Risk Notes

- Latency remains high at 221.16 seconds for 25 items.
- The output remains `qualityMeta` heavy: estimated `qualityMeta` ratio is 0.738.
- The sample produced 12 validation warnings even though there were no blocking validation errors.
- This supports 25-item feasibility, but does not prove 50-item stability or acceptable user wait time.

## Recommended Follow-Up

Do not jump directly to production 50-item rollout based on a single sample. The next decision point should compare:

1. one controlled 50-item async observation;
2. qualityMeta / output compression before 50-item testing;
3. stronger UX wording for long-running 25+ item jobs;
4. status observability improvements for warning summaries.

If the owner approves the cost and wait time, the next empirical step can be one 50-item async observation using the same safe runner discipline.

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
