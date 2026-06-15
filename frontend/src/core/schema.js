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
