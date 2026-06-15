# exam-wizard-next 配題表＋學力檢測題 工作紀錄

- 日期：2026/6/15
- 測試：npm test 52 passed（10 檔）、npm run check 通過、核心資料流 smoke 測試通過（44 題、總分 100、學力檢測題 4 題）

## 配題表（合併原 P7 題型比例＋P8 配分方案）
把第①步原本兩個文字欄改成一個「配題表」：每列用下拉選題型，後面填題數與每題配分，可新增/刪除列，即時顯示小計與合計，並檢查合計＝全卷總分。
- 新增 frontend/src/core/plan.js（normalizePlanRows、getPlanTotals、validatePlan、buildPlanSequences）+ tests/plan.test.js。
- 新增 frontend/src/core/questionTypes.js：各科常用題型清單，下拉依第①步「科目」自動帶出，可切換看其他科；每科尾端附「學力檢測題」。
- blueprint.js 序列模式改為沿用使用者選的題型（不再被正規化覆蓋）。
- app.js：renderPlanTable、buildBlueprint 改為單一配題表流程、新增 plan 欄位輸入與 add/remove 列、change 事件即時更新合計。
- state.js：移除 questionTypeMixInput/scorePlanInput，改為 planSubject 與 planRows（預設：選擇題20×2、是非題10×2、填充題10×2、學力檢測題4×5＝100 分、44 題）。

## 學力檢測題（情境素養題組）
- 題型清單加入「學力檢測題」。
- Worker 生成 prompt 新增指引：questionType 為學力檢測題時，以生活情境較長題幹＋2-3 個遞進子題命題，question 完整呈現情境與 (1)(2)(3) 子題、answer 逐一列出、該題配分視為整題總分。
- 參考依據：學力檢測/素養題＝生活情境、題組、評量探究與應用（非記憶）。

## 注意事項
- Windows→沙箱同步延遲：blueprint.js、scoring.js、blueprint.test.js 曾在沙箱端截斷，已用沙箱端重寫對齊；其餘 Edit 過的檔（app.js、state.js、worker/prompts.js）本機 Windows 正確、為上線來源。
- 本機檔案完整正確，52 tests 與 smoke 測試皆對齊本機內容跑過。
- 需 push 後 Actions 重佈前端；學力檢測題出題指引需重新部署 Worker 才生效。

## 建議 commit 訊息
- feat: unified question-plan table (type/count/score) with per-subject dropdowns
- feat: 學力檢測題 competency item-set generation
