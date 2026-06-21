import {
  FEWSHOT_EXAMPLES,
  renderFewShotExamples,
  selectFewShotExamples,
} from "./fewshotExamples.js";

function text(value, fallback = "未提供") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSubject(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["國語", "國語文", "chinese", "語文"].includes(normalized)) return "國語";
  if (["數學", "math", "mathematics"].includes(normalized)) return "數學";
  return "";
}

const QUESTION_TYPE_GUIDELINES = `
# 各題型命題規範與品質要求

為了使產出的試題能直接作為正式國小考卷使用，請針對每題所要求的 questionType 嚴格遵守以下命題規範：

## 1. 選擇題
- 必須提供 4 個選項（A、B、C、D）。
- 誘答選項（干擾項）應根據學生常見的「迷思概念」或容易混淆的概念來設計，看似合理但其實錯誤。避免放入一眼就能排除、不合理或無關的選項，不可使用「以上皆是」、「以上皆非」或「以上皆錯」。
- 選項長度應儘量一致，語法結構對稱，正確選項不刻意最長或最短。
- 正確答案（A、B、C、D）應平均分佈。

## 2. 是非題
- 敘述必須明確、判斷依據單一。避免使用雙重否定、模稜兩可的語詞（如「可能」、「大概」、「有時候」）。
- 答案限制為單一字元，僅能是 "O"（代表對）或 "X"（代表錯）。

## 3. 填充題
- 空格位置應明確，使用「（　　）」或「_______」標註。
- 所挖的空必須是關鍵名詞、核心概念或重要詞彙，避免挖在無意義的連接詞或虛字上。
- 答案應具體且唯一，解析需寫明完整正確詞彙與給分標準。

## 4. 連連看 / 配合題
- 題目內必須清楚列出左方選項與右方選項，例如：
  「請將左邊的氣候類型與右邊的特徵連起來：
  左方：(A) 熱帶雨林氣候  (B) 溫帶季風氣候
  右方：(1) 全年高溫多雨  (2) 四季分明，夏季多雨」
- 提供明確的配對答案與解析。

## 5. 簡答題 / 問答題
- 提問應具體，明確限制回答的範圍或格式（例如：「請列出兩個主要原因」、「限 30 字以內回答」）。
- 在解析（explanation）中，必須提供明確的評分指引、給分標準（如答對一點得幾分）與參考範例答案。

## 6. 計算題
- 提供數值運算題目，計算難度需符合年級程度。
- 解析（explanation）中必須列出完整的計算步驟、直式/橫式推導過程與最終正確數值。

## 7. 應用題
- 結合日常生活情境或具體的科學/社會情境。
- 題意敘述流暢、資訊充足且無歧義。
- 答案必須包含正確數值與單位，解析中須寫出關係式與完整的步驟。

## 8. 作圖題
- 指導語應明確，告知學生需畫出何種幾何圖形、輔助線或統計圖表。
- 題目必須在適當處輸出「（請在此處補上圖片）」字樣，供教師編輯時貼圖或讓學生作答。

## 9. 實驗探究題
- 必須以「選擇題形式」呈現：question 內先描述實驗情境（如目的、方法、操縱/控制/應變變因，可用對齊的文字表格呈現數據），再問一個探究問題（如變因控制、結果推論或實驗結論）。
- 必須提供 4 個選項（A、B、C、D）且 answer 只有一個。不要做成開放性答題。

## 10. 圖表判讀題
- 必須以「選擇題形式」呈現：question 內以 Markdown 文字表格完整生成數據、實驗記錄或統計資料，問判讀/分析/比較問題。
- 必須提供 4 個選項（A、B、C、D）且 answer 只有一個。表格中數據必須符合常理。

## 11. 學力檢測題
- 參考臺灣國家教育研究院 TASA（學力檢測）或縣市學力追蹤檢測之題型。
- 題目應為生活素養情境題，考查學生跨概念的整合能力與高階思考。
- 通常為 4 選項的選擇題，選項干擾項需極具診斷性。

## 12. 國字 / 注音 / 改錯 (國語科專屬)
- 國字：句子中挖空，空格內標示注音，要求學生寫出國字（例如：「妹妹的（ㄌㄧㄢˇ）上露出笑容。」）。
- 注音：句子中標示國字，要求寫出注音（例如：「這本書的內容很豐（富）。」）。
- 改錯：句子中故意安排 1-2 個錯別字，要求學生找出並改正（例如：「他做錯事卻不承認，真是執迷不物。」應改為「悟」）。

## 13. 照樣造句 / 造句 / 重組 (國語科專屬)
- 照樣造句：給出例句並用中括號或標註標示結構，要求照樣仿寫。
- 造句：提供指定字詞或關聯詞，要求造出完整句子。
- 重組：提供打亂順序的詞語片段與序號，要求重組成通順句子。

## 14. 短文寫作 (國語科專屬)
- 提供明確的寫作題目與情境引導，限制字數，並在解析中附上評分規準。

## 15. 閱讀測驗 (國語、社會、自然科)
- **核心架構**：包含一段「閱讀文本」（stimulus）與後續提問。
- **題組模式（isGroup 為 true）**：
  - 組內第一題的 \`stimulus\` 必須包含完整的「閱讀文本」，字數與難度需符合該年級段（低年級 100-200 字，中年級 200-300 字，高年級 300-400 字）。其餘子題的 \`stimulus\` 留空。
  - 閱讀文本必須是根據該科目、單元高度相關的主題所原創或改編之文章：
    - 國語科：文學故事、寓言、童詩、說明文等，文字優美，可融入教材生字語詞。
    - 社會科：歷史故事、時事報導、社會現象描述、地方文史介紹、公民參與對話。
    - 自然科：科普短文、科學家探索故事、生態觀察紀錄、科學原理趣味應用。
  - 後續提問的子題（數量由 subCount 決定）應針對該閱讀文本進行提問，且提問應分佈在不同的認知層次（如國語科：提取訊息、推論訊息、整合詮釋、比較評估；其他科：事實確認、因果推理、主旨理解等）。
  - **所有子題預設皆為 4 選項選擇題形式**，提供 options、單一 answer、explanation。
- **單題模式（isGroup 為 false）**：
  - 若該題為單一題目，其 \`stimulus\` 欄位仍須提供一段較短的閱讀文本（約 100-200 字），\`question\` 對該文本進行提問，並提供 4 個 options、單一 answer、explanation。
`;

const QUESTION_TYPE_SECTION_DEFS = {
  choice: "## 1. 選擇題",
  trueFalse: "## 2. 是非題",
  fill: "## 3. 填充題",
  matching: "## 4. 連連看 / 配合題",
  shortAnswer: "## 5. 簡答題 / 問答題",
  calculation: "## 6. 計算題",
  application: "## 7. 應用題",
  drawing: "## 8. 作圖題",
  experiment: "## 9. 實驗探究題",
  chart: "## 10. 圖表判讀題",
  proficiency: "## 11. 學力檢測題",
  chineseWords: "## 12. 國字 / 注音 / 改錯 (國語科專屬)",
  sentence: "## 13. 照樣造句 / 造句 / 重組 (國語科專屬)",
  writing: "## 14. 短文寫作 (國語科專屬)",
  reading: "## 15. 閱讀測驗 (國語、社會、自然科)",
};

const QUESTION_TYPE_HEADER = QUESTION_TYPE_GUIDELINES.slice(
  0,
  QUESTION_TYPE_GUIDELINES.indexOf(QUESTION_TYPE_SECTION_DEFS.choice)
).trimEnd();

function normalizeQuestionType(questionType = "", itemType = "", subject = "") {
  const source = [questionType, itemType].filter(Boolean).join(" ").toLowerCase();
  const normalizedSubject = normalizeSubject(subject);
  const keys = new Set();

  if (!source.trim()) return [];

  if (source.includes("閱讀") || source.includes("read")) keys.add("reading");
  if (source.includes("標點") || source.includes("對話標點") || source.includes("句式") || source.includes("語句") || source.includes("關聯詞") || source.includes("sentence")) {
    keys.add("sentence");
    keys.add("choice");
  }
  if (source.includes("國字") || source.includes("注音") || source.includes("改錯")) keys.add("chineseWords");
  if (source.includes("照樣造句") || source.includes("造句") || source.includes("重組")) keys.add("sentence");
  if (source.includes("短文") || source.includes("寫作")) keys.add("writing");
  if (source.includes("圖表") || source.includes("判讀") || source.includes("統計") || source.includes("長條圖") || source.includes("chart")) keys.add("chart");
  if (source.includes("實驗") || source.includes("探究") || source.includes("experiment")) keys.add("experiment");
  if (source.includes("學力") || source.includes("tasa") || source.includes("proficiency")) keys.add("proficiency");
  if (source.includes("作圖") || source.includes("圖形") || source.includes("幾何") || source.includes("面積") || source.includes("角度") || source.includes("旋轉") || source.includes("geometry")) keys.add("drawing");
  if (source.includes("計算")) keys.add("calculation");
  if (source.includes("應用") || source.includes("情境") || source.includes("列式") || source.includes("兩步驟") || source.includes("word_problem")) {
    keys.add("application");
    if (normalizedSubject === "數學") keys.add("calculation");
  }
  if (source.includes("是非") || source.includes("true_false")) keys.add("trueFalse");
  if (source.includes("填充")) keys.add("fill");
  if (source.includes("連連看") || source.includes("配合")) keys.add("matching");
  if (source.includes("簡答") || source.includes("問答")) keys.add("shortAnswer");
  if (source.includes("選擇") || source.includes("single_choice") || source.includes("choice")) keys.add("choice");

  return [...keys];
}

function getQuestionTypeSection(sectionKey) {
  const heading = QUESTION_TYPE_SECTION_DEFS[sectionKey];
  if (!heading) return "";
  const start = QUESTION_TYPE_GUIDELINES.indexOf(heading);
  if (start === -1) return "";

  const nextStarts = Object.values(QUESTION_TYPE_SECTION_DEFS)
    .map((candidateHeading) => QUESTION_TYPE_GUIDELINES.indexOf(candidateHeading))
    .filter((index) => index > start);
  const end = nextStarts.length ? Math.min(...nextStarts) : QUESTION_TYPE_GUIDELINES.length;
  return QUESTION_TYPE_GUIDELINES.slice(start, end).trimEnd();
}

function getQuestionTypeKeysForIntents(intents = [], subject = "") {
  const list = Array.isArray(intents) ? intents : [];
  if (list.length === 0) return null;

  const selectedKeys = [];
  for (const slot of list) {
    const keys = normalizeQuestionType(slot?.questionType, slot?.itemType, subject);
    if (keys.length === 0) return null;
    selectedKeys.push(...keys);
  }

  return [...new Set(selectedKeys)];
}

function getQuestionTypeGuidelines(intents = [], subject = "") {
  const uniqueKeys = getQuestionTypeKeysForIntents(intents, subject);
  if (!uniqueKeys) return QUESTION_TYPE_GUIDELINES;

  const sections = uniqueKeys.map(getQuestionTypeSection).filter(Boolean);
  if (sections.length === 0) return QUESTION_TYPE_GUIDELINES;

  return [QUESTION_TYPE_HEADER, ...sections].join("\n\n");
}

const QUALITY_DESIGN_GUIDELINES = `
# 優良題感與 few-shot 使用規則

- 可參考公開學力檢測題本與試題品質分析報告來萃取題感、評量架構、誘答設計與常見迷思類型，但不得大量照抄公開題目，也不得把公開題本當成直接複製來源。
- 若系統提供 few-shot 優良題範例，請學習範例旁的標註說明，而不是模仿表面主題、句型或選項形式。重點是理解：題幹如何聚焦單一能力、題目如何對應 primaryObjectiveId 與 cognitiveLevel、錯誤選項如何打到常見迷思、解析如何拆解正答與誤答。
- few-shot 範例應依本次科目、年級、題型、primaryObjectiveId 與 cognitiveLevel 動態載入；若未提供人工審核範例，不得臨時自造 few-shot 範例，只能依本提示詞的題感規則與迷思標籤命題。
- 每次最多參考 2 至 4 題 few-shot 範例。若提示詞長度過長，優先保留與本次題位最接近、具完整迷思標註、具逐項解析，或含「弱誘答改寫成強誘答」對比的範例。
`;

const DISTRACTOR_DESIGN_BASE_GUIDELINES = `
# 錯誤選項與迷思標籤規格

- 每一道選擇題形式的題目（選擇題、圖表判讀題、實驗探究題、學力檢測題、閱讀測驗子題）都必須只有一個明確正確答案。
- 若系統目前固定為四選項，仍應產生 A、B、C、D 四個選項；不得改成三選項。
- 每個錯誤選項都必須對應學生可能真的會犯的錯誤，不得只是荒謬、無關、語氣奇怪或明顯不合理的選項。
- 錯誤選項與正答在語氣、長度、形式上應保持平衡，不可讓正答因最完整、最長或最正式而突出。
- 若某個錯誤選項無法填出合理 misconceptionTag，代表該選項不合格，必須重寫該選項。
- 不使用「以上皆是」「以上皆非」「以上皆錯」作為選項，除非題型明確要求。
- 正確答案位置需分散，避免整卷偏向同一個選項。

常見迷思標籤可包含但不限於：
`;

const CHINESE_MISCONCEPTION_TAGS = "- 國語文：keyword_trap（關鍵詞直覺誘答）, partial_reading（局部閱讀）, stem_neglect（未看清題幹要求）, referent_confusion（指稱不清）, structure_confusion（文章結構混淆）, main_idea_confusion（主旨與細節混淆）, synonym_gap（同義轉換不穩）, life_experience_override（生活經驗覆蓋文本）。";
const MATH_MISCONCEPTION_TAGS = "- 數學：formula_transfer_error（公式誤套）, concept_inversion（概念反向）, unit_conversion_error（單位換算錯誤）, time_duration_confusion（時刻與時間量混淆）, single_feature_error（單一特徵判斷）, absolute_difference_error（相差概念錯誤）, category_as_instance_error（類別與特例混淆）, unknown_position_error（未知數位置混淆）。";

const DISTRACTOR_DESIGN_GUIDELINES = [
  DISTRACTOR_DESIGN_BASE_GUIDELINES.trimEnd(),
  CHINESE_MISCONCEPTION_TAGS,
  MATH_MISCONCEPTION_TAGS,
].join("\n");

function getDistractorDesignGuidelines(subject) {
  const normalizedSubject = normalizeSubject(subject);
  if (normalizedSubject === "國語") {
    return [DISTRACTOR_DESIGN_BASE_GUIDELINES.trimEnd(), CHINESE_MISCONCEPTION_TAGS].join("\n");
  }
  if (normalizedSubject === "數學") {
    return [DISTRACTOR_DESIGN_BASE_GUIDELINES.trimEnd(), MATH_MISCONCEPTION_TAGS].join("\n");
  }
  return DISTRACTOR_DESIGN_GUIDELINES;
}

const CHINESE_SUBCATEGORY_GROUPS = Object.freeze({
  "字詞短語": ["正確字音", "近音字", "多音字", "變音字", "確認字形", "筆畫筆順", "分辨部首", "部件組合", "造字原則", "書法字體", "書法故事", "字詞釋義", "近義字詞", "反義字詞", "類詞應用"],
  "句式語法": ["句意理解", "文句組成", "句型辨識", "句式變化", "標點符號", "句群關係", "四字詞語", "結構詞語", "常用修辭"],
  "段篇讀寫": ["提取訊息", "推論訊息", "整合詮釋", "比較評估", "閱讀技巧", "預測推論", "摘要整合", "推估主旨", "辨識文類", "詳略閱讀", "文體應用", "語文工具", "句子變化", "看圖寫作", "限制習寫", "主題習寫", "感想心得", "寫作技巧"],
});

function getChineseSubcategoryLines(checkedChineseSubcategories = []) {
  const checked = Array.isArray(checkedChineseSubcategories)
    ? checkedChineseSubcategories.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];

  return Object.entries(CHINESE_SUBCATEGORY_GROUPS)
    .map(([dimension, subcategories]) => {
      const scoped = checked.length > 0
        ? subcategories.filter((subcategory) => checked.includes(subcategory))
        : subcategories;
      if (scoped.length === 0) return "";
      return `  - 「${dimension}」向度細項：${scoped.map((subcategory) => `"${subcategory}"`).join(", ")}`;
    })
    .filter(Boolean);
}

const INTERNAL_OUTPUT_GUIDELINES = `
# 命題輸出 v2：單一 canonical item + qualityMeta

- 不要輸出 internalVersion 與 studentVersion 兩份完整題目資料；只輸出一份 canonical item。
- question、options、answer、explanation、primaryObjectiveId 等核心欄位是學生版可見資料。explanation 是給學生看的簡明解析，應只說明學生需要知道的解題理由。
- 每題都必須新增 qualityMeta 作為教師／審題／系統內部資料。學生版會由系統自動隱藏 qualityMeta。
- qualityMeta 必須包含：schemaVersion（固定為 "item-quality-meta/v1"）, abilityFocus, correctReason, distractorDesign, teacherExplanation, selfCheck。
- subject, grade, unit, cognitiveLevel, difficulty, itemType 屬於可由系統或題目資料補回的 metadata；若你已能從題位明確得知可輸出，但不要為了填滿欄位而重複長文或自行編造。
- qualityMeta.correctReason 用來精簡說明正答為何正確；qualityMeta.teacherExplanation 用來給教師／審題者看，請用一句話摘要本題能力重點、誘答設計與審題注意。
- qualityMeta.teacherExplanation 是必填欄位，不得省略；即使已有 explanation 與 qualityMeta.correctReason，也必須另行填寫 qualityMeta.teacherExplanation。
- 選擇題形式題目的 qualityMeta.distractorDesign 必須是以錯誤選項代號為 key 的物件，不得是陣列；請只為錯誤選項填寫。每個錯誤選項至少包含 misconceptionTag, misconceptionDescription, whyStudentsMayChooseIt, whyItIsWrong, revisionNote。正答選項不可放入 distractorDesign。
- qualityMeta.selfCheck 必須包含 singleCorrectAnswer, matchesPrimaryObjectiveId, matchesCognitiveLevel, allDistractorsHaveMisconceptionTags, noObviousGiveaway, gradeAppropriate, noUnnecessaryDifficulty。
- 不要把 teacherExplanation、selfCheck 或誘答設計註記寫進 question、options 或 explanation。
`;

const JSON_OUTPUT_STABILITY_GUIDELINES = `
# JSON 輸出穩定性規則

- 你必須只輸出一個合法 JSON 物件，不得輸出 Markdown、程式碼區塊、前言、後記、註解或任何 JSON 外文字。
- 所有 JSON 字串欄位都必須是單行字串，不得在字串內直接換行。
- 若字串內容需要表示引號，請使用中文引號「」或單引號，不得在字串內使用未跳脫的英文雙引號。
- qualityMeta.distractorDesign 必須是以錯誤選項代號為 key 的物件，不得是陣列。
- 正確格式範例："distractorDesign": { "A": { "misconceptionTag": "partial_reading", "whyItIsWrong": "此選項只符合局部資訊。", "revisionNote": "保留此誘答。" }, "C": { ... }, "D": { ... } }。
- 禁止格式範例："distractorDesign": [ { "option": "A", "misconceptionTag": "partial_reading" } ]。
- qualityMeta.distractorDesign 中每個錯誤選項物件都必須包含 misconceptionTag, misconceptionDescription, whyStudentsMayChooseIt, whyItIsWrong, revisionNote。
- 每一個 JSON 欄位之間都必須以逗號分隔，不得省略逗號，特別是 whyItIsWrong 與 revisionNote 之間。
- 為降低 JSON 格式錯誤風險與輸出長度：correctReason 請控制在 30-60 字；misconceptionDescription 請控制在 15-30 字；whyStudentsMayChooseIt 請控制在 20-40 字；whyItIsWrong 請控制在 30-60 字；revisionNote 請控制在 10-25 字；teacherExplanation 請控制在 40-80 字且只寫一句話。以上欄位皆使用單一段落，不得條列、不得換行。
`;

export function buildGenerateItemsPrompt({ project = {}, materialText = "", objectives = [], intents = [], checkedChineseSubcategories = [], fewShotExamples = FEWSHOT_EXAMPLES }) {
  const normalizedSubject = normalizeSubject(project.subject);
  const isChinese = normalizedSubject === "國語";
  const intentList = Array.isArray(intents) ? intents : [];

  const slots = intentList.map((slot) => {
    const base = {
      itemId: slot.itemId,
      questionType: slot.questionType,
      score: slot.score,
      primaryObjectiveId: slot.primaryObjectiveId || "",
    };
    if (slot.isGroup) {
      base.isGroup = true;
      base.subCount = slot.subCount || (Array.isArray(slot.subScores) ? slot.subScores.length : 2);
      base.subScores = slot.subScores || [];
    }
    if (isChinese) {
      base.chineseDimension = slot.chineseDimension || "";
    }
    return base;
  });
  const questionTypeKeys = getQuestionTypeKeysForIntents(intentList, project.subject);
  const useFullQuestionTypeFallback = questionTypeKeys === null;
  const questionTypeGuidelines = getQuestionTypeGuidelines(intentList, project.subject);
  const hasQuestionTypeKey = (key) => useFullQuestionTypeFallback || questionTypeKeys.includes(key);
  const hasGroupSlot = intentList.some((slot) => slot?.isGroup);
  const selectedFewShotExamples = selectFewShotExamples({
    examples: fewShotExamples,
    subject: project.subject,
    grade: project.grade,
    itemTypes: intentList.flatMap((slot) => [slot.questionType, slot.itemType]).filter(Boolean),
    cognitiveLevels: intentList.map((slot) => slot.cognitiveLevel).filter(Boolean),
    primaryObjectiveIds: slots.map((slot) => slot.primaryObjectiveId).filter(Boolean),
    limit: 4,
  });
  const fewShotBlock = renderFewShotExamples(selectedFewShotExamples);

  const promptParts = [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}命題協助者。`,
    "",
    "# 任務",
    "我已決定整卷的「題位」：每個題位的題型、配分與對應學習目標（primaryObjectiveId）固定，不可更動。請為每個題位命題，並採用該題位中所指定的學習目標，以確保配分與指標精準對齊。",
    "題目需符合國小學生程度，答案與解析需正確。每個題位只出一題，不要備選題。",
    "",
    "# 學習目標（含節數）JSON",
    "題位已依各目標的 periodCount（節數）占總教學時數的比例分配好題數與配分（節數多的目標對應較多題、較高總分）；以下 JSON 僅供你了解各目標的內容與分量，作為命題時的背景脈絡。請依各題位指定的 primaryObjectiveId 命題，不必、也不得自行重新分配目標或更動配分。",
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
    "- 每題的 primaryObjectiveId 必須與該題位所指定的 primaryObjectiveId 欄位值完全一致，不可擅自更改，以確保配分與指標精準對齊；如有次要目標可放入 objectiveIds。",
    "- 每題標註 cognitiveLevel（記憶／理解／應用／分析／評鑑／創造）。",
    "- 各學習目標的總配分已由題位的 primaryObjectiveId 與 score 鎖定，依題位命題即可，無須自行調整配分或挑選哪些目標出題。",
    "- 請依題型分「大題」排列：相同 questionType 的題目放在一起（例如所有選擇題相鄰、所有填充題相鄰、所有學力檢測題相鄰），不要把同題型打散。",
    "- 同一大題（同題型）內由易到難；避免題意重複或互相暗示答案。",
    "- 除非該 item 的 stimulus 欄位提供完整閱讀文本，question 不得使用「根據這段文字」「根據本文」「根據上文／下文」「文中」等依賴外部文本的說法；一般題目必須自成一題。",
    "",
    QUALITY_DESIGN_GUIDELINES,
    "",
  ];

  if (hasQuestionTypeKey("chart")) {
    promptParts.push("- 若 questionType 為「圖表判讀題」，請做成『選擇題形式』：先在 question 內以「文字表格」呈現一份資料（實驗記錄表、觀察統整表、數據或統計表；用對齊的文字表格），接著問一個判讀問題（讀值、比較、找規律或推論），並提供 options 共 4 個選項、answer 為單一正確選項。表格數據需合理、與教材概念相符。學生看到的就是一般選擇題。");
  }

  if (hasQuestionTypeKey("experiment")) {
    promptParts.push("- 若 questionType 為「實驗探究題」，同樣做成『選擇題形式』：question 內先描述實驗情境（目的、做法、變因或記錄結果，可用文字表格），再問一個探究問題（變因控制、預測、推論或結論），提供 options 共 4 個選項、answer 為單一正確選項。");
  }

  if (hasQuestionTypeKey("chart") || hasQuestionTypeKey("experiment")) {
    promptParts.push("- 上述圖表判讀題、實驗探究題都要有 options（4 個）與單一 answer，和選擇題一樣，不要做成需要寫長答案的開放題。");
  }

  if (hasQuestionTypeKey("chart") || hasQuestionTypeKey("experiment") || hasQuestionTypeKey("drawing")) {
    promptParts.push("- 若題目情境需要配合圖表或圖形（例如電路圖、植物構造圖、統計折線圖/圓餅圖、地理地圖或幾何圖形等），請一律在題目合適位置輸出「（請在此處補上圖片）」的提示字眼，以便使用者後續手動貼圖；表格（如實驗記錄表、數據表）則必須以文字表格完整生成，不得使用提示字眼替代。");
  }

  if (hasGroupSlot) {
    promptParts.push(
      "",
      "# 題組（情境素養題組）之特別規定",
      "若題位的 isGroup 為 true，你必須將其拆解成其 subCount 所指定數量的子題（例如 subCount 為 3，則拆解成 3 個子題）。每一題（子題）在輸出 JSON 的 items 陣列中作為一個獨立的物件。請嚴格遵守以下規定：",
      "  1. 這些子題必須共享相同的 `groupId`。例如對於題位 Q-041，其子題的 `groupId` 皆設為 `\"G-041\"`。",
      "  2. 各子題的 `itemId` 分別命名為 `\"{原 itemId}-1\"`, `\"{原 itemId}-2\"`, `\"{原 itemId}-3\"`（例如 `\"Q-041-1\"`, `\"Q-041-2\"`）。",
      "  3. 各子題必須是獨立的物件，具有自己的 `itemId`, `questionType` (沿用原題位的 questionType), `score` 等。",
      "  4. 所有子題的 `score`（配分）必須是正整數，且依序完全符合該題位 `subScores` 陣列中所指定的各子題配分（例如原本題位 `subScores` 為 `[2, 3]`，則第一個子題配 2 分，第二個子題配 3 分）。其加總必須等於原題位的 `score` 設定分值。",
      "  5. 組內的第一個子題（如 `\"Q-041-1\"`）必須填寫共同的 `stimulus`（情境引言 / 長文本段落），而其餘子題（如 `\"Q-041-2\"`）的 `stimulus` 則留空（`\"\"`）。",
      "  6. 每個子題的 `question` 欄位為該子題自身的提問（不要在提問前面加上 (1) 這種題號，純為提問文字）。",
      "  7. 每個子題有自己獨立的 `options`、`answer` 與 `explanation`（若是選擇題、是非題、實驗探究題、圖表判讀題或學力檢測題類型的子題，options 至少提供 4 個選項）。",
      ""
    );
  }

  if (fewShotBlock) {
    promptParts.push(fewShotBlock, "");
  }

  promptParts.push(
    getDistractorDesignGuidelines(project.subject),
    "",
    INTERNAL_OUTPUT_GUIDELINES,
    ""
  );

  if (isChinese) {
    const subcategoryLines = getChineseSubcategoryLines(checkedChineseSubcategories);
    const listStr = Array.isArray(checkedChineseSubcategories) && checkedChineseSubcategories.length > 0
      ? `特別注意：本次教師僅勾選了以下細項，因此產出的國語科題目中，其 \`chineseSubcategory\` 欄位值「只允許且必須」在以下這組已勾選的細項中選擇：${checkedChineseSubcategories.map(s => `"${s}"`).join(", ")}。請務必在這些已勾選的細項範圍內為各題命題，不可使用未勾選的細項。`
      : "";
    promptParts.push(
      "# 國語科評量向度與細項特別要求",
      "- 本考卷科目為國語，產出的每一題（包含一般題與學力檢測題的所有子題）皆必須新增 `chineseDimension` 欄位與 `chineseSubcategory` 欄位。",
      "- 每一題的 `chineseDimension` 必須與該題在題位 JSON 中所指定的 `chineseDimension` 欄位值完全一致，不可擅自更改。",
      "- `chineseSubcategory` 必須為該題最合適的細項項目，且其值必須為以下可用項目之一：",
      ...subcategoryLines,
      listStr,
      "- 命題應密切符合該細項意旨。例如若為「正確字音」，應考查正確注音拼寫或辨識；若為「常用修辭」，應考查設問/譬喻/擬人等修辭辨識；若為「提取訊息」，應針對閱讀測驗文本直接可提取的細節進行提問。",
      ""
    );
  }

  promptParts.push(
    questionTypeGuidelines,
    "",
    JSON_OUTPUT_STABILITY_GUIDELINES,
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[...]}。items 的排列順序就是考卷的出題順序，請依編排原則排好。",
    `每題必須包含：itemId（沿用題位或子題題號）, questionType（沿用題位）, score（配分）, primaryObjectiveId, objectiveIds, cognitiveLevel, stimulus, question, options, answer, explanation, qualityMeta${isChinese ? ", chineseDimension, chineseSubcategory" : ""}。如果是學力檢測題的子題，必須包含 groupId，其他題型 groupId 填空字串即可。`,
    "選擇題形式題目的 qualityMeta.distractorDesign 必須包含每個錯誤選項的迷思設計；非選擇題若沒有選項，可將 qualityMeta.distractorDesign 設為空物件。"
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
    "只輸出 JSON：{\"objectives\":[{\"text\":\"4-3-1 能…\",\"periodCount\":1,\"unitName\":\"動物的生命延續\"}, ...]}。text 開頭盡量含指標編號；periodCount 為正整數；unitName 為該目標所屬的單元名稱，若無法辨識則為『未分單元』。",
  ].join("\n");
}

export function buildExtractObjectivesPrompt({ project = {}, materialText = "", hasFiles = false }) {
  const rangePart = project.range
    ? `\n# 命題範圍限制（極重要）\n本次考試的命題範圍限制為：【${project.range}】。隨附檔案可能包含整冊或超出範圍的內容，請『僅』提取與此命題範圍相關的學習目標與教材重點（生字、語詞、句型等），請忽略此範圍之外的課次與單元。\n`
    : "";

  return [
    "# 角色",
    `你是臺灣國小${text(project.grade, "未指定年級")}${text(project.subject, "未指定科目")}課程設計協助者。`,
    "",
    "# 任務",
    hasFiles
      ? "請閱讀我隨附的教材檔案（可能多份 PDF），萃取可評量的學習目標，並將教材核心重點（包含生字語詞、重要觀念、定理公式或主要事實，視科目而定）彙整成一個簡潔但具代表性的「教材大意與重點摘要」（約 300-600 字）。"
      : "請從教材內容萃取可評量的學習目標，並將教材核心重點（包含生字語詞、重要觀念、定理公式或主要事實，視科目而定）彙整成一個簡潔但具代表性的「教材大意與重點摘要」（約 300-600 字）。",
    "目標數量依教材內容多寡判斷，一般 3 到 8 個。不得自行假造教材沒有的內容。",
    rangePart,
    "",
    "# 節數（重要）",
    "請依教材分量，為每個目標估算建議教學節數 periodCount（正整數）。",
    "節數會用來計算各目標占總教學時數的比例，作為配分依據（節數多的目標分配到較多題與較高分），務必合理填寫。",
    "",
    "# 教材內容",
    hasFiles ? "（見隨附檔案）" : text(materialText, "未提供教材內容。"),
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"objectives\":[...], \"materialSummary\":\"這裡放教材大意與重點摘要的文字描述\"}。",
    "每個目標必須包含：unitName（單元名稱）, lessonName（課名，可為空字串）, text（目標敘述）, periodCount（建議節數，正整數）。",
  ].join("\n");
}

export function buildRegenerateItemPrompt({ project = {}, materialText = "", objectives = [], originalItem, reason = "" }) {
  const isChinese = normalizeSubject(project.subject) === "國語";
  const questionTypeGuidelines = getQuestionTypeGuidelines([originalItem], project.subject);

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
    QUALITY_DESIGN_GUIDELINES,
    "",
    getDistractorDesignGuidelines(project.subject),
    "",
    INTERNAL_OUTPUT_GUIDELINES,
    "",
    questionTypeGuidelines,
    "",
    "# 輸出要求",
    "只輸出 JSON，不要 Markdown。格式：{\"items\":[一題]}。",
    "重出後的題目必須包含原本必要欄位，並補齊 qualityMeta；選擇題形式題目的 qualityMeta.distractorDesign 必須包含每個錯誤選項的迷思設計。"
  ];

  if (isChinese) {
    promptParts.push(
      "# 國語向度鎖定",
      `- 本題向度由題位鎖定：重出後 \`chineseDimension\` 必須維持原題的值「${originalItem.chineseDimension || ""}」（即「字詞短語」「句式語法」「段篇讀寫」之一），不可擅自更改，以免影響整卷向度佔分。`,
      "- 必須同時輸出 `chineseSubcategory`（該題最合適的細項），且其細項須屬於上述鎖定的 chineseDimension。"
    );
  }

  return promptParts.join("\n");
}
