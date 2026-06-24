# 9C-2 D1 Resource Preparation

Date: 2026-06-24

Status: resource preparation PR.

This document records the D1 resource created for future async generation metadata. It does not deploy Worker code, does not deploy Pages, does not call Gemini, and does not run 20/30/50-item generation.

## 1. Decision

Use a D1-only MVP for async generation job metadata and normalized result storage.

Rationale:

- R2 is not enabled in the current Cloudflare account.
- The first async MVP should avoid adding both D1 and R2 at once.
- D1 can store job metadata, batch metadata, and a normalized final result JSON payload.
- Raw prompt and raw model output must not be stored.

## 2. Created Cloudflare Resource

| Item | Value |
|---|---|
| Resource | Cloudflare D1 database |
| Database name | `exam-wizard-generation-jobs` |
| Database id | `6a96cdf9-2a8a-45ad-a6ee-9db303db5a9b` |
| Region | APAC |
| Binding | `GENERATION_JOBS_DB` |

The Cloudflare account id is intentionally not recorded in this repo document.

## 3. Repo Changes

| File | Purpose |
|---|---|
| `worker/wrangler.toml` | Adds production D1 binding. |
| `worker/wrangler.toml.example` | Adds placeholder D1 binding example. |
| `worker/migrations/0001_generation_jobs.sql` | Defines async generation job and batch metadata schema. |
| `tests/generationJobSchema.test.js` | Verifies binding and schema safety constraints. |

## 4. Schema Scope

The migration creates:

- `generation_jobs`
- `generation_job_batches`

The schema tracks:

- job status,
- requested item count,
- batch size/count,
- completed batch/item counts,
- current batch,
- safe `error_code`,
- final normalized `result_json`,
- timestamps and expiry.

## 5. Explicit Non-storage Boundary

The schema must not store:

- raw prompt,
- raw model output,
- full provider response,
- API key,
- token,
- request headers,
- stack trace.

## 6. Migration State

This PR adds the migration file but does **not** apply it to remote D1.

Remote migration application should happen only after review, merge, and a separate Worker release/deploy checklist.

## 7. Not Included

- No Worker deploy.
- No Pages deploy.
- No `workflow_dispatch`.
- No Gemini generation.
- No 20/30/50-item test.
- No prompt change.
- No schema / frontend UI change.
- No npm audit work.
- No `tmp/` handling.
- No stash handling.

## 8. Next Step

After this PR is reviewed, the next implementation should wire `GENERATION_JOBS_DB` into the async job skeleton so job creation and status can persist metadata.

That should still happen before real 50-item generation.
