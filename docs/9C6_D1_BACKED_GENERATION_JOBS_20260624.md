# 9C-6 D1-Backed Generation Jobs

## Scope

This change wires the async generation job skeleton to the `GENERATION_JOBS_DB` D1 binding.

It adds the first durable metadata path for future up-to-50-item async generation:

- `POST /generation-jobs` can create a queued job record in D1.
- The request is split into safe 4-item batch metadata rows.
- `GET /generation-jobs/:jobId` can read the queued job status from D1.

This is still a skeleton layer. It does not execute generation.

## Not Included

- No Gemini call.
- No real Cloudflare Workflows runner.
- No item-level generation.
- No batch execution.
- No async UI changes.
- No Pages deploy.
- No Worker deploy in this PR.
- No npm audit fix.

## Data Safety

The D1 metadata path stores only job and batch metadata:

- job id,
- status,
- requested item count,
- batch size/count,
- completed batch/item counts,
- current batch,
- safe error code,
- timestamps,
- final normalized result JSON placeholder for a later step.

It must not store:

- raw prompt,
- raw model output,
- source material text,
- API key,
- token,
- headers,
- stack trace.

## Current Runtime Behavior

When `GENERATION_JOBS_DB` is available:

- `POST /generation-jobs` returns `202` with a queued job payload.
- `GET /generation-jobs/:jobId` returns safe queued progress from D1.
- unknown valid job ids return `404 ASYNC_JOB_NOT_FOUND`.
- invalid job ids return `400 REQUEST_INVALID`.

When `GENERATION_JOBS_DB` is not available, the existing Workflow-backed fallback behavior remains for tests and future integration.

## Validation

Expected validation for this PR:

- `npx vitest run tests/generationJobs.test.js tests/generationJobSchema.test.js`
- `npm test`
- `npm run check`
- `node --check worker/src/generationJobs.js`
- `node --check worker/src/index.js`
- `node --check worker/src/json.js`
- `node --check tests/generationJobs.test.js`
- `git diff --check`
- `npx wrangler deploy --dry-run`

## Next Step

The next implementation should add a real async executor or Cloudflare Workflows binding. That step should remain separate from this D1 metadata PR.
