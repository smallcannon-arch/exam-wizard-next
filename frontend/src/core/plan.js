// 統一配題表：每列 = { questionType, count, score }。
// 由配題表直接導出整卷的題型序列與配分序列。純函式，不依賴 DOM。
import { interleaveByCounts } from "./distribute.js";

function asText(value, fallback = "") {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function normalizePlanRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      questionType: asText(row?.questionType),
      count: toPositiveInteger(row?.count),
      score: toPositiveInteger(row?.score),
    }))
    .filter((row) => row.questionType && row.count > 0 && row.score > 0);
}

export function getPlanTotals(rows) {
  const normalized = normalizePlanRows(rows);
  return {
    totalItems: normalized.reduce((sum, row) => sum + row.count, 0),
    totalScore: normalized.reduce((sum, row) => sum + row.count * row.score, 0),
  };
}

export function validatePlan(rows, totalScore = null) {
  const normalized = normalizePlanRows(rows);

  if (normalized.length === 0) {
    return { ok: false, error: "請至少新增一列有效配題（題型、題數、配分都要填）。" };
  }

  const { totalItems, totalScore: planScore } = getPlanTotals(normalized);
  const expected = Number(totalScore);

  if (Number.isFinite(expected) && planScore !== expected) {
    return { ok: false, error: `配題表合計 ${planScore} 分，與全卷總分 ${expected} 分不符。` };
  }

  return { ok: true, totalItems, totalScore: planScore };
}

export function buildPlanSequences(rows) {
  const normalized = normalizePlanRows(rows);
  const order = interleaveByCounts(normalized.map((row, index) => ({ key: index, count: row.count })));

  return {
    questionTypeSequence: order.map((index) => normalized[index].questionType),
    scoreSequence: order.map((index) => normalized[index].score),
  };
}
