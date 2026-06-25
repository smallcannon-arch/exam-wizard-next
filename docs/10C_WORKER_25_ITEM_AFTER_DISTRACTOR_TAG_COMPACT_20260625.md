# 10C Worker 25-Item Observation After Distractor Tag Compact Prompt

Date: 2026-06-25

Status: failed 25-item production Worker observation after the Chinese distractorDesign tag compact prompt update.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Environment

| Field | Value |
| --- | --- |
| environment | production Worker direct API |
| Worker | `exam-wizard-next-proxy` |
| deployed Worker version | `58a57c91-2c87-4c4b-9972-64ab1f81007b` |
| Worker deployment time | `2026-06-25T01:58:28.790Z` |
| main commit deployed to Worker | `5c9b0e599bff4c43637be37830e30c7fa3b96c9d` |
| endpoint path | `/generation-jobs` + `/generation-jobs/:jobId` + `/generation-jobs/:jobId/result` |
| subject | Chinese language arts |
| grade | Grade 4 |
| question type | multiple choice |
| requested item count | 25 |
| batch size | 4 |
| batch count | 7 |
| configured max concurrent batches | not set |
| effective max concurrent batches | 1 |
| generation attempts | 1 |

## Result Summary

| Field | Value |
| --- | --- |
| jobId | `gen_f436ad44-c5f0-4c3b-ad32-0c236e67d66c` |
| terminalStatus | `completed` |
| latencySeconds | 237.18 |
| pollCount | 46 |
| requestedItemCount | 25 |
| completedBatchCount | 7 / 7 |
| completedItemCount | 25 / 25 |
| resultHttpStatus | 200 |
| resultOk | true |
| generatedItemCount | 25 |
| JSON parse | success |
| frontend v2 validation | fail |
| validationErrorCount | 2 |
| validationWarningCount | 2 |
| qualityMetaPresentCount | 25 |
| qualityMetaMissingCount | 0 |
| leakageFinding | none |
| runner outputLengthEstimate | 39059 |
| runner qualityMetaLengthEstimate | 27731 |
| runner qualityMetaRatioEstimate | 0.710 |
| effective regression sample | no |

## Validation Failure Summary

Frontend v2 validation failed because one item used a composite `distractorDesign` key instead of a pure option code:

| Signal | Value |
| --- | --- |
| affected item | `Q-005` |
| invalid key shape | composite text + option code |
| error type | `distractorDesign` key contract |
| missing wrong option design | option `C` |

The exact generated item text and raw output are intentionally not stored.

## Secondary Safe Scan

| Field | Value |
| --- | --- |
| invalid distractorDesign key items | `Q-005` |
| repeated tag warning items | `Q-019`, `Q-022` |
| strict repeated tag items | 1 |
| long distractorDesign entries over 140 chars | 75 |
| long distractorDesign entries over 180 chars | 8 |
| visible English token findings | 0 |
| leakage finding | none |

## Comparison With Previous Regression

| Signal | Before tag compact | After tag compact | Judgment |
| --- | ---: | ---: | --- |
| latencySeconds | 223.32 | 237.18 | slower |
| validation errors | 0 | 2 | worse |
| validation warnings | 14 | 2 | improved |
| repeated tag warning items | 14 | 2 | improved |
| long distractorDesign entries over 180 chars | 56 | 8 | improved |
| qualityMeta present | 25 / 25 | 25 / 25 | stable |
| runner outputLengthEstimate | 40916 | 39059 | improved |
| runner qualityMetaLengthEstimate | 29662 | 27731 | improved |
| runner qualityMetaRatioEstimate | 0.725 | 0.710 | improved |
| leakage finding | none | none | stable |

## Interpretation

The tag compact prompt improved the warning profile and reduced very long distractorDesign entries, but the observation is not a valid regression pass because one generated item violated the `distractorDesign` key contract.

This points to a narrower prompt contract issue: the model can still combine a misconception label or wording with an option code in the outer `distractorDesign` key.

## Recommendation

Before running 50 items or enabling production concurrency above `1`, add a narrow prompt fix:

1. State that `distractorDesign` outer keys must be pure single option codes only, such as `"B"`.
2. Explicitly forbid composite keys such as `"tag B"`, `"B tag"`, or text plus option code.
3. State that `misconceptionTag` belongs only inside the wrong-option object, not in the outer key.
4. Rerun one controlled 25-item observation after Worker deploy.

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
