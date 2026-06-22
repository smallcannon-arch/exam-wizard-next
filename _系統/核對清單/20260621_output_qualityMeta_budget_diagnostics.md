# Output / qualityMeta Budget Diagnostics

- 日期：2026/6/21
- 分支：`codex/generation-stabilization-20260621`
- 任務：5C
- 性質：診斷工具與規格紀錄。此任務建立 budget diagnostics，不改 prompt、不重跑生成、不把超 budget 升級為 hard fail。

## 1. 背景

B4 已通過標準整卷 structure gate：

- 標準整卷 12/12 成功。
- 國語 6/6，數學 6/6。
- JSON parse failure、validation failure、answer contract failure、distractorDesign key failure、qualityMeta failure、student leakage 皆為 0。

但 B4 deploy gate 尚未通過：

- B4 totalDuration 相對 main 增加 26.4%。
- B4 raw output 相對 main 增加 181.6%。

因此下一步需要能穩定追蹤 output / qualityMeta 膨脹來源，而不是盲目刪除品質欄位。5C 新增 `frontend/src/core/outputDiagnostics.js`，用於計算 item-level 與 paper-level 長度，並以 warning code 標記超 budget 狀態。

## 2. Diagnostics 欄位定義

| 欄位 | 層級 | 說明 | 是否 hard fail |
|---|---|---|---|
| rawOutputLength | item | 該題或該題對應 raw output 字串長度 | 否 |
| studentItemLength | item | 學生版投影 JSON 長度 | 否 |
| qualityMetaLength | item | `qualityMeta` JSON 長度 | 否 |
| distractorDesignLength | item | `qualityMeta.distractorDesign` JSON 長度 | 否 |
| teacherExplanationLength | item | `qualityMeta.teacherExplanation` 字串長度 | 否 |
| correctReasonLength | item | `qualityMeta.correctReason` 字串長度 | 否 |
| maxSingleDistractorLength | item | 單一錯誤選項診斷資料最大 JSON 長度 | 否 |
| overBudget | item | 任一 item-level budget warning 是否存在 | 否 |
| budgetWarnings | item / paper | 超 budget warning code 清單 | 否 |
| itemCount | paper | 納入統計的題數 | 否 |
| totalRawOutputLength | paper | 全卷 raw output 長度總和 | 否 |
| averageRawOutputLength | paper | 平均每題 raw output 長度 | 否 |
| totalStudentItemLength | paper | 全卷學生版投影長度總和 | 否 |
| averageStudentItemLength | paper | 平均每題學生版投影長度 | 否 |
| totalQualityMetaLength | paper | 全卷 `qualityMeta` 長度總和 | 否 |
| averageQualityMetaLength | paper | 平均每題 `qualityMeta` 長度 | 否 |
| totalDistractorDesignLength | paper | 全卷誘答設計長度總和 | 否 |
| averageDistractorDesignLength | paper | 平均每題誘答設計長度 | 否 |
| totalTeacherExplanationLength | paper | 全卷教師說明長度總和 | 否 |
| averageTeacherExplanationLength | paper | 平均每題教師說明長度 | 否 |
| overBudgetItemCount | paper | 超過任一 item-level budget 的題數 | 否 |
| overBudgetItems | paper | 超 budget 題目 id 清單 | 否 |
| paperOverBudget | paper | 任一 paper-level budget warning 是否存在 | 否 |

## 3. Budget 初始值

| budget | 初始值 | 用途 | 備註 |
|---|---:|---|---|
| rawOutputLength | 3200 | 單題 raw output 長度診斷 | 目前只 warning |
| studentItemLength | 900 | 單題學生版投影長度診斷 | 避免題幹 / 選項 / 解析過長 |
| qualityMetaLength | 1400 | 單題 `qualityMeta` 長度診斷 | B4 主要膨脹來源 |
| distractorDesignLength | 900 | 單題誘答設計總長度診斷 | 用於抓出過長迷思說明 |
| teacherExplanationLength | 80 | 教師說明字數診斷 | 預設不 hard fail |
| correctReasonLength | 80 | 正答理由字數診斷 | 預設不 hard fail |
| perDistractorLength | 260 | 單一誘答診斷長度診斷 | 防止單一選項說明膨脹 |
| paperRawOutputLengthPerItem | 3200 | 整卷 raw output 平均預算 | 以題數乘上預算 |
| paperQualityMetaLengthPerItem | 1400 | 整卷 `qualityMeta` 平均預算 | 以題數乘上預算 |

這些初始值來自 4F 後的 deploy blocker 觀察，先作為 diagnostics budget。後續若要升級為 hard gate，需另開任務，並先確認不會傷害題目品質。

## 4. Warning Code 定義

| warning code | 觸發條件 | 層級 | 後續用途 |
|---|---|---|---|
| RAW_OUTPUT_OVER_BUDGET | `rawOutputLength` 超過 budget | item | 找出單題 raw output 膨脹 |
| STUDENT_ITEM_OVER_BUDGET | `studentItemLength` 超過 budget | item | 找出學生版內容過長 |
| QUALITY_META_OVER_BUDGET | `qualityMetaLength` 超過 budget | item | 找出品質中繼資料過長 |
| DISTRACTOR_DESIGN_OVER_BUDGET | `distractorDesignLength` 超過 budget | item | 找出誘答設計過長 |
| TEACHER_EXPLANATION_OVER_BUDGET | `teacherExplanationLength` 超過 budget | item | 找出教師說明過長 |
| CORRECT_REASON_OVER_BUDGET | `correctReasonLength` 超過 budget | item | 找出正答理由過長 |
| SINGLE_DISTRACTOR_OVER_BUDGET | 單一 distractor JSON 長度超過 budget | item | 找出單一錯誤選項診斷過長 |
| PAPER_RAW_OUTPUT_OVER_BUDGET | 全卷 raw output 超過 `paperRawOutputLengthPerItem * itemCount` | paper | 判斷整卷 output / cost 風險 |
| PAPER_QUALITY_META_OVER_BUDGET | 全卷 `qualityMeta` 超過 `paperQualityMetaLengthPerItem * itemCount` | paper | 判斷整卷品質資料膨脹 |
| TOO_MANY_OVER_BUDGET_ITEMS | 至少 2 題 item-level overBudget | paper | 判斷問題是否非單題偶發 |

## 5. Leakage 邊界

Diagnostics 僅供內部流程、測試、repo 外 A/B 腳本或教師 / debug 用資料使用。

邊界要求：

- diagnostics 不進學生版。
- diagnostics 不包含 raw prompt。
- diagnostics 不包含 API key / token / request header / cookie。
- diagnostics 不包含完整 raw output，除非 repo 外測試腳本自行記錄。
- repo 內不 commit raw output。
- 學生版仍只透過 `toStudentItem` 投影，不包含 `qualityMeta`、`distractorDesign`、`teacherExplanation`、`selfCheck` 或 diagnostics。

5C 僅新增 helper 與 tests，尚未把 diagnostics 接入前端 UI 或正式生成結果。

## 6. 實作摘要

新增：

- `frontend/src/core/outputDiagnostics.js`
- `tests/outputDiagnostics.test.js`

主要 API：

```js
createItemOutputDiagnostics({
  rawOutput,
  normalizedItem,
  studentItem,
  budget
});

createPaperOutputDiagnostics(itemDiagnostics, { budget });
```

設計原則：

- 欄位不存在時長度為 0，不 throw。
- `distractorDesign` 不是 object 時不 throw。
- 字串長度先用 `.length`，不做 tokenization。
- 物件長度用穩定 JSON stringify。
- 超 budget 只產生 warnings，不阻擋 validate / import。

## 7. 後續任務

### 5C-2：把 diagnostics 接入 repo 外 A/B 腳本

目標：

- 在 repo 外生成測試腳本中使用 `createItemOutputDiagnostics` 與 `createPaperOutputDiagnostics`。
- 讓後續 B/C 組比較能直接輸出 budget warnings。

### 5C-3：以 4F 產物回算 budget 分布

目標：

- 使用 `D:\User\Nhps\Documents\exam-wizard-ab\b4_vs_main_standard_fullpaper_outputs_20260621.json` 回算各題 diagnostics。
- 找出哪些題目、哪些欄位最常超 budget。
- 作為 5D 分批生成 POC 與 prompt / qualityMeta 壓縮決策依據。

### 5D：分批生成 POC 使用 diagnostics 判斷每批成本

目標：

- 每批記錄 raw output、student item、qualityMeta 與 distractorDesign 長度。
- 判斷 batch size 是否降低單次 output 風險。

### 5B-impl：進度 UI 顯示非敏感 diagnostics summary

目標：

- 若未來需要，可在教師 / debug 模式顯示不敏感 summary，例如「本次生成內容較長」。
- 不顯示 raw prompt、raw output 或內部 API 資訊。

## 8. 驗收狀態

5C 驗收應包含：

- `npm test`
- `npm run check`
- `node --check frontend/src/core/outputDiagnostics.js`
- `node --check frontend/src/core/normalizeItem.js`
- `node --check frontend/src/core/validateGeneratedPaper.js`
- `node --check frontend/src/core/schema.js`
- `node --check frontend/src/core/itemViews.js`
- `node --check worker/src/prompts.js`

5C 完成後，建議先做 5C-3 回算 4F 產物，再進 5D 分批生成 POC。不要直接做完整非同步 job queue。
