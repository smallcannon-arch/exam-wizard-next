# exam-wizard-next P5–P8 工作紀錄

- 日期：2026/6/15
- 測試結果：npm test 44 passed（9 檔）、npm run check 通過

## P5 每題顯示對應學習目標編號
- 新增 frontend/src/core/auditRows.js（buildAuditRows）+ tests/auditRows.test.js。
- 修題卡片 item-meta 改為：題號｜題型｜配分｜對應目標｜層次。
- 檢核頁新增「逐題審核表」：題號／題型／配分／對應目標／認知層次。
- 教師卷每題標註【目標｜層次｜配分】。

## P6 AI 提取學習目標
- Worker：新增 /extract-objectives（index.js handler + 路由）、prompts.js buildExtractObjectivesPrompt、json.js assertObjectivesPayload。
- 前端：apiClient extractObjectivesViaApi；core/objectives.js（normalizeExtractedObjectives、objectivesToInputText）+ tests/objectives.test.js。
- 第②步新增「AI 從教材提取目標」按鈕，提取後填回目標欄供教師確認修改，再建立藍圖。
- 需先在第①步填教材內容才能提取。

## P7 全卷題型比例配置
- 新增 frontend/src/core/distribute.js（largestRemainder、interleaveByCounts、buildProportionalSequence）+ tests/distribute.test.js。
- blueprint.js 新增 parseQuestionTypeMix；buildItemIntents 支援 questionTypeSequence（不影響舊行為）。
- 第①步新增「題型比例」欄（例 選擇題:70, 填充題:20, 短答題:10），留空則維持原輪替。

## P8 自訂配分方案 scorePlan
- scoring.js 新增 parseScorePlan、getScorePlanTotals、validateScorePlan、buildScoreSequence、allocateUnitsByPeriod + tests/scorePlan.test.js。
- buildItemIntents 支援 scoreSequence。
- buildBlueprint 改為雙模式：填了配分方案就用自訂配分（需與總分相符），否則維持每題等分。
- 第①步新增「配分方案」欄（例 2分×35題, 3分×10題）。

## 注意事項
- 過程中 Windows→Linux 沙箱檔案同步有延遲，部分 Edit 過的檔在沙箱端一度截斷；
  已確認本機（Windows）檔案完整正確，測試是對齊本機內容跑過 44 passed。
- 新增端點 /extract-objectives 需重新部署 Worker 才會在線上生效。
- 前端 P5–P8 需 push 後由 GitHub Actions 自動重新部署 Pages。

## 建議 commit 訊息
- feat: show objective ids per item in editor/audit/teacher paper (P5)
- feat: AI extract learning objectives endpoint + step (P6)
- feat: whole-paper question-type ratio (P7)
- feat: custom score plan (P8)
