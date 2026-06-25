# 10C Worker 50-Item Readiness Baseline

Date: 2026-06-25

Status: initial decision baseline after three effective 50-item production Worker observations with bounded batch concurrency `2`.

Update: this file has been superseded by the 9-sample replication baseline in `docs/10C_WORKER_50_ITEM_REPLICATION_BASELINE_20260625.md`. The replication baseline found 8 / 9 pass samples and one Chinese-language `AI_JSON_PARSE_FAILED` job failure. Use the replication baseline for current readiness decisions.

This file stores only summarized metrics and readiness decisions. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Scope

This baseline covers the tested async backend generation path:

- production Worker `exam-wizard-next-proxy`;
- `/generation-jobs` async flow;
- batch size `4`;
- configured max concurrent batches `2`;
- 50 multiple-choice items;
- three subject samples:
  - Chinese language arts, Grade 4;
  - Math, Grade 4;
  - Natural science, Grade 5.

This baseline does not claim full readiness for every grade, every subject, every question type, or every school workflow.

## Observation Inputs

| Subject | Observation file | Effective sample |
| --- | --- | --- |
| Chinese language arts | `docs/10C_WORKER_50_ITEM_CONCURRENCY2_OBSERVATION_20260625.md` | yes |
| Math | `docs/10C_WORKER_50_ITEM_MATH_CONCURRENCY2_OBSERVATION_20260625.md` | yes |
| Natural science | `docs/10C_WORKER_50_ITEM_NATURAL_CONCURRENCY2_OBSERVATION_20260625.md` | yes |

## Cross-Subject Result Matrix

| Signal | Chinese | Math | Natural science | Readiness judgment |
| --- | ---: | ---: | ---: | --- |
| requested item count | 50 | 50 | 50 | tested |
| batch count | 13 | 13 | 13 | expected |
| completed item count | 50 / 50 | 50 / 50 | 50 / 50 | pass |
| latencySeconds | 288.59 | 321.03 | 384.83 | slow but completed |
| JSON parse | success | success | success | pass |
| frontend v2 validation | pass | pass | pass | pass |
| validation errors | 0 | 0 | 0 | pass |
| validation warnings | 9 | 26 | 15 | acceptable with caveats |
| qualityMeta present | 50 / 50 | 50 / 50 | 50 / 50 | pass |
| invalid distractorDesign key items | 0 | 0 | 0 | pass |
| leakage finding | none | none | none | pass |
| runner outputLengthEstimate | 85611 | 81384 | 87173 | high |
| runner qualityMetaLengthEstimate | 62129 | 61505 | 64733 | high |
| runner qualityMetaRatioEstimate | 0.726 | 0.756 | 0.743 | stable-high |

## Decision

The backend async generation path is initially viable for 50-item generation under the tested conditions, but this statement was based on one sample per subject. Later replication narrowed this conclusion because one Chinese-language 50-item sample failed with `AI_JSON_PARSE_FAILED`.

Accepted:

- batch size `4`;
- max concurrent batches `2`;
- 50 multiple-choice items;
- Chinese, math, and natural science tested samples;
- v2 validation pass across all three samples;
- no observed student-facing leakage;
- no invalid `distractorDesign` option-code keys.

Not accepted as a broad claim:

- all subjects;
- all grades;
- all question types;
- low-latency user experience;
- low-cost output profile;
- readiness for concurrency `3`;
- perfect subject-matter quality for all generated items.

## Product Readiness Boundary

The system can complete 50-item generation, but the product experience must communicate that this is a multi-minute operation.

Current latency range:

| Subject | Latency | User-facing implication |
| --- | ---: | --- |
| Chinese language arts | 288.59s | about 4.8 minutes |
| Math | 321.03s | about 5.4 minutes |
| Natural science | 384.83s | about 6.4 minutes |

Recommended product wording direction:

> 50-item generation may take 5 to 7 minutes. Keep the page open while the system generates and checks items in batches.

This is not a blocker for backend readiness, but it is a user-experience risk if the UI implies a short wait.

## Cost And Output Risk

`qualityMeta` remains the dominant output component in all three samples.

| Subject | qualityMeta ratio estimate |
| --- | ---: |
| Chinese language arts | 0.726 |
| Math | 0.756 |
| Natural science | 0.743 |

Risk judgment:

- output volume is high;
- `qualityMeta` and `distractorDesign` remain cost drivers;
- 50-item generation should be treated as a premium/heavy operation;
- further compression should be considered before raising concurrency or encouraging frequent 50-item generation.

## Quality Warnings

All three 50-item samples passed v2 validation, but warnings remain.

| Subject | Warning count | Main signal |
| --- | ---: | --- |
| Chinese language arts | 9 | repeated misconception tags |
| Math | 26 | repeated misconception tags |
| Natural science | 15 | repeated misconception tags |

Natural science also produced a non-blocking stimulus heuristic signal:

- `Q-004`
- `Q-021`
- `Q-023`
- `Q-024`
- `Q-032`
- `Q-036`

These passed validation and are not treated as failed samples, but they should be reviewed before making a broad subject-quality claim.

## Recommendation

Proceed with 50-item support under a controlled readiness label:

> Backend 50-item async generation is initially ready for the tested path at concurrency `2`, with latency, cost, and quality-warning caveats.

Recommended next steps:

1. Keep `ASYNC_GENERATION_MAX_CONCURRENT_BATCHES = 2`.
2. Do not raise to concurrency `3` yet.
3. Add or refine UI copy for 50-item generation wait time.
4. Keep collecting low-frequency 50-item observations.
5. Review natural science stimulus heuristic signals before broader natural science quality claims.
6. Consider targeted qualityMeta / distractorDesign compression before cost-focused release messaging.

## Do Not Do Yet

- Do not enable concurrency `3`.
- Do not claim every subject and grade is fully validated at 50 items.
- Do not advertise 50-item generation as fast.
- Do not remove the manual deploy gate.
- Do not store raw prompt or raw output in the repository.

## Replication Follow-Up

The later 9-sample replication run changed the decision boundary:

- overall pass rate: 8 / 9;
- Chinese language arts: 2 / 3 pass, 1 `AI_JSON_PARSE_FAILED`;
- Math: 3 / 3 pass;
- Natural science: 3 / 3 pass;
- leakage findings: 0;
- invalid `distractorDesign` key findings: 0.

Current statement:

> Backend async 50-item generation is promising at concurrency `2`, but should remain in controlled rollout until `AI_JSON_PARSE_FAILED` recovery and quality-warning follow-ups are addressed.

## Next Decision Point

Recommended next decision:

1. Accept this 50-item backend readiness baseline with caveats.
2. Create a small UI copy follow-up for multi-minute 50-item generation.
3. Create a separate natural science stimulus-quality follow-up only if owner wants stronger natural science quality claims.

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
