# Subject／Framework 分離：最小實作規格與影響盤點（唯讀分析）

- 日期：2026/6/17
- 依據：`docs/設計備忘v4_Subject與AbilityFramework分離_20260617.md`
- 性質：唯讀分析 + 實作計畫。**未修改任何程式碼**（本檔為新增文件）。
- 目標：國語由「預設評量向度模式」改為「預設教材目標模式」；向度模式進階選用；subject 只代表科目，frameworkId 決定能力框架與配分策略。

---

## 一、涉及檔案

| 檔案 | 角色 |
|------|------|
| `frontend/src/state.js` | project state；新增 `frameworkId` |
| `frontend/src/app.js` | 主要耦合點（配分分流、UI、藍圖、事件） |
| `frontend/src/core/periods.js` | `computeChineseDimensionScores`（僅向度模式） |
| `frontend/src/core/questionTypes.js` | `CHINESE_AUDIT_STRUCTURE`、`getChineseDimension(BySubcategory)`、`SUBJECT_OPTIONS`；建議放 framework 表 |
| `frontend/src/core/blueprint.js` | `distributeObjectivesToSlots`（**框架無關，維持不動**） |
| `frontend/src/core/excelGenerator.js`、`renderAuditTable.js` | 國語向度審核表／Excel（僅向度模式） |

---

## 二、現有耦合點（app.js，皆鎖在 `subject === "國語"`／`isChinese`）

### A. 屬於「向度模式」的耦合 → 應改由 framework 控制

1. **配分分流** `computeTargetScores`（L76、79、86）：`subject !== "國語"` 走節數；國語走 `computeChineseDimensionScores`。← **核心分流點**
2. **目標配分預覽** `renderObjectivePreview`（L100、114、143、145）：`isChinese` → 欄位顯「評量向度」而非「節數」。
3. **藍圖向度指派** `buildBlueprint`（L201–216）：國語時給每個 slot 設 `chineseDimension/chineseSubcategory`。
4. **細項勾選 UI** `renderStep2`（L742–743、981）→ `renderChineseSubcategoryChecklist`（L876–936）：42 細項勾選表 + 「載入已勾選」按鈕。
5. **向度配分表 + 每題位向度下拉** `renderStep3Or4`（L1015、1063–1073、1163–1167）。
6. **題位向度子編輯**（L1192–1216）。
7. **題目帶向度欄位** `generateItems`（L263、351–352）／`replaceItem`（L467、518–519）：item 帶 `chineseDimension/Subcategory`、送 `checkedChineseSubcategories`。
8. **事件處理**：build-blueprint 向度指派（L1821–1829）、slotField `chineseDimension`（L1865）、chinese-sub 勾選（L1881–1882）、itemField `chineseDimension`（L1895–1903）、`chinese-import-checked`（L1764）、`chinese-sub-default/all/none`（L1795–1803）、前往步驟時的假節數預設（L1727–1729）。
9. **審核頁** `renderAudit`（L1361）送 `checkedChineseSubcategories`；**向度統計表**（v3 已存在）。

### B. 屬於「科目」本身的耦合 → **維持鎖 subject，不要改成 framework**

- **列印版面**（L1374、1407–1408）：國語卷直式 A4、其他橫式。這是科目排版慣例，與能力框架無關 → 保持 `subject === "國語"`。
- **題型 PRESETS**（questionTypes.js）：國語題型清單屬科目特性 → 保持依 subject。
- **Gem 指引文字**（L952）：屬科目提示，可保持 subject。

> 關鍵原則：**不是每個 `=== "國語"` 都要改**。只有「向度邏輯」改由 framework 控制；科目排版、題型清單維持鎖 subject。

---

## 三、frameworkId 現況與最小新增

現況：**全專案無 frameworkId／framework 概念**（已 grep 確認）。

最小新增（不大改資料模型）：

1. `state.js`：`project` 加一欄 `frameworkId: ""`。
2. 新增純函式（建議放 `questionTypes.js` 或新檔 `core/frameworks.js`）：

```js
export const ASSESSMENT_FRAMEWORKS = {
  learning_objectives:     { label: "教材目標模式", weightStrategy: "lesson_hours",   usesChineseDimension: false },
  chinese_dimension_items: { label: "評量向度模式", weightStrategy: "dimension_ratio", usesChineseDimension: true }
};

// 未設定時一律預設「教材目標模式」（全科一致）
export function resolveFrameworkId(project = {}) {
  return project.frameworkId || "learning_objectives";
}
export function usesChineseDimension(project = {}) {
  return resolveFrameworkId(project) === "chinese_dimension_items";
}
```

此設計讓「國語預設教材目標」自動成立（`frameworkId` 空 → learning_objectives），向度模式只有在使用者明選時才開。

---

## 四、最小修改步驟（規劃，未執行）

1. **state.js**：`project.frameworkId: ""`。
2. **questionTypes.js / frameworks.js**：加上節三的 `ASSESSMENT_FRAMEWORKS` + 兩個 helper（純函式、可測）。
3. **computeTargetScores（核心）**：判斷由 `subject !== "國語"` 改為 `!usesChineseDimension(project)` → 走 `objectiveScoresByPeriod`；只有 `usesChineseDimension` 為真才走 `computeChineseDimensionScores`。
   - 建議順手把 `computeTargetScores(objectives, totalScore)` 改成可傳入 `project`/`frameworkId`，以利單元測試（目前直接讀全域 `state.project`，不易測）。
4. **第二節 A 區所有耦合**：把 `subject === "國語"`／`isChinese`（向度用途者）改判 `usesChineseDimension(state.project)`。包括：目標配分預覽欄位、細項勾選表渲染、向度配分表、每題位向度下拉、子題向度編輯、藍圖向度指派、items 向度欄位、相關事件處理、假節數預設。
5. **第二節 B 區**（列印版面、題型清單、Gem 文字）：**不動**，維持鎖 subject。
6. **教材目標模式**：不需新流程——`computeTargetScores` 落到節數路徑後，國語即與數/社/自共用 `目標＋節數 → distributeObjectivesToSlots → 生成`。
7. **Phase 5A**：完全不接入正式流程。

---

## 五、UI 最小改動

1. `renderStep1`（專案設定，subject 下拉在 L762）：當 `subject === "國語"` 時，於其下顯示模式單選，綁 `data-project="frameworkId"`：
   - ● 教材目標模式（值 `learning_objectives`，預設選取）
   - ○ 評量向度模式（值 `chinese_dimension_items`，標「進階」）
2. 非國語不顯示此選項（一律 learning_objectives）。
3. **模式切換處理**（對應 v4 §6）：`frameworkId` 改變時 → 清空 `intents`、`items`、`customTargetScores`（要求重新產生藍圖），但**保留** `objectiveInput`、`checkedChineseSubcategories`（不同框架輸入互不刪除）；顯示提示「已切換命題模式，請重新建立藍圖；原輸入保留但僅套用新模式解讀」。
4. 一般 UI 不出現特定人名；來源參照放說明。

---

## 六、測試清單

1. `resolveFrameworkId`：未設 → `learning_objectives`；設 `chinese_dimension_items` → 原值。
2. `usesChineseDimension`：國語未設 framework → false（教材目標）；設 chinese_dimension_items → true。
3. `computeTargetScores`（建議改為可傳 project/frameworkId 後測）：
   - 國語 + learning_objectives → 等同 `objectiveScoresByPeriod`（節數比例）。
   - 國語 + chinese_dimension_items → 走 `computeChineseDimensionScores`（向度比例）。
4. 自然／社會／數學（learning_objectives）→ 配分與現行一致，不受影響。
5. 切換 framework 後 `intents`／`items` 已清空，不沿用舊題位。
6. Phase 5A 未接入：正式產題流程不呼叫 compatibility helper。
7. （回歸）既有 `periods.test.js`、`blueprint.test.js`、`plan.test.js` 全綠不變。

---

## 七、風險與不做事項

**風險**
- `computeTargetScores` 目前直接讀全域 `state.project`，純函式測試需先小重構為傳參；屬低風險但要做。
- **預設行為改變**：國語預設不再是向度模式 → 既有「打開國語就看到向度表」的體感會變。屬刻意設計，但需在 release note 說明。
- `prompt.js` 第 119 行「依節數比例分配」在教材目標模式下其實**正確**；在向度模式才是殘留衝突。本次**不動 prompt**，留待後續。

**不做事項（硬邊界）**
- 不改 `distributeObjectivesToSlots`、AI prompt、worker。
- 不接 Phase 5A 相容表進正式流程。
- 不動列印版面與題型清單的 subject 判斷。
- 不大改資料模型（只加 `frameworkId` 一欄 + 一張 framework 表）。
- 不 commit／push／deploy。

---

## 八、git 狀態

本分析**未修改任何程式碼**，僅新增本文件與 v4 設計備忘。
`git status -sb` 須在你本機跑（沙箱 git 與真實 repo 不同步、不可信）；且先前「Phase 1 改動是否已 commit／npm test 92 或 93」的查證仍**未結清**——建議在開任何實作分支前，先跑 `git log --oneline -8`、`git status -sb`、`npm test` 對齊，再動工。

---

## 九、結論

最小改動的本質只有兩件事：

1. **加一個 `frameworkId`（預設 learning_objectives）+ 兩個 helper**。
2. **把第二節 A 區的向度耦合，從「鎖 subject」改成「問 framework」**；B 區維持鎖 subject。

教材目標模式不需新造流程（複用節數管線）；向度那套整包變成 `chinese_dimension_items` 分支，不重寫、不刪除。Phase 5A 維持外掛、不接正式流程。
