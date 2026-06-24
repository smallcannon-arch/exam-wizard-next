# 10B Worker Item Content Gate Validation

Date: 2026-06-25

Status: failed observation audit trail. This is not an effective 25-item baseline sample because frontend v2 validation still failed, but the Worker item-content gate fix was validated for the previously observed missing-question failure mode.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `e29349b0-1a5b-4890-a53b-0640582db435` |
| deployed Worker version created | `2026-06-24T21:56:54.796Z` |
| main commit deployed to Worker | `075b8fd529574da4a0f5623e99393cc04ae3eec4` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | 國語 |
| grade | 四年級 |
| requested item count | 25 |
| question type | 選擇題 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_d2a69b9e-6ffa-4829-a7e6-cd20f229c84f` |
| terminalStatus | `completed` |
| latencySeconds | 282.38 |
| pollCount | 55 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | fail |
| validationErrorCount | 1 |
| validationWarningCount | 4 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| questionTextPresentCount | 25 |
| questionTextMissingCount | 0 |
| leakageFinding | none |
| outputLengthEstimate | 43807 |
| qualityMetaLengthEstimate | 31617 |
| qualityMetaRatioEstimate | 0.722 |

## Gate Validation

The previous failed 25-item observation found one item with `qualityMeta`, answer/options, but no recoverable question text.

After deploying the Worker item-content gate:

- `questionTextPresentCount`: 25 / 25
- `questionTextMissingCount`: 0 / 25
- no missing question-like field was observed
- no raw leakage key was observed

This confirms the deployed Worker no longer allowed the exact previously observed missing-question shape to pass through this sample.

## Remaining Validation Failure

Frontend v2 validation still failed on a different contract:

- `Q-010`: question text referenced prior text / this passage, but no `stimulus` was provided.

This is a separate reading-reference contract issue. The item had question text and `qualityMeta`; the failure is that a reading-style question referenced an external passage without carrying the passage in `stimulus`.

## Progress Snapshots

The status response did not expose batch counters in this direct script run, so batch progress fields were unavailable. Elapsed status snapshots:

| Elapsed | Status |
| --- | --- |
| 27.99s | running |
| 53.46s | running |
| 78.89s | running |
| 104.35s | running |
| 129.81s | running |
| 155.26s | running |
| 180.68s | running |
| 206.11s | running |
| 231.54s | running |
| 256.97s | running |
| 282.38s | completed |

## Interpretation

This observation validates the narrow Worker item-content gate but does not yet validate 25-item readiness.

Current blockers for a valid 25-item baseline:

1. Reading-reference questions can still mention prior text without a `stimulus`.
2. Latency was 282.38 seconds, which is acceptable for async observation but still a cost / waiting-time signal.
3. `qualityMeta` remains a large share of output at roughly 72.2% of summarized output size.

## Recommended Follow-Up

Open a small independent Worker hardening task:

- Add a minimum reading-reference gate before marking generated payloads as valid.
- If a question references prior text, this passage, or the text above, require non-empty `stimulus`.
- Keep the gate narrow; do not copy full frontend v2 validation into Worker.
- Return a safe `AI_OUTPUT_CONTRACT_INVALID` style error if the contract fails.
- Add tests for reference-without-stimulus and safe error output.

After that hardening is merged and Worker-deployed, rerun one 25-item observation. Do not run a 50-item observation until a 25-item sample passes.

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
