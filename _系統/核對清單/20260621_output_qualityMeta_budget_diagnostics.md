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

## 任務 5C-3：以 4F 產物回算 output budget 分布結果

分析來源：

- `D:\User\Nhps\Documents\exam-wizard-ab\b4_vs_main_standard_fullpaper_outputs_20260621.json`
- `D:\User\Nhps\Documents\exam-wizard-ab\b4_vs_main_standard_fullpaper_summary_20260621.md`

repo 外分析產物：

- `D:\User\Nhps\Documents\exam-wizard-ab\output_budget_recalc_4f_20260621.json`
- `D:\User\Nhps\Documents\exam-wizard-ab\output_budget_recalc_4f_summary_20260621.md`
- `D:\User\Nhps\Documents\exam-wizard-ab\output_budget_recalc_4f_20260621.mjs`

核心結果：

| 指標 | 結果 | 判斷 |
|---|---:|---|
| B4 raw output 相對 main | +181.6% | deploy blocker 仍成立 |
| qualityMeta 占 raw output 增量 | 約 90.7% | 主要膨脹來源 |
| distractorDesign 占 qualityMeta | 約 51.0% | qualityMeta 內最大來源 |
| teacherExplanation 平均長度 | 58 字 | 已維持 compact |
| item-level 超 budget 題數 | 3 題 | 需 targeted compact |
| paperOverBudget | YES | 因超 budget 題數達 3 題 |

超 budget 題位：

| slotId | subject | 判斷 |
|---|---|---|
| G4_AB_MA_001 | 數學 | qualityMeta / distractorDesign 偏胖 |
| G4_AB_MA_002 | 數學 | qualityMeta / distractorDesign 偏胖 |
| G4_AB_MA_005 | 數學 | qualityMeta / distractorDesign 偏胖 |

warning code 統計：

| warning code | count | 說明 |
|---|---:|---|
| QUALITY_META_OVER_BUDGET | 3 | 集中於數學題 |
| SINGLE_DISTRACTOR_OVER_BUDGET | 2 | 單一誘答說明過長 |

判斷：

- B4 raw output 膨脹主要不是學生題目本體，而是 qualityMeta。
- qualityMeta 約占 raw output 增量的 90.7%，是 deploy blocker 的主要來源。
- qualityMeta 內部又以 distractorDesign 為最大來源，約占 qualityMeta 的 51.0%。
- teacherExplanation 平均 58 字，已符合 compact 方向，暫不列為下一刀優先目標。
- 超 budget 題目集中於數學題，表示下一步應做數學題 qualityMeta / distractorDesign targeted compact，而不是全面大改。
- 整卷 totalRawOutputLength 與 totalQualityMetaLength 未超 paper budget，但因超 budget 題數達 3 題，paperOverBudget 為 YES。
- 下一步建議先把 diagnostics 接入 repo 外 A/B 腳本，再做 5C-4 targeted compact。

後續建議順序：

1. 5C-3b：把 diagnostics 接入 repo 外 A/B 腳本。
2. 5C-4：數學題 qualityMeta / distractorDesign targeted compact。
3. 5C-5：針對 G4_AB_MA_001、G4_AB_MA_002、G4_AB_MA_005 做 compact 後回歸。
4. 5D：分批生成 POC。
5. 5B-impl：同步生成進度 UI MVP 可並行或後續接上。

## 任務 5C-4 targeted compact 設計

5C-3 的 output budget 回算顯示，B4 raw output 膨脹的主要來源是 `qualityMeta`，而 `distractorDesign` 約占 `qualityMeta` 的 51.0%。超 budget 題位集中在數學題，尤其是 `G4_AB_MA_001`、`G4_AB_MA_002`、`G4_AB_MA_005`，warning code 以 `QUALITY_META_OVER_BUDGET` 與 `SINGLE_DISTRACTOR_OVER_BUDGET` 為主。

本任務採取 targeted compact，而不是移除 `qualityMeta` 或 `distractorDesign`。調整方向只收斂數學題的 `qualityMeta / distractorDesign` 輸出契約：保留診斷價值，但要求 `correctReason`、`teacherExplanation`、每個錯誤選項的 `misconceptionDescription`、`whyStudentsMayChooseIt`、`whyItIsWrong`、`revisionNote` 都使用短句，並限制單一錯誤選項的 `distractorDesign` JSON 總長度不超過 220 字。

這次不改 schema、不改學生版資料結構、不改 diagnostics budget，也不重跑 4F fullpaper。下一步 5C-5 應針對 `G4_AB_MA_001`、`G4_AB_MA_002`、`G4_AB_MA_005` 做 compact 後回歸，確認 validation、qualityMeta、answer contract、distractorDesign key 均維持通過，且 `QUALITY_META_OVER_BUDGET` 與 `SINGLE_DISTRACTOR_OVER_BUDGET` 明顯下降或消失。

## 任務 5C-5：數學超 budget 題位 compact 後回歸結果

測試版本：

| 組別 | commit | 說明 |
| -- | -- | -- |
| B5 | 42eee52 | B4 + 數學 qualityMeta / distractorDesign targeted compact |

測試題位：

- G4_AB_MA_001
- G4_AB_MA_002
- G4_AB_MA_005

測試結果：

| 指標 | 結果 |
| -- | --: |
| 成功率 | 3/3 |
| JSON parse failure | 0 |
| validation failure | 0 |
| qualityMeta failure | 0 |
| answer contract failure | 0 |
| distractorDesign key failure | 0 |
| student leakage | 0 |

compact 前後比較：

| 指標 | B4 baseline | B5 | 變化 |
| -- | --: | --: | --: |
| qualityMetaLength 平均 | 1,453 | 1,346 | -7.4% |
| distractorDesignLength 平均 | 770 | 670 | -13.0% |
| rawOutputLength 平均 | 2,257 | 2,259 | +0.1% |
| SINGLE_DISTRACTOR_OVER_BUDGET | 2 | 0 | 改善 |
| QUALITY_META_OVER_BUDGET | 3 | 1 | 改善 |

判斷：

- 5C-4 targeted compact 對數學題 qualityMeta / distractorDesign warning 有效。
- SINGLE_DISTRACTOR_OVER_BUDGET 已由 2 題降為 0 題。
- QUALITY_META_OVER_BUDGET 已由 3 題降為 1 題。
- qualityMetaLength 平均下降 7.4%。
- distractorDesignLength 平均下降 13.0%。
- answer contract、distractorDesign key contract、validation、student leakage 均維持穩定。
- 但 rawOutputLength 幾乎持平，平均僅從 2,257 變為 2,259，約 +0.1%，沒有實質下降。
- 因此本輪可判定為 green pass，但 deploy blocker 仍需透過 B5 vs main 標準整卷重測確認。
- 暫不需要立刻進入 distractorDesign tiered detail / debug mode。
- 下一步可進入 B5 vs main 標準整卷重測。

repo 外產物：

- `D:\User\Nhps\Documents\exam-wizard-ab\math_compact_regression_outputs_20260621.json`
- `D:\User\Nhps\Documents\exam-wizard-ab\math_compact_regression_summary_20260621.md`
- `D:\User\Nhps\Documents\exam-wizard-ab\math_compact_regression_20260621.mjs`
