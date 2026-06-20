export const DEFAULT_EXAM_CONFIG = Object.freeze({
  totalScore: 100,
  unitScore: 2,
  defaultQuestionTypes: ["選擇題", "填充題", "應用題"],
  defaultDifficulty: "medium",
  defaultCognitiveLevel: "理解",
});

export const QUESTION_TYPES = Object.freeze([
  "是非題",
  "選擇題",
  "填充題",
  "配合題",
  "短答題",
  "應用題",
  "題組小題",
]);

export const COGNITIVE_LEVELS = Object.freeze([
  "記憶",
  "理解",
  "應用",
  "分析",
  "評鑑",
  "創造",
]);

export const QUALITY_META_SCHEMA_VERSION = "item-quality-meta/v1";

export const QUALITY_META_REQUIRED_FIELDS = Object.freeze([
  "schemaVersion",
  "subject",
  "grade",
  "unit",
  "cognitiveLevel",
  "difficulty",
  "itemType",
  "abilityFocus",
  "correctReason",
  "distractorDesign",
  "teacherExplanation",
  "selfCheck",
]);

export const QUALITY_META_DISTRACTOR_REQUIRED_FIELDS = Object.freeze([
  "misconceptionTag",
  "misconceptionDescription",
  "whyStudentsMayChooseIt",
  "whyItIsWrong",
  "revisionNote",
]);

export const QUALITY_META_SELF_CHECK_FIELDS = Object.freeze([
  "singleCorrectAnswer",
  "matchesPrimaryObjectiveId",
  "matchesCognitiveLevel",
  "allDistractorsHaveMisconceptionTags",
  "noObviousGiveaway",
  "gradeAppropriate",
  "noUnnecessaryDifficulty",
]);

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function toPositiveInteger(value, fallback = null) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return number;
}

export function asText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(hasText).map((value) => value.trim()))];
}
