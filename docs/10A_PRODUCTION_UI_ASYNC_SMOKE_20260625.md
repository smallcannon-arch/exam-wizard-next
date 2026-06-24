# 10A Production UI Async Smoke

Date: 2026-06-25

Status: passed. This file records one production browser UI async generation smoke. It stores only summarized metrics and does not store raw prompt, raw output, full generated item text, API keys, tokens, request headers, cookies, or full response bodies.

## Environment

| Field | Value |
| --- | --- |
| Production URL | `https://smallcannon-arch.github.io/exam-wizard-next/` |
| Page title | `命題系統` |
| Pages deployed commit | `d194193c7a9caae2a02847408a5c0f298f85f7da` |
| Worker | `exam-wizard-next-proxy` |
| Worker version | `546f9eb3-9f35-494a-b98b-8b112a1dee7e` |
| Test path | production browser UI |
| API calls | 1 generation request through UI |

## Request

| Field | Value |
| --- | --- |
| subject | 國語 |
| grade | 四年級 |
| requested item count | 13 |
| question type | 選擇題 |
| score | 2 points per item |
| total score | 26 |
| expected frontend route | async generation job |
| expected batch count | 4 |

## Result

| Field | Value |
| --- | --- |
| status | completed |
| latencySeconds | 162.52 |
| final UI step | `4. 修題` |
| generated item count | 13 / 13 |
| unique item id count in UI | 13 |
| frontend v2 validation | pass, inferred from successful import to step 4 |
| loading panel displayed | yes |
| generate button disabled while running | yes |
| generate button restored after completion | yes |
| console fatal error | none |
| visible generation failure | none |
| leakage finding | none observed |

## Progress UI Checkpoints

| Elapsed | UI signal |
| --- | --- |
| 1s | Loading panel visible; button disabled; batch status showed `第 1 / 4 批，已完成 0 / 13 題`. |
| 36s | 30-second waiting notice appeared. |
| 51s | Batch status advanced to `第 2 / 4 批，已完成 4 / 13 題`. |
| 66s | 60-second waiting notice appeared. |
| 97s | 90-second waiting notice appeared. |
| 112s | Batch status advanced to `第 3 / 4 批，已完成 8 / 13 題`. |
| 142s | Batch status advanced to `第 4 / 4 批，已完成 12 / 13 題`. |
| 162.52s | Result imported; UI moved to `4. 修題`; progress panel cleared. |

## Warnings

The UI imported the generated items and showed non-blocking quality warnings for repeated distractor misconception labels on several items. These warnings did not block import or validation.

## Data Boundary

This smoke intentionally does not include:

- raw prompt
- raw output
- full generated item text
- full API response
- API key
- token
- request headers
- cookies
- repo-external raw output files

## Interpretation

The deployed production browser UI can submit a 13-item request through the async generation path, display real batch progress, wait beyond 90 seconds without client timeout, import the completed result, and return the interface to an editable state.

This validates the frontend async integration at the first production threshold. It does not yet prove 25-item or 50-item stability.

## Next Recommendation

The next meaningful stability step is a 25-item production Worker observation or UI observation. That should be treated as a separate cost-bearing decision because it will spend a larger generation call.
