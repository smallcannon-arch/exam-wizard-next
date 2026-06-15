// 依各學習目標的節數，計算占總教學時數的比例，作為配分依據。純函式。

function toPositiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function computeObjectiveShares(objectives) {
  const list = Array.isArray(objectives) ? objectives : [];
  const rows = list.map((objective) => ({
    objectiveId: objective?.objectiveId || "",
    periodCount: toPositiveInteger(objective?.periodCount, 1),
  }));
  const totalPeriods = rows.reduce((sum, row) => sum + row.periodCount, 0);

  return rows.map((row) => ({
    objectiveId: row.objectiveId,
    periodCount: row.periodCount,
    share: totalPeriods > 0 ? row.periodCount / totalPeriods : 0,
  }));
}

export function formatPercent(share) {
  return `${Math.round((Number(share) || 0) * 100)}%`;
}
