# 設計備忘 v4：Subject 與 Ability Framework 分離

- 日期：2026/6/17
- 用途：修正「科目 subject」與「能力框架 framework」混用問題，讓命題系統從國語向度命題器升級為全科公用命題系統
- 狀態：架構草案，待實作前拍板
- 前置脈絡：v3 已確立題位中心模型、國語向度配分、Phase 5A 相容性約束表；本 v4 補上 subject 與 framework 分離原則

---

## 〇、核心規格

> **科目 subject 不直接決定能力框架；能力框架 framework 才決定配分策略、能力資料結構、相容性檢查與審題規則。**

國語科不應預設綁定評量向度細項。國語可以像其他科目一樣使用「教材目標模式」，也可以由進階使用者選擇「評量向度模式」。

因此系統不應寫成：

```js
subject === "chinese" → chinese_dimension_items
```

而應寫成：

```js
{ subject: "chinese", frameworkId: "learning_objectives" }
// 或
{ subject: "chinese", frameworkId: "chinese_dimension_items" }
```

---

## 一、模式拍板：國語預設為「教材目標模式」

| 模式 | frameworkId | 配分策略 | 適合情境 |
|------|-------------|----------|----------|
| 教材目標模式 | `learning_objectives` | 學習目標＋節數比例 | 一般段考、依課本單元命題、低門檻使用 |
| 評量向度模式 | `chinese_dimension_items` | 國語向度比例＋細項 | 進階審題、雙向細目表、向度均衡檢核 |

拍板：**國語預設採教材目標模式；評量向度模式作為進階選用。**

理由：
1. 一般教師較直覺使用「課本單元／學習目標／節數」命題。
2. 降低國語科使用門檻，不讓向度細項成為每位教師的必經流程。
3. Phase 5A 相容表尚未進入正式流程前，國語仍可穩定使用教材目標模式產卷。
4. 系統定位為專業導航，不強制教師採用特定國語審題框架。

---

## 二、現有國語向度程式碼的定位

目前已完成的國語向度相關程式**不刪除、不重寫**，收編為 `frameworkId === "chinese_dimension_items"` 時才啟用的進階分支，包含：

- `computeTargetScores` 中的國語向度比例分流
- `computeChineseDimensionScores`
- 國語向度比例配分、向度配分表
- 國語細項勾選
- Phase 5A 相容性約束表

這些不是一般國語科的預設流程，而是「評量向度模式」的實作。

---

## 三、教材目標模式複用全科既有管線

國語教材目標模式不另造新流程，直接複用數學／社會／自然等科已驗證管線：

```
學習目標＋節數
  → 依節數比例分配 targetScore
  → distributeObjectivesToSlots
  → 產生題位
  → AI 依題位生成
```

此模式下：不使用國語向度比例、不使用 `chinese_dimension_items`、不啟用 Phase 5A 相容表、不強制顯示「字詞短語／句式語法／段篇讀寫」；題型先由教師規劃，系統依目標與配分鋪題位。

---

## 四、Assessment Profile 結構

由原本的 `Subject Profile` 升級為 `Assessment Profile`：

```js
const profile = getAssessmentProfile({ subject, frameworkId });
```

```js
// 國語教材目標模式（預設）
{ subject: "chinese", frameworkId: "learning_objectives",
  label: "教材目標模式", weightStrategy: "lesson_hours",
  compatibilityStrategy: "teacher_review", isDefault: true }

// 國語評量向度模式（進階）
{ subject: "chinese", frameworkId: "chinese_dimension_items",
  label: "評量向度模式", weightStrategy: "dimension_ratio",
  compatibilityStrategy: "chinese_ability_compatibility", isAdvanced: true }

// 自然教材目標模式
{ subject: "science", frameworkId: "learning_objectives",
  label: "教材目標模式", weightStrategy: "lesson_hours",
  compatibilityStrategy: "none" }
```

---

## 五、Slot primaryAbility schema

題位仍是單一真相來源，但 `primaryAbility` 必須帶 `frameworkId`，且 schema 可依 framework 變形。

```js
// 教材目標模式
primaryAbility: {
  frameworkId: "learning_objectives",
  abilityId: "3-1-2",
  label: "透過實驗操作變因，了解鐵生鏽的主因是水、空氣"
}

// 國語評量向度模式
primaryAbility: {
  frameworkId: "chinese_dimension_items",
  abilityId: "提取訊息",
  label: "提取訊息",
  dimension: "段篇讀寫"
}
```

原則：
- `dimension` 只在需要向度統計的 framework 出現。
- 不得為了統一 schema 而把 `dimension` 硬塞進所有能力。
- 下游統計、渲染、相容性檢查，一律先看 `frameworkId` 再決定套用邏輯。
- Phase 5A 只在 `frameworkId === "chinese_dimension_items"` 時啟用。

---

## 六、模式切換時的資料處理

老師可能在國語科切換「教材目標模式 ↔ 評量向度模式」。為避免資料污染：

1. 切換模式時，不直接刪除原輸入。
2. 系統保留各 framework 的輸入狀態。
3. 畫面只套用目前 framework 的資料與解讀方式。
4. 切換時顯示提示：「你正在切換命題模式。系統會保留原模式已輸入的資料，但目前只會使用新模式的學習目標／能力框架進行配分與生成。」
5. 若已有題位或生成結果，切換 framework 後應要求**重新產生藍圖**，不沿用舊題位。
6. 不同 framework 之間**不做自動轉換**（不把「提取訊息」自動轉成課本學習目標，反之亦然）。

理由：不同 framework 的能力單位不同，自動轉換易造成假對應。寧可保留資料、要求重新生成，也不默默混用。

---

## 七、UI 呈現建議

國語科選擇後，顯示模式選項：

```
請選擇國語命題模式：
● 教材目標模式　依課本學習目標與節數配分，適合一般段考。
○ 評量向度模式　依國語評量向度比例檢核，適合進階審題與雙向細目表。
```

原則：預設勾「教材目標模式」；「評量向度模式」標進階；一般 UI 不使用特定人名；來源參照與校本審題依據放說明文件或進階說明，不在主流程干擾老師。

---

## 八、Phase 5A 的新定位

Phase 5A 不廢除，定位調整為「`frameworkId === "chinese_dimension_items"` 時啟用的相容性守門員」。

| subject | frameworkId | 啟用 Phase 5A |
|---------|-------------|--------------|
| chinese | learning_objectives | 否 |
| chinese | chinese_dimension_items | 是 |
| science / social / math | learning_objectives | 否 |
| custom | custom_framework | 視設定 |

Phase 5A 只檢查「ability + carrierType + responseType 是否相容」；不負責整卷如何配到 100 分，也不負責教材目標模式的題型配置。

---

## 九、落地順序修正

```
1. Subject / Framework 分離
2. 國語教材目標模式設為預設
3. 國語教材目標模式複用既有目標＋節數管線
4. 評量向度模式標為進階
5. Phase 5A 僅掛在 chinese_dimension_items framework
6. 後續再進 Phase 5B：向度模式的 targetScore → slot allocator
```

讓國語基本功能不被 Phase 5 卡住。

---

## 十、拍板結論

> 國語科預設採教材目標模式，與數學、社會、自然共用「學習目標＋節數」管線；評量向度模式作為進階選用，才啟用向度比例與 Phase 5A 相容性約束表。Subject 只代表科目，framework 才決定能力架構、配分策略與相容性檢查。現有國語向度程式碼收編為 `chinese_dimension_items` framework 分支，不重寫、不刪除。

---

## 後續討論焦點

不再卡在「國語要不要綁向度」，轉為更實際的問題：**怎麼用最小改動，把現有國語向度邏輯包成進階 framework 分支，並讓教材目標模式成為預設。**
