# exam-wizard-next 架構說明

## 一句話

這不是大題產生器，而是：

```text
學習目標 → 目標配題 → 題目藍圖 → AI 正式草稿 → 單題重出 → 檢核 → 輸出
```

## Source of truth

新的 source of truth 是：

```text
state.objectives
state.objectivePlans
state.intents
state.items
```

不是：

```text
sections
candidatePool
```

## 主要資料物件

### Objective

```js
{
  objectiveId: "O-001",
  unitName: "觀察與推論",
  text: "能判讀天氣資料並說明天氣變化。",
  periodCount: 3
}
```

### ObjectivePlan

```js
{
  objectiveId: "O-001",
  targetItemCount: 12,
  targetScore: 24,
  locked: false,
  note: ""
}
```

### ItemIntent

```js
{
  intentId: "I-001",
  itemId: "Q-001",
  primaryObjectiveId: "O-001",
  objectiveIds: ["O-001"],
  themeBlockId: "觀察與推論",
  groupId: "",
  questionType: "選擇題",
  cognitiveLevel: "理解",
  difficulty: "medium",
  score: 2,
  generationHint: ""
}
```

### Item

```js
{
  itemId: "Q-001",
  groupId: "",
  questionType: "選擇題",
  cognitiveLevel: "理解",
  stimulus: "",
  question: "題幹",
  options: ["A", "B", "C", "D"],
  answer: "A",
  explanation: "解析",
  objectiveIds: ["O-001"],
  primaryObjectiveId: "O-001",
  secondaryObjectiveIds: [],
  score: 2,
  estimatedTimeSeconds: 60,
  difficulty: "medium",
  reviewFlags: []
}
```

### PaperSection

```js
{
  sectionId: "S-01",
  order: 1,
  title: "1. 觀察與推論",
  layoutMode: "themeBlock",
  itemIds: ["Q-001", "Q-002"]
}
```

`PaperSection` 只負責輸出版面，不負責配分。

## 配分規則

預設：

```text
總分 = 100
每題 = 2 分
總題數 = 50
```

程式規則：

```text
totalItemSlots = totalScore / itemScore
```

若無法整除，直接回傳錯誤。

## 單題重出規則

AI 重出只允許改：

```text
stimulus
question
options
answer
explanation
estimatedTimeSeconds
difficulty
reviewFlags
```

必須保留：

```text
itemId
groupId
questionType
score
objectiveIds
primaryObjectiveId
secondaryObjectiveIds
```

由 `frontend/src/core/replaceItem.js` 負責守門。

## 分層

```text
frontend/src/core/     純函式，不碰 DOM/fetch/window/localStorage
frontend/src/app.js    UI 與事件處理
frontend/src/apiClient.js API 呼叫
worker/src/            Gemini proxy 與 CORS
```
