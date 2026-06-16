import { DEFAULT_EXAM_CONFIG, QUESTION_TYPES, asText, toPositiveInteger } from "./schema.js";
import { makeIntentId, makeSectionId } from "./ids.js";

function normalizeQuestionType(value, index) {
  if (QUESTION_TYPES.includes(value)) return value;
  return DEFAULT_EXAM_CONFIG.defaultQuestionTypes[index % DEFAULT_EXAM_CONFIG.defaultQuestionTypes.length];
}

// 解析「全卷題型比例」輸入，例如：選擇題:70, 填充題:20, 短答題:10
export function parseQuestionTypeMix(input) {
  return String(input || "")
    .split(/[\n,，、]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const parts = segment.split(/[:：=\s]+/).map((part) => part.trim()).filter(Boolean);
      return { questionType: parts[0] || "", percent: Number(parts[1]) };
    })
    .filter((row) => row.questionType && Number.isFinite(row.percent) && row.percent > 0);
}

export function buildItemIntents({
  objectivePlans,
  objectives = [],
  unitScore = DEFAULT_EXAM_CONFIG.unitScore,
  questionTypeMix = DEFAULT_EXAM_CONFIG.defaultQuestionTypes,
  questionTypeSequence = null,
  scoreSequence = null,
} = {}) {

  if (!Array.isArray(objectivePlans) || objectivePlans.length === 0) {
    return { ok: false, intents: [], error: "缺少目標配題規劃。" };
  }

  const objectiveById = new Map(objectives.map((objective) => [objective.objectiveId, objective]));
  const useTypeSequence = Array.isArray(questionTypeSequence);
  const useScoreSequence = Array.isArray(scoreSequence);
  const intents = [];
  let serial = 1;

  for (const plan of objectivePlans) {
    const count = toPositiveInteger(plan.targetUnitCount, 0);
    const objective = objectiveById.get(plan.objectiveId);

    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const globalIndex = serial - 1;
      // 序列模式：題型由配題表決定（含學力檢測題等自訂題型），原樣沿用，空白才退回預設。
      const questionType = useTypeSequence
        ? (asText(questionTypeSequence[globalIndex]) || normalizeQuestionType(undefined, globalIndex))
        : normalizeQuestionType(questionTypeMix[localIndex % questionTypeMix.length], localIndex);
      const score = useScoreSequence
        ? toPositiveInteger(scoreSequence[globalIndex], unitScore)
        : unitScore;
      const unitName = asText(objective?.unitName, "未分單元");

      intents.push({
        intentId: makeIntentId(serial),
        itemId: `Q-${String(serial).padStart(3, "0")}`,
        primaryObjectiveId: plan.objectiveId,
        secondaryObjectiveIds: [],
        objectiveIds: [plan.objectiveId],
        themeBlockId: unitName,
        groupId: "",
        questionType,
        cognitiveLevel: DEFAULT_EXAM_CONFIG.defaultCognitiveLevel,
        difficulty: DEFAULT_EXAM_CONFIG.defaultDifficulty,
        score,
        generationHint: "",
      });

      serial += 1;
    }
  }

  return { ok: true, intents };
}

export function buildPaperSectionsByTheme({ intents } = {}) {
  if (!Array.isArray(intents) || intents.length === 0) {
    return { ok: false, sections: [], error: "缺少題目藍圖。" };
  }

  const blockMap = new Map();

  for (const intent of intents) {
    const key = intent.themeBlockId || "綜合題";
    if (!blockMap.has(key)) blockMap.set(key, []);
    blockMap.get(key).push(intent.itemId);
  }

  const sections = [...blockMap.entries()].map(([title, itemIds], index) => ({
    sectionId: makeSectionId(index + 1),
    order: index + 1,
    title: `${index + 1}. ${title}`,
    layoutMode: "themeBlock",
    itemIds,
  }));

  return { ok: true, sections };
}

// 題位制：只鎖每題的題型與配分（來自配題表），不預先綁定學習目標。
// 學習目標、認知層次與排序交由 LLM 在生成時依節數比例與整卷整體性編排。
export function buildItemSlots({ questionTypeSequence = [], scoreSequence = [], configSequence = [] } = {}) {
  const types = Array.isArray(questionTypeSequence) ? questionTypeSequence : [];
  const scores = Array.isArray(scoreSequence) ? scoreSequence : [];
  const configs = Array.isArray(configSequence) ? configSequence : [];
  const total = Math.max(types.length, scores.length);

  if (total === 0) {
    return { ok: false, slots: [], error: "缺少配題序列，請先填寫配題表。" };
  }

  const slots = [];
  for (let index = 0; index < total; index += 1) {
    const serial = index + 1;
    const type = asText(types[index], DEFAULT_EXAM_CONFIG.defaultQuestionTypes[0]);
    const config = configs[index] || { isGroup: type === "學力檢測題", subScores: type === "學力檢測題" ? [2, 3] : [] };
    slots.push({
      intentId: makeIntentId(serial),
      itemId: `Q-${String(serial).padStart(3, "0")}`,
      questionType: type,
      score: toPositiveInteger(scores[index], 1),
      cognitiveLevel: "",
      objectiveIds: [],
      primaryObjectiveId: "",
      groupId: "",
      isGroup: config.isGroup,
      subCount: config.isGroup ? config.subScores.length : 0,
      subScores: config.subScores || [],
    });
  }

  return { ok: true, slots };
}

// 將題目依題型分「大題」：相同 questionType 放在一起，順序依 typeOrder（配題表順序），
// 其餘未列到的題型接在後面。同一大題內維持題目原順序。
// 學生卷分大題時，圖表判讀題、實驗探究題併入「選擇題」，學生看不出題型。
function sectionType(questionType) {
  const type = asText(questionType, "其他");
  return (type === "圖表判讀題" || type === "實驗探究題") ? "選擇題" : type;
}

export function buildSectionsByQuestionType({ items = [], typeOrder = [] } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, sections: [], error: "缺少題目。" };
  }

  const order = [];
  for (const type of (Array.isArray(typeOrder) ? typeOrder : [])) {
    const normalized = sectionType(type);
    if (normalized && !order.includes(normalized)) order.push(normalized);
  }
  for (const item of items) {
    const normalized = sectionType(item?.questionType);
    if (!order.includes(normalized)) order.push(normalized);
  }

  const groups = new Map(order.map((type) => [type, []]));
  for (const item of items) {
    const type = sectionType(item?.questionType);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(item.itemId);
  }

  let serial = 1;
  const sections = [];
  for (const [title, itemIds] of groups) {
    if (itemIds.length === 0) continue;
    sections.push({ sectionId: makeSectionId(serial), order: serial, title, layoutMode: "byType", itemIds });
    serial += 1;
  }

  return { ok: true, sections };
}
