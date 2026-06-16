function text(value, fallback = "未提供") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildGenerateItemsPrompt({ project = {}, materialText = "", objectives = [], intents = [] }) {
  const slots = (Array.isArray(intents) ? intents : []).map((slot) => ({
    itemId: slot.itemId,
    questionType: slot.questionType,
    score: slot.score,
  }));

  const isChinese = (project.subject === "國語");

  const promptParts = [
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
    "- 若 questionType 為「圖表判讀題」，請做成『選擇題形式』：先在 question 內以「文字表格」呈現一份資料（實驗記錄表、觀察統整表、數據或統計表；用對齊的文字表格），接著問一個判讀問題（讀值、比較、找規律或推論），並提供 options 共 4 個選項、answer 為單一正確選項。表格數據需合理、與教材概念相符。學生看到的就是一般選擇題。",
    "- 若 questionType 為「實驗探究題」，同樣做成『選擇題形式』：question 內先描述實驗情境（目的、做法、變因或記錄結果，可用文字表格），再問一個探究問題（變因控制、預測、推論或結論），提供 options 共 4 個選項、answer 為單一正確選項。",
    "- 上述圖表判讀題、實驗探究題都要有 options（4 個）與單一 answer，和選擇題一樣，不要做成需要寫長答案的開放題。",
    "- 若題目情境需要配合圖表或圖形（例如電路圖、植物構造圖、統計折線圖/圓餅圖、地理地圖或幾何圖形等），請一律在題目合適位置輸出「（請在此處補上圖片）」的提示字眼，以便使用者後續手動貼圖；表格（如實驗記錄表、數據表）則必須以文字表格完整生成，不得使用提示字眼替代。",
    "",
    "# 題組（情境素養題組）之特別規定",
    "若題位的 isGroup 為 true，你必須將其拆解成其 subCount 所指定數量的子題（例如 subCount 為 3，則拆解成 3 個子題）。每一題（子題）在輸出 JSON 的 items 陣列中作為一個獨立的物件。請嚴格遵守以下規定：",
    "  1. 這些子題必須共享相同的 `groupId`。例如對於題位 Q-041，其子題的 `groupId` 皆設為 `\"G-041\"`。",
    "  2. 各子題的 `itemId` 分別命名為 `\"{原 itemId}-1\"`, `\"{原 itemId}-2\"`, `\"{原 itemId}-3\"`（例如 `\"Q-041-1\"`, `\"Q-041-2\"`）。",
    "  3. 各子題必須是獨立的物件，具有自己的 `itemId`, `questionType` (沿用原題位的 questionType), `score` 等。",
    "  4. 所有子題的 `score`（配分）必須是正整數，且其總和必須等於原本該題位的設定分數（例如原本題位 Q-041 配分為 5 分，則子題可配為 2 分與 3 分）。",
    "  5. 組內的第一個子題（如 `\"Q-041-1\"`）必須填寫共同的 `stimulus`（情境引言 / 長文本段落），而其餘子題（如 `\"Q-041-2\"`）的 `stimulus` 則留空（`\"\"`）。",
    "  6. 每個子題的 `question` 欄位為該子題自身的提問（不要在提問前面加上 (1) 這種題號，純為提問文字）。",
    "  7. 每個子題有自己獨立的 `options`、`answer` 與 `explanation`（若是選擇題、是非題、實驗探究題、圖表判讀題或學力檢測題類型的子題，options 至少提供 4 個選項）。",
    ""
  ];

  if (isChinese) {
    promptParts.push(
      "# 國語科評量向度特別要求",
      "- 本考卷科目為國語，產出的每一題（包含一般題與學力檢測題的所有子題）皆必須新增 `chineseDimension` 欄位，其值必須為 `\"字詞短語\"`、`\"句式語法\"` 或 `\"段篇讀寫\"` 之一。",
      "- 設計國語科題目時，整卷三個評量向度的題目總配分比例要大致符合：",
      "  - 「字詞短語」占 30%~40%",
      "  - 「句式語法」占 20%~30%",
      "  - 「段篇讀寫」占 30%~50%",
      ""
    );
  }

  promptParts.push(
    "# 題目品質要求",
    "- 選項要有誘答力：誘答選項針對學生常見『迷思概念』或易混淆處設計，看似合理但其實錯誤；不要放明顯錯誤、無關或可一眼刪去的選項。",
    "- 答案不可一眼看出，難度適中且符合年級；正確選項不刻意最長或最短，選項長度相近。",
    "- 選擇題每題提供 4 個選項；正確答案在 A、B、C、D 間分布均勻，不要集中在某一個。",
    "- 是非題：敘述明確、可清楚判斷對錯，避免雙重否定或模稜兩可；is_true 概念請放在 answer（O 或 X）。",
    "- 填充與簡答：答案具體唯一或評分規準清楚；解析說明為什麼，並點出常見錯誤。",
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[...]}。items 的排列順序就是考卷的出題順序，請依編排原則排好。",
    `每題必須包含：itemId（沿用題位或子題題號）, questionType（沿用題位）, score（配分）, primaryObjectiveId, objectiveIds, cognitiveLevel, stimulus, question, options, answer, explanation${isChinese ? ", chineseDimension" : ""}。如果是學力檢測題的子題，必須包含 groupId，其他題型 groupId 填空字串即可。`
  );

  return promptParts.join("\n");
}

export function buildNormalizeObjectivesPrompt({ text: rawText = "" }) {
  return [
    "# 任務",
    "把以下使用者貼上的內容，整理成乾淨的學習目標清單，供命題系統使用。",
    "每個『具體學習指標』為一項；若原文有單元與節數，指標編號請用『單元-小節-序』（例如 4-3-1），並把各單元的節數合理分配到其指標（整數，總和等於該單元的節數）。",
    "不得新增原文沒有的指標或內容；不要輸出單元標題或『節數』之類的標籤本身，只輸出指標。",
    "",
    "# 原始內容",
    text(rawText, "（空）"),
    "",
    "# 輸出要求",
    "只輸出 JSON：{\"objectives\":[{\"text\":\"4-3-1 能…\",\"periodCount\":1}, ...]}。text 開頭盡量含指標編號；periodCount 為正整數。",
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
  const isChinese = (project.subject === "國語");

  const promptParts = [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "請針對原題重新設計同一題。不要只是改寫文字，應重新設計情境或提問方式。如果題目需要配合圖形，請在合適位置輸出「（請在此處補上圖片）」的提示字眼，以便使用者後續手動貼圖；表格部分請以文字表格生成。",
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
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[一題]}。"
  ];

  if (isChinese) {
    promptParts.push(
      "產出的題目必須包含 `chineseDimension` 欄位，其值必須為 `\"字詞短語\"`、`\"句式語法\"` 或 `\"段篇讀寫\"` 之一。"
    );
  }

  return promptParts.join("\n");
}
