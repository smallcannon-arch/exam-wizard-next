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
