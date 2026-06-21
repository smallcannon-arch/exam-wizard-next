import { QUALITY_META_SCHEMA_VERSION } from "./schema.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

function normalizeOptions(value) {
  const values = Array.isArray(value)
    ? value
    : optionsObjectValues(value);

  return values
    .map(normalizeOptionValue)
    .filter(Boolean);
}

function normalizeOptionValue(option) {
  if (typeof option === "string") return option.trim();

  if (isPlainObject(option)) {
    return firstNonEmptyText(
      option.text,
      option.label,
      option.value,
      option.content,
    );
  }

  return "";
}

function optionsObjectValues(value) {
  if (!isPlainObject(value)) return [];

  const entries = Object.entries(value);
  const order = new Map(["A", "B", "C", "D"].map((key, index) => [key, index]));

  return entries
    .filter(([, option]) => typeof option === "string" || isPlainObject(option))
    .sort(([left], [right]) => {
      const leftKey = left.trim().toUpperCase();
      const rightKey = right.trim().toUpperCase();
      const leftOrder = order.has(leftKey) ? order.get(leftKey) : Number.POSITIVE_INFINITY;
      const rightOrder = order.has(rightKey) ? order.get(rightKey) : Number.POSITIVE_INFINITY;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return entries.findIndex(([key]) => key === left) - entries.findIndex(([key]) => key === right);
    })
    .map(([, option]) => option);
}

function normalizeQualityMeta(item, explanation) {
  const base = isPlainObject(item.qualityMeta) ? { ...item.qualityMeta } : {};
  const legacyDistractorDesign = isPlainObject(item.distractorDesign) ? item.distractorDesign : null;
  const legacySelfCheck = isPlainObject(item.selfCheck) ? item.selfCheck : null;
  const abilityFocus = firstNonEmptyText(base.abilityFocus, item.abilityFocus);
  const teacherExplanation = firstNonEmptyText(base.teacherExplanation, item.teacherExplanation);
  const correctReason = firstNonEmptyText(base.correctReason, item.correctReason);

  const hasQualityData = Object.keys(base).length > 0
    || legacyDistractorDesign
    || legacySelfCheck
    || abilityFocus
    || teacherExplanation
    || correctReason;

  if (!hasQualityData) return undefined;

  return {
    ...base,
    schemaVersion: firstNonEmptyText(base.schemaVersion, QUALITY_META_SCHEMA_VERSION),
    subject: firstNonEmptyText(base.subject, item.subject),
    grade: firstNonEmptyText(base.grade, item.grade),
    unit: firstNonEmptyText(base.unit, item.unit, item.unitName),
    cognitiveLevel: firstNonEmptyText(base.cognitiveLevel, item.cognitiveLevel),
    difficulty: firstNonEmptyText(base.difficulty, item.difficulty),
    itemType: firstNonEmptyText(base.itemType, item.itemType, item.questionType),
    abilityFocus,
    correctReason,
    teacherExplanation,
    distractorDesign: isPlainObject(base.distractorDesign)
      ? base.distractorDesign
      : (legacyDistractorDesign || {}),
    selfCheck: isPlainObject(base.selfCheck)
      ? base.selfCheck
      : (legacySelfCheck || {}),
    studentExplanation: firstNonEmptyText(base.studentExplanation, item.studentExplanation, explanation),
  };
}

export function normalizeGeneratedItem(item) {
  if (!isPlainObject(item)) return item;

  const {
    abilityFocus: _legacyAbilityFocus,
    correctReason: _legacyCorrectReason,
    distractorDesign: _legacyDistractorDesign,
    selfCheck: _legacySelfCheck,
    teacherExplanation: _legacyTeacherExplanation,
    ...canonicalItem
  } = item;

  const question = firstNonEmptyText(
    item.question,
    item.stem,
    item.prompt,
    item.problem,
    item.questionText,
    item.itemText,
    item.text,
    item.title,
  );

  const explanation = firstNonEmptyText(
    item.explanation,
    item.studentExplanation,
    item.rationale,
    item.analysis,
    item.reason,
    item.solution,
  );

  return {
    ...canonicalItem,
    question,
    options: normalizeOptions(item.options),
    answer: firstNonEmptyText(item.answer, item.correctAnswer, item.key),
    explanation,
    qualityMeta: normalizeQualityMeta(item, explanation),
  };
}

export function normalizeGeneratedItems(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => normalizeGeneratedItem(item));
}
