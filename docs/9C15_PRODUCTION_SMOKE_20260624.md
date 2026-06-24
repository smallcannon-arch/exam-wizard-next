# 9C-15 Production Smoke - Async Result Polling MVP

## Summary

This file records the production Worker smoke after PR #18 was merged and Worker version `546f9eb3-9f35-494a-b98b-8b112a1dee7e` was deployed.

The smoke intentionally stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, API keys, tokens, request headers, cookies, or full response bodies.

## Environment

| Field | Value |
| --- | --- |
| date | 2026-06-24 |
| mainCommit | `0786d7aa6bfa25ae20b89f2305579fdd1e4c21e6` |
| worker | `exam-wizard-next-proxy` |
| workerVersion | `546f9eb3-9f35-494a-b98b-8b112a1dee7e` |
| workerDeploymentTime | `2026-06-24T12:34:46.569Z` |
| environment | production Worker direct API |
| Pages deploy | not performed |

## Smoke Request

| Field | Value |
| --- | --- |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | Mandarin |
| grade | Grade 4 |
| requestedItemCount | 13 |
| expected async batches | 4 |
| actual generation attempts | 1 |
| raw prompt saved | no |
| raw output saved | no |

## Result

| Field | Value |
| --- | --- |
| jobId | `gen_eaf183cf-88a0-4059-b491-727f352d94ac` |
| terminalStatus | `completed` |
| completedBatchCount | 4 / 4 |
| completedItemCount | 13 / 13 |
| latencySeconds | 150.62 |
| pollCount | 29 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 13 |
| JSON parse | success |
| v2 validation | pass |
| validationErrorCount | 0 |
| validationWarningCount | 3 |
| qualityMetaPresentCount | 13 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |

## Validation Note

The first local validation attempt failed because the ad-hoc PowerShell-to-Node smoke script passed Chinese slot labels through the Windows console encoding and converted them to placeholder characters. The same completed job result was revalidated without another generation call by defining the local slot labels with Unicode escapes. The second validation passed.

This means the failure was in the smoke harness encoding, not the Worker result endpoint or generated item contract.

## Data Boundary

This file intentionally does not contain:

- raw prompt
- raw output
- full generated item text
- full API response
- API key
- token
- request headers
- cookies

## Interpretation

The production Worker async path can:

1. Create a durable generation job.
2. Execute 4 sequential batches.
3. Report safe progress through status polling.
4. Return completed result items through the safe result endpoint.
5. Preserve `qualityMeta` for all generated items.
6. Pass frontend v2 validation when checked with the correct slot labels.

## Remaining Decision

PR #18 includes frontend code, but Pages was not deployed in this smoke. To make the production UI use async polling for 13-50 item requests, the next major decision is whether to deploy Pages for main commit `0786d7aa6bfa25ae20b89f2305579fdd1e4c21e6`.
