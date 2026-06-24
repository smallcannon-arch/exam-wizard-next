# 10B 25-Item Manual Quality Audit

Date: 2026-06-25

Status: manual quality audit completed for the first effective 25-item async observation.

This file stores only summarized audit findings. It does not store raw prompt, raw output, full generated item text, full API responses, API keys, tokens, request headers, cookies, or repo-external raw output files.

## Source Observation

| Field | Value |
| --- | --- |
| source observation | `10B Worker 25-Item Effective Observation After Stimulus Prompt Contract` |
| jobId | `gen_a3e03199-75bd-4ca9-a2e5-34e6737378d5` |
| subject | 國語 |
| grade | 四年級 |
| requested item count | 25 |
| generated item count | 25 |
| v2 validation | pass |
| qualityMeta | 25 / 25 present |
| leakage finding | none |
| latency | 221.16s |

## Audit Method

Five items were sampled across the generated set:

| Sample | Item |
| --- | --- |
| 1 | `Q-001` |
| 2 | `Q-006` |
| 3 | `Q-011` |
| 4 | `Q-016` |
| 5 | `Q-021` |

Review dimensions:

- self-contained question or valid same-item `stimulus`;
- grade suitability;
- answer/options clarity;
- distractor usefulness;
- `qualityMeta` usefulness for teacher review;
- visible leakage;
- visible language / formatting issues.

## Summary Judgment

| Dimension | Judgment | Notes |
| --- | --- | --- |
| Structure / import readiness | strong | 25 / 25 completed, parsed, and passed v2 validation. |
| `stimulus` contract | strong | Questions that referenced text had same-item `stimulus`. |
| Basic grade suitability | acceptable | Sampled items were broadly suitable for grade 4 Chinese. |
| Answer/options clarity | mostly acceptable | 4 / 5 sampled items were clean; 1 sampled item had mixed-language text in an option. |
| Distractor quality | acceptable but uneven | Distractors were generally plausible, but repeated misconception tags reduced diagnostic value. |
| `qualityMeta` usefulness | useful but heavy | Teacher-facing rationale exists and is generally meaningful; output remains large. |
| Leakage | pass | No raw prompt, raw output, API key, token, header, or internal leakage marker found in the summary scan. |

## Findings

### [P2] Mixed-language option in one sampled item

One sampled item had an otherwise valid correct option but included an English connector token in the option text.

Impact:

- This does not break JSON parsing or v2 validation.
- It does reduce classroom polish and teacher trust.
- It suggests the prompt should more explicitly forbid stray English words in Chinese subject `question`, `options`, and `explanation` unless intentionally part of the learning content.

Recommended follow-up:

- Add a narrow prompt/output wording rule for Chinese subject generation:
  - no stray English words in `question`, `options`, or `explanation`;
  - allow only intentional curriculum terms, option codes, or symbols when needed.
- Add a prompt test that locks this rule.

### [P3] Repeated distractor misconception tags reduce diagnostic value

The effective 25-item observation passed validation but produced 12 warnings for repeated distractor misconception tags.

Impact:

- This does not block import.
- It means `qualityMeta` is present but not always diagnostically rich.
- The high `qualityMeta` output ratio may not be fully justified if many distractors reuse the same diagnostic label.

Recommended follow-up:

- Tighten prompt guidance to encourage varied misconception tags within each item.
- Keep this as a quality improvement, not a structural blocker.

## Strong Signals

- The Worker and prompt hardening successfully moved the system from repeated contract failures to a valid 25-item sample.
- `AI_STIMULUS_MISSING` did not recur.
- Every text-referencing sampled item had `stimulus`.
- Every item preserved `qualityMeta`.
- Frontend v2 validation passed with zero blocking errors.

## Remaining Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| 25-item latency | medium | 221.16s is workable through async progress UI, but still long. |
| 50-item stability | unknown | One valid 25-item sample is not enough to prove 50-item reliability. |
| Output size / cost | medium | `qualityMeta` ratio remained high at 0.738. |
| Classroom polish | medium-low | Mixed-language text should be reduced before claiming teaching quality is fully strong. |
| Diagnostic depth | low-medium | Repeated distractor tags reduce the usefulness of teacher diagnostics. |

## Answer to Quality Question

The quality floor has improved significantly:

- valid job completion;
- correct item count;
- valid JSON;
- v2 schema pass;
- complete `qualityMeta`;
- no detected leakage;
- `stimulus` references now backed by same-item text.

However, this does not yet prove a fully polished teaching-quality ceiling. The sampled set still shows at least one visible wording/polish defect and repeated diagnostic tags.

## Recommendation

Before running a 50-item observation, complete one narrow prompt-quality follow-up:

1. forbid stray English words in Chinese subject visible fields;
2. encourage more varied distractor misconception tags;
3. keep it prompt/test-only if possible;
4. deploy Worker after merge;
5. rerun one 25-item observation only if the owner wants confirmation before 50.

If owner accepts the current polish risk, the next empirical step can be one controlled 50-item async observation. The safer path is to do the narrow prompt-quality follow-up first.

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
