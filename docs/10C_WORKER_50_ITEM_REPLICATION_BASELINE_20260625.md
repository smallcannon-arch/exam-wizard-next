# 10C Worker 50-Item Replication Baseline

Date: 2026-06-25

Status: 9-sample replication observation for 50-item async generation under bounded batch concurrency `2`.

This file stores only summarized metrics. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Purpose

The previous 50-item readiness baseline had one effective sample per subject. That proved the system could complete 50-item generation at least once, but it did not provide a meaningful view of pass rate, latency distribution, or intermittent failure modes.

This replication run adds 3 samples per subject:

- Chinese language arts, Grade 4, 50 multiple-choice items.
- Math, Grade 4, 50 multiple-choice items.
- Natural science, Grade 5, 50 multiple-choice items.

All samples used:

- production Worker direct API;
- `/generation-jobs` async path;
- batch size `4`;
- configured max concurrent batches `2`;
- one attempt per sample;
- no raw prompt/raw output persistence.

## Overall Result

| Metric | Result |
| --- | ---: |
| total samples | 9 |
| effective pass samples | 8 |
| failed samples | 1 |
| observed pass rate | 88.9% |
| leakage findings | 0 |
| invalid `distractorDesign` key findings | 0 |
| qualityMeta missing findings in completed samples | 0 |

The failed sample was:

| Sample | Failure |
| --- | --- |
| Chinese language arts run 3 | `AI_JSON_PARSE_FAILED` after 9 / 13 batches and 36 / 50 completed items |

## Subject Result Matrix

| Subject | Samples | Pass | Fail | Observed pass rate | Successful latency range | Observed successful max |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Chinese language arts | 3 | 2 | 1 | 66.7% | 266.58s-272.64s | 272.64s |
| Math | 3 | 3 | 0 | 100% | 267.73s-292.39s | 292.39s |
| Natural science | 3 | 3 | 0 | 100% | 276.64s-307.44s | 307.44s |

Across successful samples:

| Metric | Value |
| --- | ---: |
| successful sample count | 8 |
| latency min | 266.58s |
| latency approximate median | 279.23s |
| latency observed max | 307.44s |

This run did not reproduce the earlier 384.83s natural science latency. The observed latency remains multi-minute and should not be presented as fast.

## Per-Sample Summary

| Sample | Job ID | Status | Latency | Items | v2 validation | Warnings | qualityMeta | Leakage | Notes |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | --- |
| Chinese 1 | `gen_f067720a-3421-44ae-9c42-5643194e2ef1` | pass | 272.64s | 50 / 50 | pass | 9 | 50 / 50 | none | strict repeated tag items: 2 |
| Chinese 2 | `gen_78fe400f-b0eb-45fb-b681-8397141ec201` | pass | 266.58s | 50 / 50 | pass | 13 | 50 / 50 | none | strict repeated tag items: 7 |
| Chinese 3 | `gen_1a987970-cdfa-4fe0-855f-17c95eef82e5` | fail | 200.35s | 36 / 50 before failure | n/a | n/a | n/a | none | `AI_JSON_PARSE_FAILED` |
| Math 1 | `gen_bb82a8b4-fe48-474f-b7fa-55aa278300c0` | pass | 292.39s | 50 / 50 | pass | 7 | 50 / 50 | none | strict repeated tag items: 0 |
| Math 2 | `gen_e24404b8-b0d8-4643-807d-e0b8a999016a` | pass | 267.73s | 50 / 50 | pass | 16 | 50 / 50 | none | strict repeated tag items: 2 |
| Math 3 | `gen_a48bc1bc-6aea-4470-9336-8260d14fada7` | pass | 281.81s | 50 / 50 | pass | 22 | 50 / 50 | none | strict repeated tag items: 3 |
| Natural 1 | `gen_aa76f2da-359e-41b8-b4a1-f4eb1ef8480e` | pass | 307.44s | 50 / 50 | pass | 14 | 50 / 50 | none | strict repeated tag items: 4 |
| Natural 2 | `gen_828ee598-a2e8-416d-9b02-fb37ebc8edcf` | pass | 276.64s | 50 / 50 | pass | 8 | 50 / 50 | none | high stimulus heuristic count |
| Natural 3 | `gen_37b704b1-c298-497f-a7b9-aa07407fb7fa` | pass | 302.19s | 50 / 50 | pass | 11 | 50 / 50 | none | stimulus heuristic count: 5 |

## Output And Cost Signals

| Subject | qualityMeta ratio range | Judgment |
| --- | --- | --- |
| Chinese language arts | 0.721-0.721 | high and stable |
| Math | 0.758-0.766 | high and stable |
| Natural science | 0.742-0.748 | high and stable |

Interpretation:

- `qualityMeta` remains the dominant payload component.
- This is both a cost and payload-size concern until token usage is measured directly.
- The current evidence does not separate billed generation cost from serialized response size.

## Quality Warning Signals

| Subject | Warning counts | Strict repeated tag items |
| --- | --- | --- |
| Chinese language arts | 9, 13, n/a | 2, 7, n/a |
| Math | 7, 16, 22 | 0, 2, 3 |
| Natural science | 14, 8, 11 | 4, 0, 1 |

Interpretation:

- repeated misconception warnings are not merely theoretical;
- Chinese run 2 had 7 strict repeated-tag items;
- math warning counts rose across the three samples;
- natural science warning counts were moderate but persistent.

This should be treated as a quality follow-up, not as a schema failure.

## Stimulus Heuristic Signals

| Subject | Heuristic counts |
| --- | --- |
| Chinese language arts | 0, 1, n/a |
| Math | 1, 2, 1 |
| Natural science | 1, 14, 5 |

Natural science run 2 produced a high stimulus-reference heuristic count. The validator passed and this is not a leakage issue, but it suggests natural science context/stimulus handling needs a separate review before broad subject-quality claims.

## Readiness Adjustment

The earlier "initially viable" conclusion should be narrowed:

Accepted:

- 50-item async generation can complete successfully under concurrency `2`.
- Math and natural science each passed 3 / 3 in this replication run.
- Completed samples retained `qualityMeta` and passed v2 validation.
- No leakage was observed.

Not yet accepted:

- 50-item generation as reliably stable across subjects.
- Chinese 50-item generation without intermittent parse failure.
- A product promise that 50-item generation will always finish successfully.
- A latency promise based on one sample per subject.

## Recommended Next Steps

1. Keep concurrency at `2`.
2. Do not enable concurrency `3`.
3. Add UI wording that 50-item generation is a multi-minute operation and may occasionally require retry.
4. Add or verify batch-level retry/recovery behavior for `AI_JSON_PARSE_FAILED`.
5. Run a focused audit of repeated misconception tags to decide whether it is cosmetic tagging or real distractor-quality repetition.
6. Run a focused natural science stimulus heuristic audit before broad natural science quality claims.
7. Measure whether `qualityMeta` is primarily a billing-token cost problem, a payload-size problem, or both.

## Decision

The system is closer to practical 50-item readiness, but the evidence now shows an intermittent batch parse failure risk.

Current readiness statement:

> Backend async 50-item generation is promising at concurrency `2`, but should remain in controlled rollout until `AI_JSON_PARSE_FAILED` recovery and quality-warning follow-ups are addressed.

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
