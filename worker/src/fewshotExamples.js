export const FEWSHOT_EXAMPLES = Object.freeze([]);

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

  return examples
    .filter((example) => example?.status === "teacher_reviewed" && example?.promptUseStatus === "prompt_ready")
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
