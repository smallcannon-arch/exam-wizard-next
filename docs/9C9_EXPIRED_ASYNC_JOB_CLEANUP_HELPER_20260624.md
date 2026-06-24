# 9C-9 Expired Async Job Cleanup Helper

## Scope

This task adds an internal Worker helper for deleting expired async generation job metadata.

It does not expose a public cleanup endpoint and does not run cleanup against production D1.

## Cleanup Rule

Only jobs matching all of these conditions are eligible:

- `expires_at IS NOT NULL`
- `expires_at <= now`
- `job_id` matches the safe async job id format

The helper deletes:

1. matching rows from `generation_job_batches`,
2. then matching rows from `generation_jobs`.

The explicit batch delete is intentional. The schema has `ON DELETE CASCADE`, but explicit deletion keeps the cleanup behavior predictable across D1 runtime settings.

## Safety Controls

- Default cleanup limit: `100` jobs per helper call.
- Maximum cleanup limit: `500` jobs per helper call.
- Invalid timestamps are rejected.
- Missing D1 binding returns `ASYNC_JOB_UNAVAILABLE`.
- D1 read/write errors return `ASYNC_JOB_STATUS_INVALID`.
- The helper does not read or write raw prompt, raw output, source material, API keys, tokens, headers, or stack traces.

## Not Included

- No public cleanup route.
- No scheduled cleanup trigger.
- No production cleanup execution.
- No Gemini call.
- No Worker deploy.
- No Pages deploy.
- No npm audit fix.

## Validation

Expected validation:

- `npx vitest run tests/generationJobs.test.js tests/generationJobSchema.test.js`
- `npm test`
- `npm run check`
- `node --check worker/src/generationJobs.js`
- `node --check worker/src/index.js`
- `node --check worker/src/json.js`
- `node --check tests/generationJobs.test.js`
- `git diff --check`
- `npx wrangler deploy --dry-run`

## Next Decision

After this PR merges, decide separately whether to:

1. deploy the Worker helper,
2. add a private maintenance endpoint,
3. add a scheduled cleanup trigger,
4. or manually clean known smoke rows through a reviewed D1 operation.

Do not mix cleanup execution with the helper implementation.
