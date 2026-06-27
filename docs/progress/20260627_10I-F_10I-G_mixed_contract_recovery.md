# 2026-06-27 10I-F / 10I-G mixed contract recovery progress

## Summary

10I-E-2 mixed unlock 曾於 production smoke gate 失敗，原因分為兩個 blocking issue：

1. 10I-G：batch failed_terminal 後 top-level job 無法收斂成 partial。
2. 10I-F：學力檢測題／情境題組 parent group slot 與 child generated items expected count contract mismatch。

目前兩者均已修復並在 production Worker / D1 驗證通過。10I-H mixed unlock retry 也已部署至 production，並通過 full smoke gate。

## 10I-G completed

- D1 schema 已允許 `generation_jobs.status = partial`。
- D1 migration `0005` 已套用。
- `failed_terminal` 可正確收斂成 `partial`。
- `/result` 對 `partial` 回 200。
- targeted partial verification 通過。
- production stopgap 仍維持。

## 10I-F completed

- 最新 main：`53a2d1a`
- Worker Version ID：`8810bb7a-32f3-45c7-bef0-d1153ab6b0f3`
- `/health`：HTTP 200，`{"ok":true,"service":"exam-wizard-next-proxy"}`
- stopgap flags：
  - `CHOICE_ONLY_STOPGAP_ENABLED = true`
  - `MIXED_TYPES_ENABLED = false`

## Production observations

### choice-only 50

- jobId：`gen_53ba2848-5907-4511-a653-6e378b7c1ccd`
- requested / completed：50 / 50
- terminal status：`completed`
- `/result`：200
- latency：294.8s
- v2 validation：pass
- qualityMeta：50/50
- leakage：none
- contract violation：none observed
- retry：0
- finishReason：STOP x13

### literacy-group4-ui-shape

- jobId：`gen_f403f78d-9645-4d17-ab12-c2e4e1f1dc33`
- parentSlotCount：4
- expectedItemCount：8
- completedItemCount：8
- terminal status：`completed`
- `/result`：200
- missing slots：none
- v2 validation：pass
- qualityMeta：8/8
- leakage：none
- contract violation：none observed
- `AI_ITEMS_PAYLOAD_INVALID`：not observed
- retry：0
- finishReason：STOP x1

### mixed44-ui-shape

- jobId：`gen_0caa11e3-6270-4bed-bda7-d57a33664a2e`
- parentSlotCount：44
- expectedItemCount：48
- completedItemCount：48
- 題型分布：20 選擇題、10 是非題、10 填充題、4 學力檢測題 parent slots
- terminal status：`completed`
- `/result`：200
- missing slots：none
- failed batches：none
- v2 validation：pass
- qualityMeta：48/48
- leakage：none
- contract violation：none observed
- `AI_ITEMS_PAYLOAD_INVALID`：not observed
- `ITEMS_COUNT_MISMATCH`：not observed
- stuck running：not observed
- retry：0
- finishReason：STOP x11

## 10I-H Production Deploy + Full Smoke Gate PASS

### Deploy

- Workflow：Deploy frontend to GitHub Pages
- Run ID：28278398853
- Run URL：https://github.com/smallcannon-arch/exam-wizard-next/actions/runs/28278398853
- Commit：`5ab82e8be6523335b2221ad027d82c28d6a68fe9`
- Conclusion：success
- Production URL：https://smallcannon-arch.github.io/exam-wizard-next/
- Deployment completed at：2026-06-27T04:20:32Z
- `/health`：HTTP 200，`{"ok":true,"service":"exam-wizard-next-proxy"}`

### Smoke Gate Result

Status：PASS

- Production loads：PASS
  - Chrome headless rendered production page title：命題系統
- Supported dropdown types：PASS
  - 選擇題
  - 是非題
  - 填充題
  - 學力檢測題
- Legacy unsupported hidden：PASS
  - 注音
  - 改錯
  - 應用題
  - 圖表判讀題
  - 短答題
- Choice generation：PASS
  - jobId：`gen_3e4ca9b7-8b8d-429e-bb69-191735a9f447`
  - 1/1 completed
  - `/result` 200
  - v2 pass
- True/false generation：PASS
  - jobId：`gen_450e4b87-f547-4559-82f9-833e24d07c5b`
  - 1/1 completed
  - `/result` 200
  - v2 pass
- Fill-in generation：PASS
  - jobId：`gen_57040077-37f1-440a-a2de-7272d5b91e29`
  - 1/1 completed
  - `/result` 200
  - v2 pass
- Academic detection generation：PASS
  - jobId：`gen_928827d2-e344-4596-b543-f78cfa2fd3c8`
  - 1/1 completed
  - `/result` 200
  - v2 pass
- Mixed generation：PASS
  - jobId：`gen_15998872-326f-49f5-b7af-3132858b2d89`
  - 4/4 completed
  - generated composition exactly 1 each：
    - 選擇題
    - 是非題
    - 填充題
    - 學力檢測題
- No console/runtime errors：PASS
  - CDP found no `console.error` and no runtime exceptions
  - only non-blocking `favicon.ico` 404
- No diagnostics leak：PASS
  - DOM and generated-result safe checks found no `errorCode`, `AI_ITEMS_PAYLOAD_INVALID`, `ITEMS_COUNT_MISMATCH`, or `AI_OUTPUT_CONTRACT_INVALID` exposed

### Production Declaration

Mixed production can be declared open on commit `5ab82e8`.

exam-wizard-next 已完成 10I-H mixed unlock retry，並於 production 通過 full smoke gate。系統目前正式支援選擇題、是非題、填充題、學力檢測題，以及四題型混合生成。legacy unsupported 題型仍未開放，diagnostics 未外洩，production smoke gate 通過。

### Notes

- `npm test` passed：33 files / 410 tests
- `npm run check` passed
- HEAD and origin/main both remain `5ab82e8be6523335b2221ad027d82c28d6a68fe9`
- Non-blocking follow-up：production requests `/favicon.ico` and receives 404；not blocking app runtime or generation

## Current status

- No 10I-F blocking issue.
- No 10I-G blocking issue.
- 10I-H full smoke gate：PASS。
- mixed production is open on commit `5ab82e8`.
- legacy unsupported 題型仍未開放。

## Next phase

- 持續監控 production mixed 題型生成。
- 另案處理 non-blocking `/favicon.ico` 404。
