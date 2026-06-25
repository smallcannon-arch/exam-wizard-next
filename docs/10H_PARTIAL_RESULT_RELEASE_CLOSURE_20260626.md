# 10H Partial Result Release Closure

Date: 2026-06-26

## Summary

The 50-item generation path now has a deployed partial-result architecture. The release keeps the 50-item target, avoids silently exporting incomplete papers, and changes the product behavior from all-or-nothing failure toward a recoverable partial result.

This closure note records the release state after the 10E backend contract and 10F frontend presentation work.

## Released

- Backend partial-result contract: merged through PR #35.
- Frontend partial-result presentation: merged through PR #37.
- Main commit: `a950d2dac115b3a2846d827d0944126d26511ed6`.
- Worker: `exam-wizard-next-proxy`.
- Worker version: `9fe372c9-0219-4de0-bcff-e54a0e409066`.
- Pages workflow run: `28196911672`.
- Pages event: `workflow_dispatch`.

## Production Smoke

Static and UI smoke:

- Production URL: `https://smallcannon-arch.github.io/exam-wizard-next/`.
- HTTP status: 200.
- Page title: `命題系統`.
- Main UI loaded.
- Low-cost step switching worked.
- Fatal console error: none observed.
- Deployed JS contains the partial final-output block.

50-item production smoke:

- Subject: Chinese.
- Requested item count: 50.
- Terminal status: `completed`.
- Generated item count: 50/50.
- Latency: 274.74 seconds.
- v2 validation: pass.
- Batch diagnostics: 13/13 present.
- `finishReason`: `STOP` for 13/13 batches.
- Retry count: 0.
- Leakage finding: none.

## Important Limitation

The release smoke did not naturally trigger a real production `partial` job.

Therefore:

- the normal 50-item path is production-smoke verified after the partial release;
- the partial UI and export-blocking code are deployed and tested;
- the first real production partial result remains unobserved.

The first real partial result should be treated as a required follow-up observation, not as a new feature request.

## First Real Partial Observation Checklist

When a production job first ends as `partial`, inspect:

- successful items preserve original item positions;
- missing slots appear in their original item positions;
- the teacher-facing frame says `已完成 X / Y 題，N 題待補`;
- missing cards use the uniform sentence `此題未能生成，可於後續補齊。`;
- raw `errorCode`, contract enum, upstream status, and diagnostics are not shown to teachers;
- review, audit, and output screens agree on completed/missing counts;
- print, Word export, and Excel export remain disabled while missing slots exist;
- the output page explains why final output is disabled.

Do not store raw prompt, raw model output, API keys, tokens, headers, option text, or full item text while observing this.

## 10G Decision Hold

10G targeted regeneration is designed but should not start immediately after this release only because the design exists.

Start 10G when real partial usage shows that teachers need a faster way to close gaps, especially if they mostly restart the whole generation after seeing a partial result or complain that a partial paper cannot be printed/exported.

Until then, collect:

- first real partial production observation;
- teacher behavior after seeing gaps;
- whether whole-generation rerun is acceptable in practice;
- whether the disabled final output policy creates friction.

## Hygiene Notes

- `tmp/` is local generated material and should remain out of version control.
- `stash@{0}` contains old multi-file product-code changes and should not be dropped without explicit final discard confirmation.
- PR #3 should be closed because it is no longer the mainline path.
- `npm audit` should be treated as a separate hygiene check; do not run `npm audit fix` as part of this closure.
- GitHub Actions emitted a Node 20 deprecation warning during Pages deploy. It is non-blocking for this release, but the next CI maintenance pass should update the affected actions/runtime expectations.

## Conclusion

Partial-result MVP is deployed. The 50-item normal path passed production smoke, and the system is ready to observe the first real production partial result.
