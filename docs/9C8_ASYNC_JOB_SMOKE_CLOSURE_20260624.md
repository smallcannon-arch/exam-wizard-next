# 9C-8 Async Job Smoke Closure and Cleanup Policy

## Background

PR #12 added D1-backed metadata for async generation jobs. The production Worker was deployed after merge and a low-risk endpoint smoke was executed.

This smoke did not call Gemini and did not execute generation. It only verified that:

- the Worker is healthy,
- `POST /generation-jobs` can create queued D1 metadata,
- `GET /generation-jobs/:jobId` can read queued progress,
- invalid job ids are rejected before storage access.

## Production Smoke Result

| Field | Value |
| --- | --- |
| Worker | `exam-wizard-next-proxy` |
| Worker version | `45416dc6-798b-4d45-bfc6-1a56225a9204` |
| D1 database | `exam-wizard-generation-jobs` |
| Smoke job id | `gen_eba2cd37-94b1-485a-8534-553ad580fb65` |
| Job status | `queued` |
| Requested item count | `4` |
| Batch size | `4` |
| Batch count | `1` |
| Completed item count | `0` |
| Result JSON | `null` |
| Expires at | `2026-06-25T06:37:40.713Z` |

## Data Safety

The smoke record is safe metadata only. It does not contain:

- raw prompt,
- raw output,
- source material text,
- API key,
- token,
- headers,
- stack trace.

## Cleanup Policy Decision

Keep the smoke job row as a temporary audit trail for now.

Reasoning:

- It verifies that production D1 writes and reads are working.
- It is safe metadata only.
- The row includes an `expires_at` value.
- No cleanup executor exists yet.

Do not manually delete the row in this step. Deleting production D1 rows by hand would create a separate operational action and should be done only when a cleanup policy or script is approved.

## Recommended Follow-Up

Add cleanup in a separate small task before broader async rollout:

1. Define a cleanup policy for expired jobs.
2. Add a safe cleanup helper or endpoint that deletes only rows whose `expires_at` is older than the current timestamp.
3. Ensure child batch rows are removed via `ON DELETE CASCADE`.
4. Add tests for expired job cleanup.
5. Keep cleanup separate from the real Workflow runner implementation.

## Not Included

- No Gemini call.
- No batch execution.
- No Workflow runner.
- No manual D1 delete.
- No Pages deploy.
- No Worker deploy in this document task.
- No npm audit fix.

## Next Decision

Recommended next task: `9C-9 expired async job cleanup helper`.

That task should remain separate from the real async generation runner.
