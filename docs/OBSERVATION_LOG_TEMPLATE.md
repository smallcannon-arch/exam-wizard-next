# Observation Log Template

Use this template after each real low-cost generation observation. Record only summarized metrics and human observations. Do not paste raw prompts, raw outputs, full API responses, API keys, tokens, request headers, cookies, or repo-external generated artifacts into this file.

This template is designed for manual observation. It does not require product changes, prompt changes, schema changes, Worker API changes, UI changes, deployment, npm audit work, `tmp/`, or stash changes.

## Scope

Purpose:

- Collect real generation observations at low API cost.
- Track output / cost / latency signals consistently.
- Provide evidence for future 8D batch generation decisions.
- Keep raw data outside the repo.

Recommended sample size before 8D decision:

- Minimum: 3 real small samples.
- Better: 5-6 real small samples across at least Chinese and Math.
- Keep each sample to 4-6 items unless owner explicitly approves a larger run.

## Existing Helpers

| Helper | Location | Use |
|---|---|---|
| `createItemOutputDiagnostics` | `frontend/src/core/outputDiagnostics.js` | Summarize item-level raw output length, student item length, qualityMeta length, distractorDesign length, and budget warnings when summarized input is available. |
| `createPaperOutputDiagnostics` | `frontend/src/core/outputDiagnostics.js` | Summarize paper-level totals, averages, over-budget item count, and paper warning codes. |
| `validateGeneratedPaper` | `frontend/src/core/validateGeneratedPaper.js` | Confirm schema / validation contract result when generated items are available to the reviewer. |
| `toStudentItem` | `frontend/src/core/itemViews.js` | Check student projection and leakage boundary. |
| `buildAuditRows` / `renderAuditTable` | `frontend/src/core/auditRows.js`, `frontend/src/core/renderAuditTable.js` | Support teacher audit-table review after generated items exist. |

If a helper requires raw output, run it repo-external and record only the summarized metrics here.

## Observation Entry

Copy one entry per generation attempt.

### Basic Information

| Field | Value |
|---|---|
| observationId | 8B-YYYYMMDD-001 |
| dateTime | YYYY-MM-DD HH:mm |
| tester |  |
| commit |  |
| branch |  |
| environment | production / local / preview |
| pageUrl |  |
| model / provider, if known | N/A |

### Generation Conditions

| Field | Value |
|---|---|
| subject |  |
| grade |  |
| itemCount |  |
| questionTypes |  |
| blueprintSummary |  |
| materialScope |  |
| objectiveMode | textbook objectives / ability framework / other |
| notesBeforeRun |  |

### Observation Result

| Field | Value |
|---|---|
| latencySeconds |  |
| successOrFail | success / fail |
| parsedItemCount |  |
| expectedItemCount |  |
| jsonParseResult | pass / fail / N/A |
| schemaValidationResult | pass / fail / N/A |
| missingFields | none / list / N/A |
| answerOptionsConsistency | pass / fail / N/A |
| qualityMetaCompleteness | complete / partial / missing / N/A |
| outputBudgetWarnings | none / list / N/A |
| rawOutputLengthSummary | N/A |
| studentItemLengthSummary | N/A |
| qualityMetaLengthSummary | N/A |
| distractorDesignLengthSummary | N/A |

### Cost

| Field | Value |
|---|---|
| tokenUsage | N/A |
| estimatedCost | N/A |
| costNotes |  |

If token usage or cost is not exposed by the API or provider tooling, keep the value as `N/A`.

### Quality Observation

| Field | Value |
|---|---|
| leakageFinding | none / finding |
| hallucinationFinding | none / finding |
| gradeAppropriateness | acceptable / needs review / fail / N/A |
| objectiveAlignment | acceptable / needs review / fail / N/A |
| distractorQuality | acceptable / needs review / fail / N/A |
| explanationQuality | acceptable / needs review / fail / N/A |
| friendlyErrorMessage | yes / no / N/A |
| itemQualitySummary |  |
| notes |  |

Leakage checklist:

- Student view must not show `qualityMeta`.
- Student view must not show `distractorDesign`.
- Student view must not show `teacherExplanation`.
- Student view must not show `selfCheck`.
- Student view must not show `outputDiagnostics`.
- Student view must not show raw prompt, raw output, API key, token, header, or stack trace.

### Conclusion

| Field | Value |
|---|---|
| conclusion | acceptable / needs review / fail |
| reviewer |  |
| followUpNeeded | none / 8D / 8E / prompt compression / qualityMeta tiered detail / validation fix / other |
| followUpNotes |  |

## Batch Summary

Use this section after collecting multiple observations.

| Metric | Summary |
|---|---|
| sampleCount |  |
| subjectsCovered |  |
| averageLatencySeconds |  |
| maxLatencySeconds |  |
| successRate |  |
| jsonParseFailures |  |
| schemaValidationFailures |  |
| leakageFindings |  |
| repeatedOutputBudgetWarnings |  |
| averageRawOutputLength, if available |  |
| averageQualityMetaLength, if available |  |
| tokenUsageSummary, if available | N/A |
| costSummary, if available | N/A |

## Decision Rules

Use the observations to decide the next step:

| Condition | Suggested next step |
|---|---|
| 3-5 small samples pass, latency acceptable, no leakage, no repeated validation failures | Continue monitoring; do not start 8D yet. |
| Latency is repeatedly too high or user waiting feedback is poor | Consider 8D batch generation POC. |
| JSON parse / validation failures repeat | Prioritize validation or generation contract review before batching. |
| raw output / qualityMeta warnings repeat while latency remains acceptable | Consider qualityMeta tiered detail or prompt/output compression before 8D. |
| Student leakage appears once | Treat as blocking; fix leakage before more observation. |
| Multiple samples fail due to timeout or long synchronous waits | Consider 8D first; evaluate 8E only after 8D evidence. |

## Commit Guidance

This template is safe to commit if it remains docs-only and contains no raw prompts, raw outputs, full API responses, secrets, personal data, `tmp/`, stash contents, or npm audit changes.

Suggested commit message:

```text
docs(observation): 新增人工生成觀察紀錄模板
```
