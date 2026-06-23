# Observation Baseline Summary - 2026-06-23

Status: 4 effective low-count samples and 1 effective 8-item sample collected.

This summary consolidates the first observation baseline set after the prompt-quality, generation-stabilization, progress UI, and Worker safe diagnostics work. It stores only summarized metrics and references the individual observation files. It does not include raw prompt, raw output, full API response, generated item text, API key, token, request headers, or cookies.

## Scope

| Item | Status |
|---|---|
| Environment | production Worker direct API |
| Pages deployment | not changed by this observation batch |
| Worker version scope | latest deployed Worker after safe diagnostics / qualityMeta gate |
| Samples included | Observation #001, #002, #003, #004, #005 |
| API call count in effective samples | 5 |
| Item count per low-count sample | 4 |
| Medium-count sample | Observation #005, 8 items |
| Raw output stored | no |
| Full generated item text stored | no |
| Cost data available | no, API response did not expose token usage |

## Samples

| Observation | Subject | Grade | Requested | Generated | Latency | Parse | v2 Validation | qualityMeta | Leakage | Effective |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| #001 | 國語 | 四年級 | 4 | 4 | 24.54s | PASS | PASS | 4/4 | none | yes |
| #002 | 數學 | 四年級 | 4 | 4 | 33.84s | PASS | PASS | 4/4 | none | yes |
| #003 | 自然 | 五年級 | 4 | 4 | 37.39s | PASS | PASS | 4/4 | none | yes |
| #004 | 社會 | 四年級 | 4 | 4 | 36.02s | PASS | PASS | 4/4 | none | yes |
| #005 | 數學 | 四年級 | 8 | 8 | 69.84s | PASS | PASS | 8/8 | none | yes |

## Failed / Non-effective Attempts

| Attempt | Summary | Decision |
|---|---|---|
| Observation #001 initial retry | 4/4 items returned but 4/4 missing `qualityMeta` because production Worker lagged behind `main`. | Not counted as effective baseline. Resolved by Worker deploy. |
| Observation #002 first attempt | HTTP 502 after 40.25s, 0/4 items. Most likely Worker-wrapped Gemini / response parsing class error. | Kept as failed audit trail, not counted as effective baseline. |

## Current Findings

1. Low-count generation is currently contract-stable across 國語, 數學, 自然, and 社會.
2. All four effective samples returned 4/4 generated items.
3. All four effective samples passed v2 validation.
4. All four effective samples returned `qualityMeta` for every item.
5. The first 8-item single-call sample also passed v2 validation and returned `qualityMeta` for every item.
6. No visible leakage was found in summarized response fields.
7. Token usage and direct estimated cost are still unavailable from the summarized response.
8. Latency for 4-item samples ranged from 24.54s to 37.39s.
9. The 8-item sample took 69.84s, which makes synchronous waiting noticeably long.
10. The first failed math attempt shows transient or format-related failure remains possible and should stay visible in future decisions.

## Latency Read

| Metric | Value |
|---|---:|
| Minimum effective sample latency | 24.54s |
| Maximum effective sample latency | 37.39s |
| Average effective sample latency | 32.95s |
| Highest observed failed latency | 40.25s |
| 8-item single-call latency | 69.84s |

Interpretation:

- Low-count synchronous generation remains usable, but the latency is already noticeable at 4 items.
- The 8-item sample succeeded but reached 69.84s, so larger synchronous generations are likely to create a poor waiting experience.
- The current evidence does not prove that 12-, 20-, or 30-item synchronous generation will feel acceptable.
- The progress UI remains important because even low-count samples can exceed 30 seconds.

## Risk Assessment

| Risk | Current Read | Decision Impact |
|---|---|---|
| Output contract failure | Low in effective samples; 4/4 v2 PASS | Continue staged baseline collection before large design changes. |
| `qualityMeta` missing | Resolved after Worker deployment; 4/4 effective samples have 4/4 present | Keep Worker qualityMeta gate deployed. |
| HTTP 502 / upstream failure | Still possible; one failed audit trail exists | Keep safe diagnostics and avoid treating one retry as full stability proof. |
| Latency | Medium to high; 24.54s to 37.39s for 4 items, 69.84s for 8 items | Strongly supports batching implementation design before larger samples. |
| Cost visibility | Unknown; token usage unavailable | Need metrics or manual cost tracking before cost optimization decisions. |
| Leakage | No visible summary-field leakage | Continue checking student projection separately when UI paths change. |

## 8D / 8E / Prompt Compression Recommendation

| Path | Recommendation | Reason |
|---|---|---|
| 8D batching design | Start implementation design, not production rollout | Four low-count samples and one 8-item sample show stable contracts, but latency is already high at 8 items. |
| Async job queue | Do not implement yet | Evidence is insufficient; current failures do not prove queue is required. |
| Prompt compression | Do not start broad compression yet | qualityMeta output is now stable; cost data remains unavailable. |
| Diagnostics improvement | Continue small, targeted improvements | Safe errorCode and qualityMeta gate are useful for future failed observations. |
| More observations | Optional but should be staged | Next sample should be owner-approved 12-item single-call or batching prototype validation, not a jump to 20/30 items. |

## Suggested Next Step

Proceed to an 8D frontend serial batching implementation design note, not production rollout.

The implementation design note should answer:

1. What problem batching would solve: latency, reliability, cost visibility, or user perception.
2. Which generation sizes should trigger batching.
3. Whether batching can preserve the current item contract and `qualityMeta` requirements.
4. How partial failures would be represented without leaking raw output.
5. Whether to run one 12-item single-call observation before coding, or proceed directly to a Draft batching PR.

## Data Boundary

This summary intentionally does not contain:

- raw prompt
- raw output
- full API response
- generated item text
- API key
- token
- request headers
- cookies

Only summarized metrics and decision guidance are recorded.
