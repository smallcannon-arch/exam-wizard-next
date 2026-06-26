import { QUALITY_META_SCHEMA_VERSION } from "./schema.js";
import {
  isChoiceLikeQuestionType,
  shouldDisplayOptionsForQuestionType,
} from "./questionTypes.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const OPTION_KEYS = ["A", "B", "C", "D"];

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

function normalizeCompareText(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[（(]?\s*[A-Da-d]\s*[）)]?\s*[.．、:：]\s*/, "")
    .replace(/\s+/g, " ");
}

function normalizeOptionKey(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^[（(]?\s*([A-Da-d])\s*[）)]?\s*[.．。、:：]?$/);
  return match ? match[1].toUpperCase() : "";
}

function findOptionKeyByText(value, options) {
  const target = normalizeCompareText(value);
  if (!target) return "";

  const matches = [];
  options.forEach((option, index) => {
    if (normalizeCompareText(option) === target) {
      matches.push(OPTION_KEYS[index]);
    }
  });

  return matches.length === 1 ? matches[0] : "";
}

function normalizeAnswerValue(value, options) {
  const text = firstNonEmptyText(value);
  if (!text) return "";

  const key = normalizeOptionKey(text);
  if (key) return key;

  return findOptionKeyByText(text, options) || text;
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

function normalizeDistractorDesign(value, options, answerKey) {
  if (!isPlainObject(value)) return {};

  const normalized = {};
  for (const [rawKey, design] of Object.entries(value)) {
    const key = normalizeOptionKey(rawKey) || findOptionKeyByText(rawKey, options) || rawKey;
    if (key === answerKey) continue;
    normalized[key] = design;
  }
  return normalized;
}

function normalizeQualityMeta(item, explanation, options, answerKey) {
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
    distractorDesign: normalizeDistractorDesign(
      isPlainObject(base.distractorDesign) ? base.distractorDesign : legacyDistractorDesign,
      options,
      answerKey,
    ),
    selfCheck: isPlainObject(base.selfCheck)
      ? base.selfCheck
      : (legacySelfCheck || {}),
    studentExplanation: firstNonEmptyText(base.studentExplanation, item.studentExplanation, explanation),
  };
}

export function normalizeGeneratedItem(item) {
  if (!isPlainObject(item)) return item;

  const {
    answer: _rawAnswer,
    abilityFocus: _legacyAbilityFocus,
    correctAnswer: _rawCorrectAnswer,
    correctReason: _legacyCorrectReason,
    distractorDesign: _legacyDistractorDesign,
    key: _rawKey,
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

  const questionType = firstNonEmptyText(item.questionType, item.itemType);
  const hasQuestionType = questionType !== "";
  const rawOptionsProvided = Object.prototype.hasOwnProperty.call(item, "options");
  const options = normalizeOptions(item.options);
  const shouldNormalizeAsChoice = hasQuestionType ? isChoiceLikeQuestionType(questionType) : true;
  const answer = shouldNormalizeAsChoice
    ? normalizeAnswerValue(firstNonEmptyText(item.answer, item.correctAnswer, item.key), options)
    : firstNonEmptyText(item.answer, item.correctAnswer, item.key);
  const correctAnswer = shouldNormalizeAsChoice
    ? normalizeAnswerValue(item.correctAnswer, options)
    : firstNonEmptyText(item.correctAnswer);
  const normalizedItem = {
    ...canonicalItem,
    question,
    answer,
    explanation,
    qualityMeta: normalizeQualityMeta(item, explanation, options, answer),
  };

  if (!hasQuestionType || shouldDisplayOptionsForQuestionType(questionType) || (rawOptionsProvided && options.length > 0)) {
    normalizedItem.options = options;
  }

  if (firstNonEmptyText(item.correctAnswer)) {
    normalizedItem.correctAnswer = correctAnswer;
  }

  return normalizedItem;
}

export function normalizeGeneratedItems(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => normalizeGeneratedItem(item));
}
