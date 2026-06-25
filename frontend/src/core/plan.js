// 統一配題表：每列 = { questionType, count, score }。
// 由配題表直接導出整卷的題型序列與配分序列。純函式，不依賴 DOM。
import { CHOICE_ONLY_STOPGAP_MESSAGE, isSupportedGenerationQuestionType } from "./questionTypes.js";

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
    .map((row) => {
      const isGroup = !!row?.isGroup;
      const subScores = Array.isArray(row?.subScores) ? row.subScores.map(Number).filter((x) => x > 0) : [];
      const groupCount = toPositiveInteger(row?.groupCount || 1);
      return {
        questionType: asText(row?.questionType),
        count: toPositiveInteger(row?.count),
        score: toPositiveInteger(row?.score),
        isGroup,
        groupCount,
        subScores,
      };
    })
    .filter((row) => {
      if (!row.questionType || row.count <= 0) return false;
      if (row.isGroup) {
        const groupCount = Math.min(row.count, row.groupCount);
        const groupScore = row.subScores.reduce((sum, s) => sum + s, 0);
        const singleCount = row.count - groupCount;
        const total = (groupCount * groupScore) + (singleCount * row.score);
        return total > 0;
      }
      return row.score > 0;
    });
}

export function getPlanTotals(rows) {
  const normalized = normalizePlanRows(rows);
  let totalItems = 0;
  let totalScore = 0;

  for (const row of normalized) {
    totalItems += row.count;
    if (row.isGroup) {
      const groupCount = Math.min(row.count, row.groupCount);
      const singleCount = Math.max(0, row.count - groupCount);
      const groupScore = row.subScores.reduce((sum, s) => sum + s, 0);
      totalScore += (groupCount * groupScore) + (singleCount * row.score);
    } else {
      totalScore += row.count * row.score;
    }
  }

  return { totalItems, totalScore };
}

export function validatePlan(rows, totalScore = null) {
  const normalized = normalizePlanRows(rows);

  if (normalized.length === 0) {
    return { ok: false, error: "請至少新增一列有效配題（題型、題數、配分都要填）。" };
  }

  const unsupportedRow = normalized.find((row) => !isSupportedGenerationQuestionType(row.questionType) || row.isGroup);
  if (unsupportedRow) {
    return { ok: false, error: `${CHOICE_ONLY_STOPGAP_MESSAGE} 請將配題表調整為「選擇題」單題後再建立藍圖。` };
  }

  const { totalItems, totalScore: planScore } = getPlanTotals(normalized);
  const expected = Number(totalScore);

  // 只有在明確傳入正的總分時才比對；未傳（總分由配題表自行決定）則略過。
  if (Number.isFinite(expected) && expected > 0 && planScore !== expected) {
    return { ok: false, error: `配題表合計 ${planScore} 分，與全卷總分 ${expected} 分不符。` };
  }

  return { ok: true, totalItems, totalScore: planScore };
}

export function buildPlanSequences(rows) {
  const normalized = normalizePlanRows(rows);
  const questionTypeSequence = [];
  const scoreSequence = [];
  const configSequence = [];

  for (const row of normalized) {
    const groupCount = row.isGroup ? Math.min(row.count, row.groupCount) : 0;
    const singleCount = row.count - groupCount;
    const groupScore = row.isGroup ? row.subScores.reduce((sum, s) => sum + s, 0) : 0;

    // 先推入題組題位
    for (let index = 0; index < groupCount; index += 1) {
      questionTypeSequence.push(row.questionType);
      scoreSequence.push(groupScore);
      configSequence.push({
        isGroup: true,
        subScores: row.subScores,
      });
    }

    // 再推入單題題位
    for (let index = 0; index < singleCount; index += 1) {
      questionTypeSequence.push(row.questionType);
      scoreSequence.push(row.score);
      configSequence.push({
        isGroup: false,
        subScores: [],
      });
    }
  }

  return { questionTypeSequence, scoreSequence, configSequence };
}
