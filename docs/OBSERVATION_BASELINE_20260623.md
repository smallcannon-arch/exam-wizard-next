# Output / Cost / Latency Observation Baseline

Date: 2026-06-23

Status: baseline report and observation design. No product code, prompt, schema, Worker API, UI, deployment, npm audit, `tmp/`, or stash changes are included.

## 1. Background

PR #5 has been merged, manually deployed, and production smoke has passed. The current deployed main commit is:

```text
f65d42b50d48699d8b8352cc66bf9f408cf0921d
```

The next decision area is not another feature change. It is to establish a practical observation baseline for output size, cost risk, and generation latency so later work can decide whether to prioritize:

- 8D: batch generation proof of concept.
- 8E: asynchronous job queue / durable workflow evaluation.
- 8B: additional release readiness / operational checks.
- prompt or `qualityMeta` compression.

This document does not include raw prompts, raw outputs, API keys, tokens, request headers, or repo-external generated artifacts.

## 2. Existing Data Inventory

### Existing diagnostics and observation sources

| Source | Location | What it provides | Notes |
|---|---|---|---|
| Output diagnostics helper | `frontend/src/core/outputDiagnostics.js` | item-level and paper-level output length metrics, budget warning codes | Implemented as pure helper; not a product UI feature. |
| Output diagnostics tests | `tests/outputDiagnostics.test.js` | coverage for raw output length, student item length, qualityMeta length, distractorDesign length, paper summaries, and leakage boundary | Confirms diagnostics are not included in student item projection. |
| Budget diagnostics record | `_系統/核對清單/20260621_output_qualityMeta_budget_diagnostics.md` | B4/B5 output budget history, warning codes, targeted compact results | Main structured source for output/cost baseline. |
| B5 deploy gate decision | `_系統/核對清單/20260621_B5_deploy_gate與raw_output風險決策.md` | B5 structure/duration/budget gates and raw output +180.1% risk decision | Defines raw output as cost / observability risk disclosure. |
| B5 final smoke record | `_系統/核對清單/20260621_B5_final_smoke與PR準備.md` | final smoke, B5 gates, PR readiness notes | Confirms B5 12/12 success and no leakage. |
| A/B summary report | `_系統/核對清單/ab_summary_report.md` | Run 1R quality and latency comparison | Shows quality passed but early prompt-quality branch had +90.3% average generation time. |
| Generation UX / batching / async planning | `_系統/核對清單/20260621_生成等待UX與分批非同步方案規劃.md` | architecture options for progress UI, batching, async queue, and output/cost strategy | Planning source for 8D / 8E decisions. |

### Data not currently available in repo

| Data | Status |
|---|---|
| Full raw outputs | Kept repo-external by design; not read or committed here. |
| Token usage returned by model API | Not observed in repo documents. |
| Estimated monetary cost | Not computed yet because token usage is unavailable. |
| Production usage telemetry | Not available in repo. |
| Real post-deploy teacher generation samples | Not yet collected. |

## 3. Current Test Environment

| Item | Current value |
|---|---|
| Deployed commit | `f65d42b50d48699d8b8352cc66bf9f408cf0921d` |
| Production page | `https://smallcannon-arch.github.io/exam-wizard-next/` |
| Deploy mode | manual `workflow_dispatch` |
| Auto deploy on main push | disabled |
| Latest known production smoke | passed |
| Formal API generation in this task | not executed |
| Reason real generation was not executed | this task is a baseline/report task and should avoid unnecessary API cost; low-cost samples should be run only with explicit owner approval and a prepared recording sheet. |

## 4. Historical Observation Results

### Summary table

| Observation | Scope | Success / failure | Latency | Output / budget | Leakage | Interpretation |
|---|---|---|---:|---|---|---|
| Run 1R A/B | 6 old + 6 new items, G4 Chinese/Math | both groups 6/6 success; hard fail 0 | old avg 10.690s; new avg 20.347s | prompt length +78.6%; raw output not summarized | no student leakage finding | Quality passed, but latency risk triggered stabilization work. |
| B4 fullpaper | 12-item standard fullpaper | 12/12 success; parse/validation/contract failures 0 | 92.1s; +26.4% vs then-main 72.9s | raw output +181.6%; over-budget items 3 | student leakage 0 | Structure stable, but output/cost risk and budget warnings remained. |
| B5 math targeted compact regression | 3 math over-budget slots | 3/3 success; failures 0 | not used as fullpaper gate | qualityMeta avg 1453 -> 1346; distractorDesign avg 770 -> 670; SINGLE_DISTRACTOR warnings 2 -> 0; QUALITY_META warnings 3 -> 1 | student leakage 0 | Targeted compact reduced warning hotspots without breaking contracts. |
| B5 standard fullpaper | 12-item standard fullpaper | 12/12 success; Chinese 6/6; Math 6/6; all structure failures 0 | 80.6s; main 82.5s; B5 faster by 2.3% | raw output +180.1%; overBudgetItemCount 0; QUALITY_META_OVER_BUDGET 0; SINGLE_DISTRACTOR_OVER_BUDGET 0 | student leakage 0 | Current best baseline: duration and warning gates pass; raw output remains a cost/observability disclosure. |
| PR #5 production smoke | deployed UI after progress MVP | page 200 OK; title `命題系統`; low-cost interactions passed | not a generation test | not applicable | no visible leakage finding | Production UI is usable; no actual generation sample was collected. |

### Diagnostic budgets currently defined

| Budget | Value | Purpose |
|---|---:|---|
| rawOutputLength | 3200 | item-level raw output warning threshold |
| studentItemLength | 900 | item-level student projection length warning threshold |
| qualityMetaLength | 1400 | item-level `qualityMeta` warning threshold |
| distractorDesignLength | 900 | item-level `qualityMeta.distractorDesign` warning threshold |
| teacherExplanationLength | 80 | teacher explanation length warning threshold |
| correctReasonLength | 80 | correct reason length warning threshold |
| perDistractorLength | 260 | single distractor diagnostic length warning threshold |
| paperRawOutputLengthPerItem | 3200 | paper-level raw output warning threshold |
| paperQualityMetaLengthPerItem | 1400 | paper-level `qualityMeta` warning threshold |

## 5. Low-Cost Observation Matrix

The first real post-deploy observation should use a very small sample and must not store raw prompt or raw output in the repo.

| Sample ID | Subject | Grade | Suggested item count | Purpose | Run now? |
|---|---|---:|---:|---|---|
| 8C-CH-G4-SMALL | 國語 | 4 | 4-6 | observe qualityMeta/output behavior on Chinese reading/language items | no; requires explicit owner approval |
| 8C-MA-G4-SMALL | 數學 | 4 | 4-6 | observe math `qualityMeta` and distractorDesign length after targeted compact | no; requires explicit owner approval |
| 8C-NA-G5-SMALL | 自然 | 5 | 4-6 | observe non-Chinese/non-Math subject behavior if current prompt supports it | no; requires explicit owner approval and scope confirmation |

Recommended run rules:

- Run at most one sample at a time.
- Do not exceed 4-6 items per sample.
- Do not run 20-item or 30-item fullpaper tests in this phase.
- Save only summarized metrics to repo.
- Keep raw prompt, raw output, full API response, headers, and secrets out of repo.
- If a sample fails, record failure type and high-level symptoms only.

## 6. Manual Recording Table

Use this table for the first real low-cost observation. Fill one row per generation attempt.

| timestamp | subject | grade | item count | requested blueprint | success / failure | latency seconds | raw output length | parsed item count | expected item count | JSON parse success | schema validation result | missing fields | answer/options consistency | qualityMeta complete | qualityMeta length / ratio | visible leakage finding | friendly error message | token usage | estimated cost | notes |
|---|---|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|---|---|---|---|---|---|---|
| TBD | 國語 | 4 | 4-6 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | not available unless API returns it | not available unless token usage is available | First low-cost sample. |
| TBD | 數學 | 4 | 4-6 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | not available unless API returns it | not available unless token usage is available | Focus on `qualityMeta` / distractorDesign. |
| TBD | 自然 | 5 | 4-6 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | not available unless API returns it | not available unless token usage is available | Run only if current prompt path supports it. |

## 7. Analysis Baseline

### 7.1 Is generation too slow?

Current best evidence does not prove a latency blocker:

- Early PR #1 A/B showed new prompt average generation time +90.3%.
- Stabilization B5 reduced standard fullpaper total duration to 80.6s, compared with main 82.5s, so B5 was 2.3% faster in that controlled test.
- PR #5 improves waiting experience but does not reduce model latency.

Judgment: latency should be monitored in real samples, but current B5 evidence does not justify immediately building asynchronous job queue.

### 7.2 Is output too long?

Yes, output size remains the strongest known risk:

- B5 raw output remained +180.1% relative to main.
- Budget warnings were reduced to zero, so the issue is likely structural cost from `qualityMeta`, not a single runaway field.

Judgment: record real post-deploy raw output length summaries before another compression pass.

### 7.3 JSON parse / schema validation risk

Current evidence is good:

- B5 standard fullpaper had JSON parse failure 0 and validation failure 0.
- P1/P2 validation findings were fixed before merge.

Judgment: no immediate schema hardening task is indicated unless real samples regress.

### 7.4 Missing items or item count risk

Current B5 evidence is good:

- 12/12 standard fullpaper success.
- Chinese 6/6 and Math 6/6.

Judgment: include parsed item count vs expected item count in all 8C observations.

### 7.5 Is qualityMeta too heavy?

Yes, but now it appears bounded:

- B4 analysis found `qualityMeta` accounted for about 90.7% of raw output increase.
- Targeted compact removed B5 budget warnings.
- B5 raw output still stayed +180.1%, suggesting fixed `qualityMeta` structure remains the baseline cost.

Judgment: do not remove `qualityMeta`; gather real samples first, then consider tiered detail / teacher-review mode / debug mode.

### 7.6 Subject differences

Known:

- B4 over-budget items were concentrated in Math.
- B5 targeted compact focused on Math and improved budget warnings.

Unknown:

- Natural science post-deploy behavior is not yet measured in the same controlled way.

Judgment: include one Natural G5 small sample only after confirming the current prompt path supports it.

### 7.7 Question type differences

Known:

- Choice-form contracts and distractorDesign keys are now validated.
- Output growth is most likely tied to `qualityMeta` and distractor diagnostics.

Unknown:

- Whether long reading prompts, chart interpretation, or experiment inquiry items create larger output spikes in real usage.

Judgment: future samples should annotate question type distribution.

## 8. Decision Guidance for 8D / 8E / 8B

| Follow-up | Recommendation | Reason |
|---|---|---|
| 8D batch generation POC | Not enough evidence to start immediately; prepare after 2-3 real small samples if latency/failure risk appears. | B5 latency gate passed; batching adds API calls and merge-validation complexity. |
| 8E async job queue | Defer. | No current evidence that synchronous flow is failing after PR #5; async job queue is high architecture cost. |
| 8B release readiness / operational checklist | Reasonable next step if owner wants production monitoring discipline. | It can formalize manual observation without changing product behavior. |
| Prompt compression | Do not start another prompt compression pass yet. | Budget warnings are already 0; raw output increase appears structural and should be measured in real samples first. |
| qualityMeta tiered detail / teacher-review / debug mode | Keep as contingency. | Use only if real samples show unacceptable cost or latency. |

## 9. Commit Recommendation

Recommended: commit this document as a docs-only baseline after owner review.

Suggested commit message, if approved later:

```text
docs(observation): 建立 output cost latency baseline
```

Do not commit raw outputs, raw prompts, API responses, tokens, headers, repo-external generated artifacts, `tmp/`, stash contents, or npm audit changes.

## 10. Open Items

- Real post-deploy low-cost generation samples have not been executed.
- Token usage is unavailable unless the API response or provider tooling exposes it.
- Estimated monetary cost is unavailable until token usage is recorded.
- Natural science support should be confirmed before running the G5 Natural sample.
- A repo-external runner or manual procedure is needed if future observations require raw-output-derived metrics without storing raw outputs in repo.

## 11. Conclusion

8C observation baseline is established as a documented baseline and measurement design. Existing B5 evidence supports controlled production use with cost / observability monitoring; it does not yet justify jumping directly to batch generation or asynchronous job queue.
