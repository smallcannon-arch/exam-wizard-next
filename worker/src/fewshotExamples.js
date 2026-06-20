export const FEWSHOT_EXAMPLES = Object.freeze([
  {
    exampleId: "G4_CH_READ_001",
    status: "teacher_reviewed",
    promptUseStatus: "prompt_ready",
    reviewedBy: "Smallcannon",
    reviewDate: "2026-06-20",
    reviewNote: "准入第一輪 A/B 測試用 few-shot。",
    subject: "國語文",
    grade: "國小四年級",
    unit: "閱讀理解",
    objectiveId: "待對應",
    cognitiveLevel: "理解",
    itemType: "閱讀理解單題",
    difficulty: "中",
    question: "閱讀短文後，回答問題。\n\n放學後，天空突然下起大雨。小安看見同學小哲站在走廊邊，手裡拿著美勞作品，卻沒有帶傘。小安原本想快點回家，因為媽媽提醒他晚餐前要完成作業。可是他想了想，還是走回教室拿出備用雨衣，陪小哲一起走到校門口。回家後，作業雖然晚了一點才開始寫，小安心裡卻覺得很踏實。\n\n這段文字主要想表達什麼？",
    options: {
      A: "下雨天一定要準備雨具。",
      B: "幫助別人有時需要放慢自己的腳步。",
      C: "做作業比幫助同學更重要。",
      D: "美勞作品遇到雨很容易壞掉。",
    },
    answer: "B",
    correctReason: "短文核心不在雨具、作業或美勞作品，而在小安願意暫緩自己回家的計畫，主動幫助同學。",
    distractorDesign: {
      A: {
        misconceptionTag: "keyword_trap",
        misconceptionDescription: "學生看到大雨、傘、雨衣等高頻詞就直接選答。",
        whyStudentsMayChooseIt: "雨具線索在短文中重複出現。",
        whyItIsWrong: "雨具只是情境，不是文章主旨。",
        revisionNote: "保留，能診斷關鍵詞直覺誘答。",
      },
      C: {
        misconceptionTag: "main_idea_confusion",
        misconceptionDescription: "學生把次要事件誤當文章主旨。",
        whyStudentsMayChooseIt: "文中提到媽媽提醒作業。",
        whyItIsWrong: "小安的行動顯示幫助同學才是核心。",
        revisionNote: "保留，誘答具診斷性。",
      },
      D: {
        misconceptionTag: "partial_reading",
        misconceptionDescription: "學生只抓住文本中的具體物件。",
        whyStudentsMayChooseIt: "美勞作品是小哲需要幫助的原因之一。",
        whyItIsWrong: "物件細節不是主要訊息。",
        revisionNote: "保留。",
      },
    },
    whyThisIsGood: [
      "題幹聚焦主旨理解。",
      "正答需整合人物行動與心理。",
      "三個誘答分別對應不同閱讀迷思。",
    ],
    analysisStyleNote: "解析先說明正答如何整合全文，再逐一指出誘答只抓到局部線索。",
  },
  {
    exampleId: "G4_CH_SENTENCE_003",
    status: "teacher_reviewed",
    promptUseStatus: "prompt_ready",
    reviewedBy: "Smallcannon",
    reviewDate: "2026-06-20",
    reviewNote: "准入第一輪 A/B 測試用 few-shot。",
    subject: "國語文",
    grade: "國小四年級",
    unit: "句式語法",
    objectiveId: "待對應",
    cognitiveLevel: "應用",
    itemType: "句式選擇題",
    difficulty: "中",
    question: "下列哪一組關聯詞填入句中最恰當？\n\n「這條路□□比較遠，□□沿途有樹蔭，走起來很舒服。」",
    options: {
      A: "因為……所以",
      B: "雖然……但是",
      C: "只要……就",
      D: "不但……而且",
    },
    answer: "B",
    correctReason: "前半句是不利條件，後半句是轉折後的優點，應使用「雖然……但是」。",
    distractorDesign: {
      A: {
        misconceptionTag: "structure_confusion",
        misconceptionDescription: "學生只憑熟悉句型作答，未判斷分句語意。",
        whyStudentsMayChooseIt: "因為……所以是熟悉句型。",
        whyItIsWrong: "後句不是前句造成的結果。",
        revisionNote: "保留。",
      },
      C: {
        misconceptionTag: "stem_neglect",
        misconceptionDescription: "學生只注意後半句的好處，忽略前半句和後半句的轉折關係。",
        whyStudentsMayChooseIt: "只注意到走起來舒服的結果。",
        whyItIsWrong: "句中沒有條件成立就會發生的語意。",
        revisionNote: "保留。",
      },
      D: {
        misconceptionTag: "structure_confusion",
        misconceptionDescription: "學生把兩個分句都當成並列優點。",
        whyStudentsMayChooseIt: "兩個分句都可視為描述路的特徵。",
        whyItIsWrong: "前後一負一正，應使用轉折。",
        revisionNote: "保留。",
      },
    },
    whyThisIsGood: [
      "四個選項都是常見關聯詞。",
      "誘答對應因果、條件、遞進與轉折混淆。",
      "題幹短，非目標閱讀負荷低。",
    ],
    analysisStyleNote: "解析應指出前後分句的語意方向，再判斷關聯詞。",
  },
  {
    exampleId: "G4_MA_CLOCK_002",
    status: "teacher_reviewed",
    promptUseStatus: "prompt_ready",
    reviewedBy: "Smallcannon",
    reviewDate: "2026-06-20",
    reviewNote: "准入第一輪 A/B 測試用 few-shot。本題限於四年級 S-4-2 旋轉角與鐘面模型，不處理超過 360 度或時針分針複合夾角公式。",
    subject: "數學",
    grade: "國小四年級",
    unit: "角度與時間",
    objectiveId: "待對應",
    cognitiveLevel: "解題思考",
    itemType: "選擇題",
    difficulty: "中偏難",
    question: "鐘面上分針從 12 走到 4，分針共旋轉了幾度？",
    options: {
      A: "20 度",
      B: "40 度",
      C: "120 度",
      D: "240 度",
    },
    answer: "C",
    correctReason: "鐘面一圈 360 度，共 12 大格，每大格 30 度。從 12 到 4 是 4 大格，30 × 4 = 120 度。",
    distractorDesign: {
      A: {
        misconceptionTag: "time_duration_confusion",
        misconceptionDescription: "學生把鐘面上的分鐘量直接當成角度。",
        whyStudentsMayChooseIt: "從 12 到 4 可想到 20 分鐘。",
        whyItIsWrong: "分鐘數不等於角度。",
        revisionNote: "保留。",
      },
      B: {
        misconceptionTag: "concept_inversion",
        misconceptionDescription: "學生錯誤使用每格 10 度的直覺規則。",
        whyStudentsMayChooseIt: "把鐘面數字 4 乘以 10。",
        whyItIsWrong: "每大格是 30 度。",
        revisionNote: "保留。",
      },
      D: {
        misconceptionTag: "concept_inversion",
        misconceptionDescription: "學生算成反方向較大的角。",
        whyStudentsMayChooseIt: "從 4 回到 12 有 8 大格。",
        whyItIsWrong: "題目問分針從 12 到 4 的旋轉量。",
        revisionNote: "保留。",
      },
    },
    whyThisIsGood: [
      "考鐘面與角度的表徵轉換。",
      "誘答對應時間、角度、方向三類錯誤。",
      "解析可示範一圈 360 度與 12 大格的關係。",
    ],
    analysisStyleNote: "解析應一步一步說明 360 ÷ 12 與 30 × 4。",
  },
  {
    exampleId: "G4_MA_EQUATION_004",
    status: "teacher_reviewed",
    promptUseStatus: "prompt_ready",
    reviewedBy: "Smallcannon",
    reviewDate: "2026-06-20",
    reviewNote: "准入第一輪 A/B 測試用 few-shot。",
    subject: "數學",
    grade: "國小四年級",
    unit: "未知數與列式",
    objectiveId: "待對應",
    cognitiveLevel: "程序執行",
    itemType: "選擇題",
    difficulty: "中",
    question: "一個三明治 45 元，一瓶果汁 30 元。小婷買了相同份數的三明治和果汁，共付 300 元。若用 □ 表示各買的份數，下列哪個算式正確？",
    options: {
      A: "45 + 30 × □ = 300",
      B: "(45 + 30) × □ = 300",
      C: "45 × 30 + □ = 300",
      D: "300 ÷ 45 + 30 = □",
    },
    answer: "B",
    correctReason: "每一組包含一個三明治和一瓶果汁，共 45 + 30 = 75 元，買 □ 組，所以是 (45 + 30) × □ = 300。",
    distractorDesign: {
      A: {
        misconceptionTag: "unknown_position_error",
        misconceptionDescription: "學生只把其中一種商品乘上份數。",
        whyStudentsMayChooseIt: "看到果汁單價在 □ 前面。",
        whyItIsWrong: "兩種商品都買相同份數，都要乘 □。",
        revisionNote: "保留。",
      },
      C: {
        misconceptionTag: "concept_inversion",
        misconceptionDescription: "學生把兩個單價直接相乘。",
        whyStudentsMayChooseIt: "看到兩個數字就直接相乘。",
        whyItIsWrong: "商品組合的單價應相加後再乘份數。",
        revisionNote: "保留。",
      },
      D: {
        misconceptionTag: "unknown_position_error",
        misconceptionDescription: "學生把總價和單一商品價格做錯誤對應。",
        whyStudentsMayChooseIt: "嘗試用總價除以單一商品價格。",
        whyItIsWrong: "式子沒有表達相同份數的一組商品。",
        revisionNote: "保留。",
      },
    },
    whyThisIsGood: [
      "題幹明確定義未知數。",
      "數字可心算，降低非目標負荷。",
      "誘答能診斷列式中的括號與未知數位置錯誤。",
    ],
    analysisStyleNote: "解析應先定義一組商品，再寫出總價關係式。",
  },
]);

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSubject(value) {
  const text = normalizeText(value);
  return text === "國語文" ? "國語" : text;
}

function valuesMatch(exampleValue, contextValue) {
  const exampleText = normalizeSubject(exampleValue);
  if (!exampleText) return false;

  return asArray(contextValue).some((value) => {
    const contextText = normalizeSubject(value);
    if (!contextText) return false;
    return exampleText === contextText
      || exampleText.includes(contextText)
      || contextText.includes(exampleText);
  });
}

export function scoreFewShotExample(example = {}, context = {}) {
  let score = 0;

  if (valuesMatch(example.subject, context.subject)) score += 5;
  if (valuesMatch(example.grade, context.grade)) score += 3;
  if (valuesMatch(example.itemType, context.itemType || context.itemTypes)) score += 2;
  if (valuesMatch(example.cognitiveLevel, context.cognitiveLevel || context.cognitiveLevels)) score += 2;
  if (valuesMatch(example.objectiveId, context.primaryObjectiveId || context.primaryObjectiveIds)) score += 4;

  return score;
}

export function selectFewShotExamples({
  examples = FEWSHOT_EXAMPLES,
  subject = "",
  grade = "",
  itemType = "",
  itemTypes = [],
  cognitiveLevel = "",
  cognitiveLevels = [],
  primaryObjectiveId = "",
  primaryObjectiveIds = [],
  limit = 4,
} = {}) {
  const max = Math.max(0, Number(limit) || 0);
  if (!Array.isArray(examples) || max === 0) return [];

  const eligible = examples
    .filter((example) => example?.status === "teacher_reviewed" && example?.promptUseStatus === "prompt_ready");
  const subjectMatched = subject
    ? eligible.filter((example) => valuesMatch(example.subject, subject))
    : eligible;

  return subjectMatched
    .map((example, index) => ({
      example,
      index,
      score: scoreFewShotExample(example, {
        subject,
        grade,
        itemType,
        itemTypes,
        cognitiveLevel,
        cognitiveLevels,
        primaryObjectiveId,
        primaryObjectiveIds,
      }),
    }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .slice(0, max)
    .map((entry) => entry.example);
}

function renderOptions(options = {}) {
  if (Array.isArray(options)) {
    return options.map((option, index) => `${String.fromCharCode(65 + index)}. ${normalizeText(option)}`).join(" / ");
  }

  if (options && typeof options === "object") {
    return Object.entries(options)
      .map(([key, value]) => `${key}. ${normalizeText(value)}`)
      .join(" / ");
  }

  return "";
}

function renderDistractorDesign(distractorDesign = {}) {
  if (!distractorDesign || typeof distractorDesign !== "object" || Array.isArray(distractorDesign)) return "";

  return Object.entries(distractorDesign)
    .map(([key, design]) => {
      const tag = normalizeText(design?.misconceptionTag) || "未標示";
      const reason = normalizeText(design?.whyItIsWrong || design?.misconceptionDescription);
      return `${key}：${tag}${reason ? `，${reason}` : ""}`;
    })
    .join("；");
}

export function renderFewShotExamples(examples = []) {
  if (!Array.isArray(examples) || examples.length === 0) return "";

  const rendered = examples.map((example, index) => {
    const whyThisIsGood = Array.isArray(example.whyThisIsGood)
      ? example.whyThisIsGood.filter(Boolean).join("；")
      : normalizeText(example.whyThisIsGood);

    return [
      `範例 ${index + 1}（${normalizeText(example.exampleId) || "未命名"}）`,
      `科目：${normalizeText(example.subject) || "未標示"}`,
      `年級：${normalizeText(example.grade) || "未標示"}`,
      `題型：${normalizeText(example.itemType) || "未標示"}`,
      `認知歷程：${normalizeText(example.cognitiveLevel) || "未標示"}`,
      `這題好在哪：${whyThisIsGood || "未標示"}`,
      `題目：${normalizeText(example.question)}`,
      `選項：${renderOptions(example.options)}`,
      `正答：${normalizeText(example.answer)}`,
      `正答理由：${normalizeText(example.correctReason)}`,
      `誘答設計：${renderDistractorDesign(example.distractorDesign)}`,
      `解析示範：${normalizeText(example.analysisStyleNote || example.correctReason)}`,
    ].join("\n");
  }).join("\n\n");

  return [
    "【few-shot 優良題範例】",
    "以下範例只用來學習題感、誘答設計與解析方式。請學習標註中的品質判準，不得照抄題目內容或情境。",
    "",
    rendered,
  ].join("\n");
}
