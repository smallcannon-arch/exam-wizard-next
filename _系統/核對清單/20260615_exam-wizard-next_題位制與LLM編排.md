# exam-wizard-next 題位制與 LLM 整卷編排 工作紀錄

- 日期：2026/6/15
- 測試：npm test 63 passed（12 檔）、npm run check 通過、整卷流程 smoke 測試通過

## 版面與建卷（前一批）
- 七步驟導覽改為單列（CSS flex nowrap）。
- 建卷只留科目、年級；評量名稱與總分刪除——總分由配題表合計自動決定，卷名自動帶（年級+科目+評量）。
- 第②步加入 Gem 超連結與使用說明；貼回的目標支援「目標文字｜節數」多行或 Gem 的 JSON（含中文鍵）穩健解析。
- 節數比例作為配分依據；「每題配分」改「每題(答)配分」；首頁標題改正式發布版樣式。

## 題位制：藍圖只鎖題型/配分，其餘交 LLM 編排
依使用者決策「題型/配分固定，目標與排序交 LLM」：
- blueprint 新增 buildItemSlots：只產生 itemId/題型/配分的「題位」，不預先綁定學習目標。
- buildBlueprint 改為：產生題位 + 依節數比例算出各目標的「配分占比目標值」（占總時數%與目標配分約值），不再預先固定每題目標。
- ③/④ 頁顯示：各目標節數/占比/目標配分(約) + 題型配分分布 + 題位清單。

## 生成 prompt 改為整卷編排
Worker buildGenerateItemsPrompt 改寫：題位的 itemId/題型/配分固定不可動；LLM 為每題指派 primaryObjectiveId 與 cognitiveLevel，使各目標總配分貼近其節數比例、覆蓋所有目標、整卷由易到難、相關題相鄰、避免重複；items 順序即出題順序。學力檢測題仍以情境題組（含子題）出。

## 放寬生成後檢核
- 新增 core/validateGeneratedPaper.js + 測試：以 itemId 對題位、題型/配分需相符、每題目標需有效、所有目標需被覆蓋、題數與總分一致。
- 前端改用此檢核；生成後以 AI 回傳順序作為卷面順序（單一 section）。

## 待上線
- 前端：git push（Actions 自動重佈）。
- Worker：必須 npx wrangler deploy（生成 prompt、學力檢測題、節數抽取等都在 Worker，須重佈才生效）。

## 注意
- Windows→沙箱同步延遲持續：blueprint.js、plan.js、objectives.js 等核心檔以沙箱端重寫對齊；本機 Windows 檔完整正確，63 tests 與 smoke 皆對齊本機內容跑過。
