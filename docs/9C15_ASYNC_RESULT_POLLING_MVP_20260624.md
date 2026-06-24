# 9C-15 Async Result Polling MVP

## Background

The Worker now supports durable generation jobs for larger requests. PR 9C-14A added the sequential multi-batch Workflow executor, but the frontend still needed a safe path to create a job, poll progress, and fetch the completed result.

This change connects the main-facing UI to the async path only for larger requests. Existing synchronous behavior remains unchanged for smaller requests.

## Scope

- Add a safe Worker result endpoint for completed generation jobs.
- Add frontend API client helpers for async job create, status, and result calls.
- Add frontend polling MVP for requests from 13 to 50 items.
- Reuse the existing loading panel and batch status UI.
- Add tests for async helper thresholds, API client calls, and Worker result endpoint behavior.

## Routing Behavior

| Requested item count | Frontend path |
| --- | --- |
| 1-6 | Existing synchronous `/generate-items` call |
| 7-12 | Existing frontend serial batching |
| 13-50 | Async generation job + status polling + result fetch |
| 51+ | Not enabled by this MVP |

## Worker Result Contract

`GET /generation-jobs/:jobId/result` only returns `items` after the job status is `completed`.

The endpoint does not return:

- raw prompt
- raw output
- API key
- token
- request headers
- source material

The endpoint re-checks the stored payload with the minimum Worker item contract before returning `{ ok: true, items }`.

## Not Included

- No deploy.
- No Pages workflow change.
- No prompt change.
- No schema change.
- No Worker API contract expansion beyond safe async result read.
- No item-level progress.
- No cancel button.
- No partial result rendering.
- No npm audit fix.
- No PR #3 handling.
- No `tmp/` handling.

## Validation Plan

- `npx vitest run tests/generationJobs.test.js tests/apiClient.test.js tests/asyncGeneration.test.js`
- `npm test`
- `npm run check`
- `node --check` for modified frontend and Worker files
- `git diff --check`
- `npm run deploy -- --dry-run` inside `worker/`

## Deployment Note

This PR should remain Draft until review. Merging it does not deploy Pages or Worker. Worker deployment must be a separate decision after final smoke.
