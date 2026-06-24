# 9C-16 Deployment Closure and 50-Item Stability Path

Date: 2026-06-25

Status: closure and planning note. No product code, prompt, schema, Worker API, Pages workflow, deploy, or generated raw output is included in this document.

## Current Production State

| Item | Status |
| --- | --- |
| main commit deployed to Pages | `d194193c7a9caae2a02847408a5c0f298f85f7da` |
| Worker | `exam-wizard-next-proxy` |
| Worker version | `546f9eb3-9f35-494a-b98b-8b112a1dee7e` |
| Worker deploy time | `2026-06-24T12:34:46.569Z` |
| Pages deploy workflow run | `28099337482` |
| Pages deploy event | `workflow_dispatch` |
| Pages deploy result | success |
| Production URL | `https://smallcannon-arch.github.io/exam-wizard-next/` |
| Production HTTP smoke | HTTP 200 |
| Production page title | `命題系統` |
| Production main UI | loaded |
| Production console fatal error | none observed |
| Production low-cost interaction | step navigation passed |

## What Is Proven

1. GitHub Pages deploy is manually controlled by `workflow_dispatch`.
2. Pushing or merging to `main` no longer automatically deploys Pages.
3. The deployed production page loads successfully.
4. Basic frontend navigation works without fatal console errors.
5. The production Worker health endpoint is available.
6. The production Worker async job path can complete a 13-item request by direct API smoke.
7. The completed async job result can be fetched from the safe result endpoint.
8. The 13-item direct Worker smoke returned 13 / 13 items with `qualityMeta`.
9. The same 13-item result passed frontend v2 validation when validated with correct local slot labels.
10. No raw prompt, raw output, API key, token, headers, cookies, or full generated item text was saved in repo.

## What Is Not Yet Proven

1. The production browser UI has not yet been used to submit a 13-item async generation request after Pages deploy.
2. A 25-item async production observation has not been run.
3. A 50-item async production observation has not been run.
4. Cross-subject 50-item reliability is not yet proven.
5. The user-facing timeout copy under a long async browser request has not yet been production-smoked.
6. Cost and latency behavior at 25 and 50 items remains unknown.
7. Recovery behavior after one failed async batch still needs targeted observation.
8. Operational dashboards or durable deployment metadata are still minimal.

## Current Routing Model

| Requested item count | Route |
| --- | --- |
| 1-6 | Synchronous `/generate-items` |
| 7-12 | Frontend serial batching |
| 13-50 | Async generation job with status polling and result fetch |
| 51+ | Not enabled |

## 50-Item Stability Path

The project should not jump directly from one successful 13-item Worker smoke to declaring 50-item production readiness. The safer path is staged, with one API-costing observation per stage unless a failure requires root-cause audit.

### 10A: Production UI Async Smoke, 13 Items

Purpose:

- Verify the deployed browser UI uses the async path correctly.
- Confirm loading / polling / result import works from the user-facing page.
- Keep cost controlled by using the already-proven 13-item threshold.

Validation:

- One production UI generation only.
- 13 requested items.
- Generated item count equals 13.
- v2 validation passes.
- `qualityMeta` present for all items.
- No visible leakage.
- No raw prompt / raw output stored.

Decision level: medium, because it spends one real generation call.

### 10B: Production Worker Observation, 25 Items

Purpose:

- Measure latency, completed batch count, result size, and validation reliability at a medium-large count.
- Avoid browser UI variables while testing Worker job stability.

Validation:

- One direct Worker async job.
- 25 requested items.
- Result endpoint returns completed payload.
- v2 validation passes.
- Safe summary metrics only.

Decision level: medium-high, because it spends a larger generation call.

### 10C: Production Worker Observation, 50 Items

Purpose:

- Validate the current upper supported limit.
- Establish whether 50-item generation is operationally realistic before advertising it as stable.

Validation:

- One direct Worker async job.
- 50 requested items.
- Completed item count equals 50.
- v2 validation passes.
- No `qualityMeta` missing.
- No visible leakage.
- Cost and latency recorded as summary metrics.

Decision level: major, because it is the highest-cost and highest-latency supported path.

### 10D: Failure Hardening If Any Stage Fails

Possible actions:

- Improve safe error code classification.
- Tune polling timeout copy.
- Improve async job failure summaries.
- Add targeted retry around failed batch execution only if safe.
- Add deployment metadata / version endpoint if version ambiguity returns.

Decision level: depends on failure class.

### 10E: 50-Item Readiness Decision

Possible outcomes:

1. Keep 50 items as beta / cautious mode.
2. Publish 50 items as supported after sufficient observations.
3. Lower recommended maximum until latency or cost improves.
4. Start prompt compression or qualityMeta tiering if output size dominates.
5. Start deeper job observability if failures are operational rather than prompt-related.

Decision level: major.

## Major Decision Points

| Decision | Why It Matters | Recommended Stop Condition |
| --- | --- | --- |
| Run production UI 13-item async smoke | Costs one real generation and tests live UX | Ask owner before running |
| Run 25-item observation | Higher cost and latency | Ask owner before running |
| Run 50-item observation | Highest supported count and largest cost | Ask owner before running |
| Change max item limit | Affects product promise and cost envelope | Ask owner |
| Change prompt / schema contract | Could affect all generated output | Ask owner |
| Deploy Worker or Pages | Production impact | Ask owner |
| Implement retry / cancellation / queue semantics | Changes user-facing generation behavior | Ask owner if behavior changes materially |

## Low-Risk Work The Agent Can Continue Without Owner Decision

- Docs-only closure notes.
- Read-only PR / workflow / branch checks.
- Test-only verification.
- Markdown observation templates.
- Safe summary metrics review.
- Non-deploy local validation.
- Small wording improvements that do not change product behavior.

## Data Boundary

This document intentionally does not include:

- raw prompt
- raw output
- full generated item text
- full API responses
- API key
- token
- request headers
- cookies
- repo-external raw output files

## Recommendation

Next recommended step is `10A: Production UI Async Smoke, 13 Items`, but it should be treated as a medium decision because it spends one real production generation call.

Until that is approved, the project can continue with non-costing documentation and readiness checks only.
