import { DEFAULT_EXAM_CONFIG, QUESTION_TYPES, asText, toPositiveInteger } from "./schema.js";
import { makeIntentId, makeSectionId } from "./ids.js";

function normalizeQuestionType(value, index) {
  if (QUESTION_TYPES.includes(value)) return value;
  return DEFAULT_EXAM_CONFIG.defaultQuestionTypes[index % DEFAULT_EXAM_CONFIG.defaultQuestionTypes.length];
}

export function buildItemIntents({
  objectivePlans,
  objectives = [],
  unitScore = DEFAULT_EXAM_CONFIG.unitScore,
  questionTypeMix = DEFAULT_EXAM_CONFIG.defaultQuestionTypes,
} = {}) {

  if (!Array.isArray(objectivePlans) || objectivePlans.length === 0) {
    return { ok: false, intents: [], error: "缺少目標配題規劃。" };
  }

  const objectiveById = new Map(objectives.map((objective) => [objective.objectiveId, objective]));
  const intents = [];
  let serial = 1;

  for (const plan of objectivePlans) {
    const count = toPositiveInteger(plan.targetUnitCount, 0);
    const objective = objectiveById.get(plan.objectiveId);

    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const questionType = normalizeQuestionType(questionTypeMix[localIndex % questionTypeMix.length], localIndex);
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
        score: unitScore,
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
