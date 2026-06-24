# 9C-12 Workflow Generation Skeleton

Date: 2026-06-24

Status: implementation note.

## Scope

This task adds the first Cloudflare Workflows skeleton for async generation jobs.

It connects the existing D1-backed `/generation-jobs` path to a Workflow binding, but the Workflow does not call Gemini and does not generate items yet.

## What Changed

- Added `GENERATION_WORKFLOW` binding to Worker Wrangler config.
- Added `GenerationWorkflow` skeleton.
- `POST /generation-jobs` still creates safe D1 metadata first.
- When `GENERATION_WORKFLOW` is available, the Worker starts a Workflow instance with the same `jobId`.
- Workflow params carry the request and batch plan during execution.
- D1 remains metadata-only and does not store source material or raw prompt/output.
- The skeleton Workflow can mark a job as `running`.

## Data Boundary

D1 continues to store only safe metadata:

- job id
- status
- counts
- safe error code
- timestamps
- final normalized result placeholder

D1 must not store:

- raw prompt
- raw model output
- source material text
- API key
- token
- headers
- stack trace

Workflow params may contain request material during execution. This follows the accepted 9C-11 decision and keeps D1 metadata-only.

## Failure Behavior

If D1 metadata is created but Workflow start fails:

- response returns a safe `ASYNC_JOB_UNAVAILABLE` error,
- the D1 job is marked `failed`,
- no raw request material or provider error is returned.

## Not Included

- No Gemini call.
- No item generation.
- No batch execution.
- No retry policy implementation.
- No result endpoint.
- No async frontend UI.
- No D1 cleanup execution.
- No Worker deploy in this PR.
- No Pages deploy.
- No npm audit fix.

## Validation

Expected validation:

- `npx vitest run tests/generationJobs.test.js tests/generationJobSchema.test.js`
- `npm test`
- `npm run check`
- `node --check worker/src/index.js`
- `node --check worker/src/generationJobs.js`
- `node --check worker/src/json.js`
- `node --check tests/generationJobs.test.js`
- `git diff --check`
- `npm run deploy -- --dry-run` from `worker/`

## Next Step

After this PR merges and a separate Worker deploy is approved, the next implementation should be 9C-13: a single-batch real executor behind a low-count gate.

9C-13 should still keep concurrency at 1 and require a separate controlled observation before moving to multi-batch generation.
