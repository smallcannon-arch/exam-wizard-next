# 10I-F / 10I-G Recovery Verified

## Summary

10I-F / 10I-G recovery 已在 stopgap-on production 驗證通過。production 仍維持 choice-only stopgap，mixed 題型尚未重新開放給老師。

## 原始失敗

- 10I-E-2 deploy commit: `a2406df`
- UI allowlist 曾通過。
- choice-only、是非、填充小樣本曾通過。
- `literacyGroup4` failed:
  - jobId: `gen_7845a3b5-e26b-43d7-b9d4-45f21d9b1597`
  - error: `AI_ITEMS_PAYLOAD_INVALID`
- `mixed44` stuck:
  - jobId: `gen_61f6311f-4714-4ad5-a8a5-2ee4ab18d90d`
  - completed: 40/44
  - batch `failed_terminal`
  - top-level stuck `running`
  - `/result`: 409

## Mitigation

- PR #45 hotfix.
- production 回到 choice-only stopgap。
- `CHOICE_ONLY_STOPGAP_ENABLED = true`
- `MIXED_TYPES_ENABLED = false`

## 10I-G 修復

- root cause:
  - D1 schema 不允許 `generation_jobs.status = partial`。
- 修復:
  - PR #46
  - migration `0005_allow_partial_generation_job_status.sql`
  - D1 schema 已允許 `partial`。
- production verification:
  - targeted jobId: `gen_06ab7112-0b1c-4505-ba35-2fa345d38118`
  - requested: 24
  - completed: 20/24
  - batch `failed_terminal`
  - top-level status: `partial`
  - `/result`: 200
  - missing slots: 21-24

## 10I-F 修復

- root cause:
  - production UI group parent slots 與 Worker expected item count contract 不一致。
  - 4 parent group slots x subCount 2 應 `expectedItemCount = 8`，但原 Worker expected 4。
- 修復:
  - PR #48
  - group slot expansion helper
  - child-aware expected item count
  - child-aware payload validation
  - child-aware partial missing slots
- contract:
  - 一般題: 1 parent slot -> 1 expected item
  - 題組: 1 parent group slot + subCount=N -> N child expected items

## Production observation after recovery

### Deploy

- Worker version ID: `9d155852-4927-47de-b395-d2df646f70db`
- Pages deploy run: `28236853390`
- Pages headSha: `719d6c56b6a139b019e4755197ee4a1db1b523c2`
- `/health`: HTTP 200, `{"ok":true,"service":"exam-wizard-next-proxy"}`

### Stopgap

- `CHOICE_ONLY_STOPGAP_ENABLED = true`
- `MIXED_TYPES_ENABLED = false`
- `getQuestionTypeOptions()` 回傳 `["選擇題"]`
- mixed production 入口未開放。

### Observations

- choice-only 50:
  - jobId: `gen_6f9fb361-2a23-41c4-bfc1-24294c402326`
  - 50/50 completed
  - v2 pass
  - qualityMeta 50/50
  - leakage none
  - retry 0
  - finishReason `STOP x13`
  - latency 270.12s

- literacy group small sample:
  - jobId: `gen_f4458be3-abce-4b99-bf93-d8bbe7d2655c`
  - parentSlotCount 4
  - expectedItemCount 8
  - completed 8/8
  - v2 pass
  - qualityMeta 8/8
  - leakage none

- mixed44 real UI shape:
  - jobId: `gen_58c58a3f-91bf-48f1-870d-754b743089e1`
  - parentSlotCount 44
  - expectedItemCount 48
  - groupChildCount 8
  - completed 48/48
  - `/result` 200
  - v2 pass
  - qualityMeta 48/48
  - leakage none
  - retry 0

## Decision

- 10I-F / 10I-G recovery 已通過 stopgap-on production observation。
- mixed production 尚未重新開放。
- 不應直接宣告 mixed 題型正式可用。
- 下一步應進入 deliberately gated mixed unlock retry readiness pass。

## Remaining work

- real browser UI smoke 尚未完整跑，因 repo 目前沒有 Playwright dependency。
- full export smoke 仍需在 unlock retry 前或 deploy gate 中完成:
  - preview
  - print
  - Word
  - Excel
  - partial guard
- prompt group stimulus wording 有 non-blocking follow-up:
  - 建議後續收斂為單一規則。
- GitHub reported checks 仍無，長期應補 CI。
