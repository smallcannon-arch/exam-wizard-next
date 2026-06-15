function text(value, fallback = "未提供") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildGenerateItemsPrompt({ project = {}, materialText = "", objectives = [], intents = [] }) {
  const slots = (Array.isArray(intents) ? intents : []).map((slot) => ({
    itemId: slot.itemId,
    questionType: slot.questionType,
    score: slot.score,
  }));

  return [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "我已決定整卷的「題位」：每個題位的題型與配分固定，不可更動。請為每個題位命題，並自行決定每題對應哪一個學習目標與認知層次，讓整份考卷有良好的整體性。",
    "題目需符合國小學生程度，答案與解析需正確。每個題位只出一題，不要備選題。",
    "",
    "# 學習目標（含節數）JSON",
    "請依各目標的 periodCount（節數）占總教學時數的比例，分配各目標在整卷的配分占比：節數多的目標，對應到較多題與較高總分。務必涵蓋所有目標，不可遺漏。",
    JSON.stringify(objectives, null, 2),
    "",
    "# 題位 JSON（itemId、questionType、score 請原樣保留，不可更動）",
    JSON.stringify(slots, null, 2),
    "",
    "# 教材重點（課本／習作摘要）",
    "以下是課本與習作的重點摘要（可能含國語的生字、語詞、句型、課文重點，或其他科的核心概念與重要詞彙）。命題請盡量依此實際內容出題（例如國語就用課本的生字與句型命題），不得假造課本沒有的專有名詞或內容。",
    text(materialText, "未提供教材重點。請只依學習目標命題，不得假造課本專有內容。"),
    "",
    "# 編排原則（整卷整體性）",
    "- 每題指派一個 primaryObjectiveId（必填，須為上方學習目標的 objectiveId）；如有次要目標可放入 objectiveIds。",
    "- 每題標註 cognitiveLevel（記憶／理解／應用／分析／評鑑／創造）。",
    "- 讓各學習目標的「總配分」盡量貼近其節數比例；所有目標都要有題目。",
    "- 請依題型分「大題」排列：相同 questionType 的題目放在一起（例如所有選擇題相鄰、所有填充題相鄰、所有學力檢測題相鄰），不要把同題型打散。",
    "- 同一大題（同題型）內由易到難；避免題意重複或互相暗示答案。",
    "- 若 questionType 為「學力檢測題」，以生活情境較長題幹＋2 至 3 個遞進子題命題；question 完整呈現情境與 (1)(2)(3) 子題，answer 逐一列出各子題答案，該題配分為整題總分。",
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[...]}。items 的排列順序就是考卷的出題順序，請依編排原則排好。",
    "每題必須包含：itemId（沿用題位）, questionType（沿用題位）, score（沿用題位）, primaryObjectiveId, objectiveIds, cognitiveLevel, stimulus, question, options, answer, explanation。",
  ].join("\n");
}

export function buildExtractObjectivesPrompt({ project = {}, materialText = "", hasFiles = false }) {
  return [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}課程設計協助者。`,
    "",
    "# 任務",
    hasFiles
      ? "請閱讀我隨附的教材檔案（可能多份 PDF），萃取可評量的學習目標。每個目標需具體、可命題、對應一個重點概念。"
      : "請從教材內容萃取可評量的學習目標。每個目標需具體、可命題、對應一個重點概念。",
    "目標數量依教材內容多寡判斷，一般 3 到 8 個。不得自行假造教材沒有的內容。",
    "",
    "# 節數（重要）",
    "請依教材分量，為每個目標估算建議教學節數 periodCount（正整數）。",
    "節數會用來計算各目標占總教學時數的比例，作為配分依據（節數多的目標分配到較多題與較高分），務必合理填寫。",
    "",
    "# 教材內容",
    hasFiles ? "（見隨附檔案）" : text(materialText, "未提供教材內容。"),
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
