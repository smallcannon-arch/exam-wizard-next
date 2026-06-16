// 統一配題表：每列 = { questionType, count, score }。
// 由配題表直接導出整卷的題型序列與配分序列。純函式，不依賴 DOM。

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
      const score = isGroup 
        ? subScores.reduce((sum, s) => sum + s, 0)
        : toPositiveInteger(row?.score);
      return {
        questionType: asText(row?.questionType),
        count: toPositiveInteger(row?.count),
        score,
        isGroup,
        subScores,
      };
    })
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

  // 依配題表的列順序分組展開：同題型相鄰（不打散），方便整卷分大題。
  for (const row of normalized) {
    for (let index = 0; index < row.count; index += 1) {
      questionTypeSequence.push(row.questionType);
      scoreSequence.push(row.score);
      configSequence.push({
        isGroup: row.isGroup,
        subScores: row.subScores,
      });
    }
  }

  return { questionTypeSequence, scoreSequence, configSequence };
}
