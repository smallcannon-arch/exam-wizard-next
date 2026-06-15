import { DEFAULT_EXAM_CONFIG, toPositiveInteger } from "./schema.js";
import { interleaveByCounts } from "./distribute.js";

function normalizePeriodCount(value) {
  return toPositiveInteger(value, 1);
}

export function getTotalScoreUnits({
  totalScore = DEFAULT_EXAM_CONFIG.totalScore,
  unitScore = DEFAULT_EXAM_CONFIG.unitScore,
} = {}) {
  const normalizedTotalScore = toPositiveInteger(totalScore, null);
  const normalizedUnitScore = toPositiveInteger(unitScore, null);

  if (normalizedTotalScore === null) {
    return { ok: false, error: "總分必須是正整數。" };
  }

  if (normalizedUnitScore === null) {
    return { ok: false, error: "每個計分單位分數必須是正整數。" };
  }

  if (normalizedTotalScore % normalizedUnitScore !== 0) {
    return {
      ok: false,
      error: `總分 ${normalizedTotalScore} 無法被每個計分單位 ${normalizedUnitScore} 分整除。`,
    };
  }

  return {
    ok: true,
    totalScore: normalizedTotalScore,
    unitScore: normalizedUnitScore,
    totalScoreUnits: normalizedTotalScore / normalizedUnitScore,
  };
}

export function allocateObjectivePlans({
  objectives,
  totalScore = DEFAULT_EXAM_CONFIG.totalScore,
  unitScore = DEFAULT_EXAM_CONFIG.unitScore,
} = {}) {
  if (!Array.isArray(objectives) || objectives.length === 0) {
    return { ok: false, plans: [], error: "至少需要 1 個學習目標。" };
  }

  const unitResult = getTotalScoreUnits({ totalScore, unitScore });

  if (!unitResult.ok) {
    return { ok: false, plans: [], error: unitResult.error };
  }

  const { totalScoreUnits } = unitResult;

  if (objectives.length > totalScoreUnits) {
    return {
      ok: false,
      plans: [],
      error: `學習目標數 ${objectives.length} 大於可分配計分單位數 ${totalScoreUnits}。請合併目標或調整每個計分單位分數。`,
    };
  }

  const normalizedObjectives = objectives.map((objective, index) => ({
    ...objective,
    objectiveId: objective.objectiveId || `O-${String(index + 1).padStart(3, "0")}`,
    periodCount: normalizePeriodCount(objective.periodCount),
  }));

  const fixedOneEach = normalizedObjectives.map((objective) => ({
    objectiveId: objective.objectiveId,
    targetUnitCount: 1,
    periodCount: objective.periodCount,
    fraction: 0,
  }));

  let remainingUnits = totalScoreUnits - normalizedObjectives.length;
  const totalPeriods = normalizedObjectives.reduce(
    (sum, objective) => sum + objective.periodCount,
    0,
  );

  const quotaRows = fixedOneEach.map((row) => {
    const exactExtra = totalPeriods > 0
      ? (remainingUnits * row.periodCount) / totalPeriods
      : 0;

    const integerExtra = Math.floor(exactExtra);

    return {
      ...row,
      targetUnitCount: row.targetUnitCount + integerExtra,
      fraction: exactExtra - integerExtra,
    };
  });

  const usedUnits = quotaRows.reduce((sum, row) => sum + row.targetUnitCount, 0);
  remainingUnits = totalScoreUnits - usedUnits;

  const sortedByFraction = [...quotaRows].sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    if (b.periodCount !== a.periodCount) return b.periodCount - a.periodCount;
    return a.objectiveId.localeCompare(b.objectiveId);
  });

  for (let index = 0; index < remainingUnits; index += 1) {
    sortedByFraction[index % sortedByFraction.length].targetUnitCount += 1;
  }

  const countByObjectiveId = new Map(
    sortedByFraction.map((row) => [row.objectiveId, row.targetUnitCount]),
  );

  const plans = normalizedObjectives.map((objective) => {
    const targetUnitCount = countByObjectiveId.get(objective.objectiveId) ?? 1;

    return {
      objectiveId: objective.objectiveId,
      targetUnitCount,
      targetScore: targetUnitCount * unitScore,
      locked: false,
      note: "",
    };
  });

  return { ok: true, plans };
}

export function summarizeScoreByObjective(items = []) {
  const summary = new Map();

  for (const item of items) {
    const objectiveId = item?.primaryObjectiveId || item?.objectiveIds?.[0];

    if (!objectiveId) continue;

    const previous = summary.get(objectiveId) || {
      objectiveId,
      unitCount: 0,
      score: 0,
    };

    previous.unitCount += 1;
    previous.score += Number(item.score) || 0;

    summary.set(objectiveId, previous);
  }

  return [...summary.values()].sort((a, b) =>
    a.objectiveId.localeCompare(b.objectiveId),
  );
}

// ===== 自訂配分方案 scorePlan =====
// 解析「配分方案」輸入，例如：2分×35題, 3分×10題 / 2x35, 3*10 / 2:35
export function parseScorePlan(input) {
  return String(input || "")
    .split(/[\n,，;；]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const numbers = segment.match(/\d+/g) || [];
      const score = Number(numbers[0]);
      const count = Number(numbers[1]);
      return { score, count };
    })
    .filter(
      (row) =>
        Number.isInteger(row.score) && row.score > 0 &&
        Number.isInteger(row.count) && row.count > 0,
    )
    .map((row) => ({ score: row.score, count: row.count, subtotal: row.score * row.count }));
}

export function getScorePlanTotals(plan) {
  const rows = Array.isArray(plan) ? plan : [];
  return {
    totalItems: rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    totalScore: rows.reduce(
      (sum, row) => sum + (Number(row.subtotal) || (Number(row.score) * Number(row.count)) || 0),
      0,
    ),
  };
}

export function validateScorePlan(plan, totalScore = null) {
  if (!Array.isArray(plan) || plan.length === 0) {
    return { ok: false, error: "配分方案是空的，請輸入例如 2分×35題, 3分×10題。" };
  }

  const { totalItems, totalScore: planScore } = getScorePlanTotals(plan);

  if (totalItems <= 0) {
    return { ok: false, error: "配分方案題數為 0。" };
  }

  const expected = Number(totalScore);
  if (Number.isFinite(expected) && planScore !== expected) {
    return { ok: false, error: `配分方案總分 ${planScore} 不等於全卷總分 ${expected}。` };
  }

  return { ok: true, totalItems, totalScore: planScore };
}

export function buildScoreSequence(plan) {
  const rows = Array.isArray(plan) ? plan : [];
  return interleaveByCounts(
    rows.map((row) => ({ key: Number(row.score), count: Number(row.count) })),
  ).map(Number);
}

// 依節數權重，把 totalUnits 個題目名額分配到各目標（每目標至少 1 題）。
export function allocateUnitsByPeriod({ objectives, totalUnits } = {}) {
  if (!Array.isArray(objectives) || objectives.length === 0) {
    return { ok: false, counts: [], error: "至少需要 1 個學習目標。" };
  }

  const normalizedTotal = toPositiveInteger(totalUnits, null);
  if (normalizedTotal === null) {
    return { ok: false, counts: [], error: "題目總數必須是正整數。" };
  }

  if (objectives.length > normalizedTotal) {
    return {
      ok: false,
      counts: [],
      error: `學習目標數 ${objectives.length} 大於題目總數 ${normalizedTotal}。請合併目標或增加題數。`,
    };
  }

  const normalizedObjectives = objectives.map((objective, index) => ({
    objectiveId: objective.objectiveId || `O-${String(index + 1).padStart(3, "0")}`,
    periodCount: normalizePeriodCount(objective.periodCount),
  }));

  const totalPeriods = normalizedObjectives.reduce((sum, objective) => sum + objective.periodCount, 0);
  let remainingUnits = normalizedTotal - normalizedObjectives.length;

  const rows = normalizedObjectives.map((objective) => {
    const exactExtra = totalPeriods > 0 ? (remainingUnits * objective.periodCount) / totalPeriods : 0;
    const integerExtra = Math.floor(exactExtra);
    return {
      objectiveId: objective.objectiveId,
      periodCount: objective.periodCount,
      targetUnitCount: 1 + integerExtra,
      fraction: exactExtra - integerExtra,
    };
  });

  const usedUnits = rows.reduce((sum, row) => sum + row.targetUnitCount, 0);
  remainingUnits = normalizedTotal - usedUnits;

  const byFraction = [...rows].sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    if (b.periodCount !== a.periodCount) return b.periodCount - a.periodCount;
    return a.objectiveId.localeCompare(b.objectiveId);
  });

  for (let index = 0; index < remainingUnits; index += 1) {
    byFraction[index % byFraction.length].targetUnitCount += 1;
  }

  return {
    ok: true,
    counts: rows.map((row) => ({ objectiveId: row.objectiveId, targetUnitCount: row.targetUnitCount })),
  };
}
