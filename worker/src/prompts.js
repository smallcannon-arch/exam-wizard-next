function text(value, fallback = "未提供") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildGenerateItemsPrompt({ project = {}, materialText = "", objectives = [], intents = [] }) {
  return [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "請依題目藍圖產生正式試題草稿。每個 intent 只產生一題，不要產生備選題。",
    "題目需符合國小學生程度，答案與解析需正確。",
    "",
    "# 教材內容",
    text(materialText, "未提供教材內容。請只依學習目標命題，不得假造課本專有內容。"),
    "",
    "# 學習目標 JSON",
    JSON.stringify(objectives, null, 2),
    "",
    "# 題目藍圖 JSON",
    JSON.stringify(intents, null, 2),
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[...]}。",
    "每題必須包含：itemId, groupId, questionType, cognitiveLevel, stimulus, question, options, answer, explanation, objectiveIds, primaryObjectiveId, secondaryObjectiveIds, score, estimatedTimeSeconds, difficulty, reviewFlags。",
  ].join("\n");
}

export function buildRegenerateItemPrompt({ project = {}, materialText = "", objectives = [], originalItem, reason = "" }) {
  return [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "請針對原題重新設計同一題。不要只是改寫文字，應重新設計情境或提問方式。",
    "",
    "# 必須保留",
    `itemId：${originalItem.itemId}`,
    `groupId：${originalItem.groupId || ""}`,
    `questionType：${originalItem.questionType}`,
    `score：${originalItem.score}`,
    `objectiveIds：${JSON.stringify(originalItem.objectiveIds || [])}`,
    "",
    "# 教材內容",
    text(materialText, "未提供。"),
    "",
    "# 對應學習目標 JSON",
    JSON.stringify(objectives, null, 2),
    "",
    "# 教師重出理由",
    text(reason, "請重出一題更清楚、符合年級程度的題目。"),
    "",
    "# 原題 JSON",
    JSON.stringify(originalItem, null, 2),
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[一題]}。",
  ].join("\n");
}
