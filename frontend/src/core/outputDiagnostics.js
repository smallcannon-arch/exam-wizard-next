import { toStudentItem } from "./itemViews.js";

export const DEFAULT_OUTPUT_BUDGET = Object.freeze({
  rawOutputLength: 3200,
  studentItemLength: 900,
  qualityMetaLength: 1400,
  distractorDesignLength: 900,
  teacherExplanationLength: 80,
  correctReasonLength: 80,
  perDistractorLength: 260,
  paperRawOutputLengthPerItem: 3200,
  paperQualityMetaLengthPerItem: 1400,
});

export const OUTPUT_BUDGET_WARNINGS = Object.freeze({
  RAW_OUTPUT_OVER_BUDGET: "RAW_OUTPUT_OVER_BUDGET",
  STUDENT_ITEM_OVER_BUDGET: "STUDENT_ITEM_OVER_BUDGET",
  QUALITY_META_OVER_BUDGET: "QUALITY_META_OVER_BUDGET",
  DISTRACTOR_DESIGN_OVER_BUDGET: "DISTRACTOR_DESIGN_OVER_BUDGET",
  TEACHER_EXPLANATION_OVER_BUDGET: "TEACHER_EXPLANATION_OVER_BUDGET",
  CORRECT_REASON_OVER_BUDGET: "CORRECT_REASON_OVER_BUDGET",
  SINGLE_DISTRACTOR_OVER_BUDGET: "SINGLE_DISTRACTOR_OVER_BUDGET",
  PAPER_RAW_OUTPUT_OVER_BUDGET: "PAPER_RAW_OUTPUT_OVER_BUDGET",
  PAPER_QUALITY_META_OVER_BUDGET: "PAPER_QUALITY_META_OVER_BUDGET",
  TOO_MANY_OVER_BUDGET_ITEMS: "TOO_MANY_OVER_BUDGET_ITEMS",
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeBudget(budget = {}) {
  return { ...DEFAULT_OUTPUT_BUDGET, ...budget };
}

function textLength(value) {
  return typeof value === "string" ? value.length : 0;
}

function stableStringify(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return JSON.stringify(value) || "";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) || "null").join(",")}]`;
  }

  const entries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item) || "null"}`).join(",")}}`;
}

function jsonLength(value) {
  if (value === undefined || value === null) return 0;
  return stableStringify(value).length;
}

function rawLength(value) {
  if (value === undefined || value === null) return 0;
  return typeof value === "string" ? value.length : jsonLength(value);
}

function overBudgetWarnings(metrics, budget) {
  const warnings = [];
  if (metrics.rawOutputLength > budget.rawOutputLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.RAW_OUTPUT_OVER_BUDGET);
  }
  if (metrics.studentItemLength > budget.studentItemLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.STUDENT_ITEM_OVER_BUDGET);
  }
  if (metrics.qualityMetaLength > budget.qualityMetaLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.QUALITY_META_OVER_BUDGET);
  }
  if (metrics.distractorDesignLength > budget.distractorDesignLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.DISTRACTOR_DESIGN_OVER_BUDGET);
  }
  if (metrics.teacherExplanationLength > budget.teacherExplanationLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.TEACHER_EXPLANATION_OVER_BUDGET);
  }
  if (metrics.correctReasonLength > budget.correctReasonLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.CORRECT_REASON_OVER_BUDGET);
  }
  if (metrics.maxSingleDistractorLength > budget.perDistractorLength) {
    warnings.push(OUTPUT_BUDGET_WARNINGS.SINGLE_DISTRACTOR_OVER_BUDGET);
  }
  return warnings;
}

function maxDistractorLength(distractorDesign) {
  if (!isPlainObject(distractorDesign)) return 0;
  const lengths = Object.values(distractorDesign).map((value) => jsonLength(value));
  return lengths.length ? Math.max(...lengths) : 0;
}

export function createItemOutputDiagnostics({
  rawOutput,
  normalizedItem = {},
  studentItem,
  budget,
} = {}) {
  const effectiveBudget = mergeBudget(budget);
  const qualityMeta = isPlainObject(normalizedItem?.qualityMeta) ? normalizedItem.qualityMeta : null;
  const distractorDesign = isPlainObject(qualityMeta?.distractorDesign) ? qualityMeta.distractorDesign : null;
  const projectedStudentItem = studentItem || toStudentItem(normalizedItem);

  const metrics = {
    itemId: normalizedItem?.itemId || normalizedItem?.questionId || projectedStudentItem?.questionId || "",
    rawOutputLength: rawLength(rawOutput),
    studentItemLength: jsonLength(projectedStudentItem),
    qualityMetaLength: jsonLength(qualityMeta),
    distractorDesignLength: jsonLength(distractorDesign),
    teacherExplanationLength: textLength(qualityMeta?.teacherExplanation),
    correctReasonLength: textLength(qualityMeta?.correctReason),
    maxSingleDistractorLength: maxDistractorLength(distractorDesign),
  };

  const budgetWarnings = overBudgetWarnings(metrics, effectiveBudget);
  return {
    ...metrics,
    overBudget: budgetWarnings.length > 0,
    budgetWarnings,
  };
}

function average(total, count) {
  return count > 0 ? total / count : 0;
}

function sum(items, field) {
  return items.reduce((total, item) => total + (Number(item?.[field]) || 0), 0);
}

export function createPaperOutputDiagnostics(itemDiagnostics = [], { budget } = {}) {
  const diagnostics = Array.isArray(itemDiagnostics) ? itemDiagnostics : [];
  const effectiveBudget = mergeBudget(budget);
  const itemCount = diagnostics.length;
  const totalRawOutputLength = sum(diagnostics, "rawOutputLength");
  const totalStudentItemLength = sum(diagnostics, "studentItemLength");
  const totalQualityMetaLength = sum(diagnostics, "qualityMetaLength");
  const totalDistractorDesignLength = sum(diagnostics, "distractorDesignLength");
  const totalTeacherExplanationLength = sum(diagnostics, "teacherExplanationLength");
  const overBudgetItems = diagnostics
    .filter((item) => item?.overBudget)
    .map((item, index) => item?.itemId || `item-${index + 1}`);

  const budgetWarnings = [];
  if (totalRawOutputLength > effectiveBudget.paperRawOutputLengthPerItem * itemCount) {
    budgetWarnings.push(OUTPUT_BUDGET_WARNINGS.PAPER_RAW_OUTPUT_OVER_BUDGET);
  }
  if (totalQualityMetaLength > effectiveBudget.paperQualityMetaLengthPerItem * itemCount) {
    budgetWarnings.push(OUTPUT_BUDGET_WARNINGS.PAPER_QUALITY_META_OVER_BUDGET);
  }
  if (overBudgetItems.length >= 2) {
    budgetWarnings.push(OUTPUT_BUDGET_WARNINGS.TOO_MANY_OVER_BUDGET_ITEMS);
  }

  return {
    itemCount,
    totalRawOutputLength,
    averageRawOutputLength: average(totalRawOutputLength, itemCount),
    totalStudentItemLength,
    averageStudentItemLength: average(totalStudentItemLength, itemCount),
    totalQualityMetaLength,
    averageQualityMetaLength: average(totalQualityMetaLength, itemCount),
    totalDistractorDesignLength,
    averageDistractorDesignLength: average(totalDistractorDesignLength, itemCount),
    totalTeacherExplanationLength,
    averageTeacherExplanationLength: average(totalTeacherExplanationLength, itemCount),
    overBudgetItemCount: overBudgetItems.length,
    overBudgetItems,
    paperOverBudget: budgetWarnings.length > 0,
    budgetWarnings,
  };
}
