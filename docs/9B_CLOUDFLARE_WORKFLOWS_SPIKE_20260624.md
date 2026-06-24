# 9B Cloudflare Workflows Platform Selection Spike

Date: 2026-06-24

Status: platform spike, read-only findings.

This document records whether Cloudflare Workflows is a viable next step for stable up-to-50-item generation. It does not change product code, prompt, schema, Worker API, UI, deployment workflow, npm audit state, `tmp/`, or stash.

## 1. Scope

This spike checked:

- existing Worker configuration,
- Wrangler availability,
- Cloudflare Workflows CLI availability,
- storage readiness for D1 / R2 / Queues,
- current Worker API shape,
- whether the next implementation should use Workflows or a fallback design.

No Gemini generation was called.
No Worker or Pages deploy was triggered.
No Cloudflare resource was created.

## 2. Current Worker Project

| Item | Finding |
|---|---|
| Worker name | `exam-wizard-next-proxy` |
| Worker config | `worker/wrangler.toml` |
| Worker entry | `worker/src/index.js` |
| Deploy command | `cd worker && npm run deploy` |
| Wrangler version | `4.100.0` |
| Latest Wrangler notice | `4.104.0` available, not updated in this spike |
| Existing Workflows config | none |
| Existing D1 binding | none |
| Existing R2 binding | none |
| Existing Queue binding | none |

Current `worker/wrangler.toml`:

- uses TOML, not JSONC,
- has `compatibility_date = "2026-06-15"`,
- has production vars for allowed origin, Gemini API version/model, and timeout,
- has no `[[workflows]]`, `[[d1_databases]]`, `[[r2_buckets]]`, or queues config.

## 3. Cloudflare Account Readiness

Wrangler read-only checks:

| Check | Result |
|---|---|
| `npx wrangler --version` | success, `4.100.0` |
| `npx wrangler whoami` | success, authenticated account available |
| `npx wrangler workflows list` | success, no deployed Workflows in account |
| `npx wrangler d1 list` | success, no visible database rows in output |
| `npx wrangler queues list` | success, no visible queue rows in output |
| `npx wrangler r2 bucket list` | failed because R2 is not enabled in the Cloudflare dashboard |

The authenticated account identifier is intentionally not recorded in this repo document.

## 4. Official Platform Notes

Cloudflare's Workflows documentation describes Workflows as durable multi-step applications on Workers with retries and persisted state:

- https://developers.cloudflare.com/workflows/get-started/guide/
- https://developers.cloudflare.com/workflows/build/workers-api/
- https://developers.cloudflare.com/workflows/reference/limits/
- https://developers.cloudflare.com/workflows/reference/pricing/

Relevant implementation shape from the docs:

- a Workflow class extends `WorkflowEntrypoint`,
- Wrangler config adds a `workflows` binding with `name`, `binding`, and `class_name`,
- the Worker can call `env.MY_WORKFLOW.create()` to start an instance,
- the Worker can call `env.MY_WORKFLOW.get(instanceId)` and `instance.status()` to check progress,
- steps can use retry configuration,
- pricing uses the same underlying Workers compute/request model plus persisted Workflow state.

The local Wrangler config schema includes `workflows`, so this repo's installed Wrangler supports Workflow binding configuration.

## 5. Fit Against 50-item Generation

### Fit: good

Workflows matches the main reliability need:

- durable orchestration beyond one browser request,
- batch-level steps,
- per-step retry,
- resumable status,
- safe progress polling,
- no need to keep one HTTP request open for a 50-item generation.

### Gaps to handle

The repo still needs explicit design for:

- job metadata persistence,
- result storage,
- user-safe job status response,
- batch validation,
- final paper validation,
- result expiration / retention,
- manual rollback path.

## 6. Storage Recommendation

Because R2 is not enabled, do not make R2 required for the first implementation.

Recommended MVP storage:

| Data | Recommendation |
|---|---|
| job metadata | D1 |
| batch metadata | D1 |
| final normalized result | D1 JSON text column for MVP |
| raw prompt / raw output | do not store |
| full provider response | do not store |
| future large result storage | consider R2 only after owner enables R2 |

This keeps the next implementation smaller and avoids blocking on R2 account setup.

## 7. Current Worker Contract Reuse

Existing Worker code already has useful pieces for async generation:

- `/generate-items` in `worker/src/index.js`,
- safe error payload handling,
- fixed `errorCode` values,
- minimum `qualityMeta` gate in `worker/src/json.js`,
- Gemini timeout policy in `worker/src/gemini.js`,
- tests for Worker payload contract.

The async path should reuse these helpers instead of duplicating validation logic.

## 8. Recommended 9C Scope

Next recommended implementation: `9C: async generation job skeleton`.

Keep it small:

- create a branch from `main`,
- add Workflow class skeleton,
- add Wrangler Workflow binding,
- add D1 metadata design or local mock if resource creation is not yet approved,
- add `POST /generation-jobs` and `GET /generation-jobs/:jobId`,
- do not call Gemini,
- do not generate real items,
- do not deploy without separate approval,
- test only safe response shape and status transitions.

Suggested branch:

```text
codex/async-generation-job-skeleton
```

## 9. Decision Point Before 9C

Implementation should pause for owner confirmation on these items:

| Decision | Recommendation |
|---|---|
| Orchestrator | Cloudflare Workflows |
| First storage | D1 metadata plus D1 JSON result for MVP |
| R2 | not required for MVP; enable later only if result size requires it |
| Batch size | 4 items |
| Concurrency | 1 |
| Retry | transient upstream / empty response only |
| Deploy | no deploy in 9C |
| API generation | no Gemini calls in 9C |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Workflows config may require Wrangler update | test in a branch; update Wrangler only in a separate dependency-aware PR if needed |
| D1 resource creation is a Cloudflare account change | do not create until owner approval |
| Async endpoints could confuse current sync UI | keep 9C skeleton hidden from UI until 9E |
| Result storage could accidentally retain raw output | store only normalized final items and summarized metrics |
| Retry policy could burn API cost | do not call Gemini in 9C; later keep retries bounded and errorCode-based |

## 11. Recommendation

Proceed with Cloudflare Workflows as the primary 50-item architecture.

Do **not** implement the full 50-item pipeline in one PR. The next safe step is `9C: async generation job skeleton`, but it needs owner confirmation because it may require Cloudflare resource decisions for D1 and Workflow binding/deployment later.

Until that decision, continue collecting low-count observations and do not run 20/30/50-item generation.
