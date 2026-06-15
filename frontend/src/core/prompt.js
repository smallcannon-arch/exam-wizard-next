import { asText } from "./schema.js";

function jsonExampleFromIntents(intents) {
  return {
    items: intents.map((intent) => ({
      intentId: intent.intentId,
      itemId: intent.itemId,
      groupId: intent.groupId || "",
      questionType: intent.questionType,
      cognitiveLevel: intent.cognitiveLevel,
      stimulus: "",
      question: "題幹",
      options: intent.questionType === "選擇題" ? ["選項A", "選項B", "選項C", "選項D"] : [],
      answer: "標準答案",
      explanation: "解析",
      objectiveIds: intent.objectiveIds,
      primaryObjectiveId: intent.primaryObjectiveId,
      secondaryObjectiveIds: intent.secondaryObjectiveIds,
      score: intent.score,
      estimatedTimeSeconds: 60,
      difficulty: intent.difficulty,
      reviewFlags: [],
    })),
  };
}

export function buildGenerateItemsPrompt({ project = {}, materialText = "", objectives = [], intents = [] } = {}) {
  return [
    "# 角色",
    `你是臺灣國小${asText(project.grade, "未指定年級")}${asText(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "請依照題目藍圖產生正式試題草稿。每個 itemIntent 只產生一題，不要多產生備選題。",
    "所有題目必須符合國小學生程度，題意清楚，答案唯一或評分規準清楚。",
    "",
    "# 教材內容",
    asText(materialText, "未提供教材內容。請只依學習目標命題，不得自行假造課本專有內容。"),
    "",
    "# 學習目標",
    JSON.stringify(objectives, null, 2),
    "",
    "# 題目藍圖",
    JSON.stringify(intents, null, 2),
    "",
    "# 輸出要求",
    "請只輸出 JSON，不要 Markdown，不要解釋文字。",
    "JSON 格式如下：",
    JSON.stringify(jsonExampleFromIntents(intents), null, 2),
  ].join("\n");
}

export function buildRegenerateItemPrompt({ project = {}, materialText = "", objectives = [], originalItem, reason = "" } = {}) {
  return [
    "# 角色",
    `你是臺灣國小${asText(project.grade, "未指定年級")}${asText(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "請重新設計同一題。不要只是改寫原題文字，應重新設計情境、資料或提問方式。",
    "",
    "# 必須保留",
    `intentId：${originalItem?.intentId ?? ""}`,
    `itemId：${originalItem?.itemId}`,
    `questionType：${originalItem?.questionType}`,
    `score：${originalItem?.score}`,
    `objectiveIds：${JSON.stringify(originalItem?.objectiveIds ?? [])}`,
    `groupId：${JSON.stringify(originalItem?.groupId ?? "")}`,
    "",
    "# 教材內容",
    asText(materialText, "未提供。"),
    "",
    "# 對應學習目標",
    JSON.stringify(objectives, null, 2),
    "",
    "# 教師重出理由",
    asText(reason, "請重出一題更清楚、符合年級程度的題目。"),
    "",
    "# 原題 JSON",
    JSON.stringify(originalItem, null, 2),
    "",
    "# 輸出要求",
    "請只輸出 JSON，不要 Markdown。格式為 {\"items\":[一題]}。",
  ].join("\n");
}
