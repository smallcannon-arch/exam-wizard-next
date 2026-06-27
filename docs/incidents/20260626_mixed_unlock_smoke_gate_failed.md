# 2026-06-26 mixed unlock production smoke gate failed incident

## Summary

10I-E-2 mixed unlock 已部署至 production，但 production smoke gate 未通過。UI allowlist 正常，choice-only、是非題、填充題小樣本通過；blocking issue 集中在學力檢測題／情境題組 payload contract failure，以及 mixed44 在 batch failed_terminal 後未依 partial policy 收斂。

因此 mixed 題型不可宣告 production 可用。已透過 hotfix PR #45 回復 choice-only stopgap。

## Timeline

- 10I-D 已 deploy：`26f839f`
- 10I-E-1 已 deploy：`9b06260`
- 10I-E-2 已 deploy：`a2406df`
- 10I-E-2 deploy run：`28217330585`
- smoke gate failed
- hotfix PR #45 merged
- hotfix deploy run：`28219384087`
- production headSha：`f6dbade`
- production 回到 choice-only stopgap

## Production smoke evidence

### Passed

- UI allowlist:
  - 題型下拉只顯示 `選擇題`、`是非題`、`填充題`、`學力檢測題`
  - 未顯示 `注音`、`改錯`、`應用題`、`圖表判讀題`
  - 預設仍是 `選擇題`
  - 題組入口：選擇 / 是非 / 填充 disabled，學力檢測題 enabled
  - 舊 stopgap 文案未出現
  - browser console 無 error

- choice50:
  - jobId: `gen_46ade76e-57cc-48d0-bbb1-8132cd47babc`
  - 50/50 completed
  - v2 validation pass
  - qualityMeta 50/50
  - leakage none
  - latency 306.61s

- trueFalse4:
  - jobId: `gen_06dc4ba6-cd21-43c6-9eff-aec32141a6f0`
  - 4/4 completed
  - v2 validation pass
  - latency 35.9s

- fillIn4:
  - jobId: `gen_97ecc796-bf00-4b61-8305-64d7027e5bf8`
  - 4/4 completed
  - v2 validation pass
  - latency 38.73s

### Failed / blocking

- literacyGroup4:
  - jobId: `gen_7845a3b5-e26b-43d7-b9d4-45f21d9b1597`
  - status: failed
  - error: `AI_ITEMS_PAYLOAD_INVALID`
  - finishReason: `STOP`
  - upstream: null

- mixed44:
  - jobId: `gen_61f6311f-4714-4ad5-a8a5-2ee4ab18d90d`
  - top-level status: still `running`
  - completed: 40/44
  - batch 11: `failed_terminal`
  - error: `AI_ITEMS_PAYLOAD_INVALID`
  - finishReason: `STOP`
  - `/result`: 409 `ASYNC_JOB_RESULT_UNAVAILABLE`

## Mitigation

- 採用方案 B hotfix
- PR #45: https://github.com/smallcannon-arch/exam-wizard-next/pull/45
- hotfix commit: `f6dbadef555db7f38c9e44dfc295ec79d5e2bd8e`
- deploy run: `28219384087`
- production flags:
  - `CHOICE_ONLY_STOPGAP_ENABLED = true`
  - `MIXED_TYPES_ENABLED = false`
- UI 題型下拉只剩 `選擇題`
- 題組 checkbox disabled
- stopgap 文案恢復
- choice-only smoke:
  - jobId: `gen_c66b5aa5-0160-49f7-ad33-1d5567714bd3`
  - completed 50/50
  - v2 validation pass
  - qualityMeta 50/50
  - leakage none
  - retry 0
  - finishReason `STOP x13`

## Root cause status

- root cause 尚未完成
- 已知至少有兩條調查線：
  1. 10I-F：學力檢測題／情境題組 payload contract failure
  2. 10I-G：async job finalization / partial 收斂 failure

## Decision

- mixed 題型不可宣告 production 可用
- 不再重新解鎖 mixed，直到：
  - 學力檢測題 payload contract regression 通過
  - mixed44 failed_terminal 能正確收斂成 partial 或 failed
  - 44 題 mixed regression 通過或合理 partial
  - preview / print / Word / Excel / partial guard 驗證通過

## Follow-up

- 10I-G：修 failed_terminal 後 top-level stuck running
- 10I-F：修 literacyGroup payload contract
- 後續才考慮 10J：questionType × subject × riskClass model routing
- 補 GitHub Actions reported checks 是 non-blocking follow-up
