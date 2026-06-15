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
    "# 特殊題型：學力檢測題",
    "若某題的 questionType 為「學力檢測題」，請以情境素養題組命題：先給一段生活化、可較長的情境題幹，再於同一題內設計 2 至 3 個由淺入深的子題，評量理解、分析與應用，避免純記憶。",
    "此時 question 欄位需完整呈現情境與各子題（子題以 (1)(2)(3) 標示）；answer 欄位需逐一列出各子題答案；該題配分視為整題總分。",
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
    "每題必須沿用題目藍圖的 intentId（例如 I-001）作為對照鍵，並沿用同一筆藍圖的 itemId（例如 Q-001）作為卷面題號；兩者都必須原樣回傳，不得自行重新編號。",
    "每題必須包含：intentId, itemId, groupId, questionType, cognitiveLevel, stimulus, question, options, answer, explanation, objectiveIds, primaryObjectiveId, secondaryObjectiveIds, score, estimatedTimeSeconds, difficulty, reviewFlags。",
  ].join("\n");
}

export function buildExtractObjectivesPrompt({ project = {}, materialText = "" }) {
  return [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}課程設計協助者。`,
    "",
    "# 任務",
    "請從教材內容萃取可評量的學習目標。每個目標需具體、可命題、對應一個重點概念。",
    "目標數量依教材內容多寡判斷，一般 3 到 8 個。不得自行假造教材沒有的內容。",
    "",
    "# 教材內容",
    text(materialText, "未提供教材內容。"),
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"objectives\":[...]}。",
    "每個目標必須包含：unitName（單元名稱）, lessonName（課名，可為空字串）, text（目標敘述）, periodCount（建議節數，正整數）。",
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
    `intentId：${originalItem.intentId || ""}`,
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
