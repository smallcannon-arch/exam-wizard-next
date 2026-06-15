import { DEFAULT_EXAM_CONFIG, toPositiveInteger } from "./schema.js";

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