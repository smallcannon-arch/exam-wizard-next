import { getTotalScoreUnits, summarizeScoreByObjective } from "./scoring.js";
import { hasText, isPlainObject } from "./schema.js";

export function validateObjective(objective) {
  const errors = [];
  if (!isPlainObject(objective)) errors.push("學習目標必須是物件。");
  if (!hasText(objective?.objectiveId)) errors.push("缺少 objectiveId。");
  if (!hasText(objective?.text)) errors.push("缺少目標文字。");
  return { ok: errors.length === 0, errors };
}

export function validateItem(item) {
  const errors = [];
  if (!isPlainObject(item)) errors.push("題目必須是物件。");
  if (!hasText(item?.itemId)) errors.push("缺少 itemId。");
  if (!hasText(item?.questionType)) errors.push("缺少 questionType。");
  if (!hasText(item?.question)) errors.push("缺少 question。");
  if (!hasText(item?.answer)) errors.push("缺少 answer。");
  if (!Array.isArray(item?.objectiveIds) || item.objectiveIds.length === 0) errors.push("缺少 objectiveIds。");
  if (!Number.isFinite(Number(item?.score)) || Number(item.score) <= 0) errors.push("score 必須是正數。");
  return { ok: errors.length === 0, errors };
}

export function validateExam({
  objectives = [],
  objectivePlans = [],
  items = [],
  totalScore = 100,
  unitScore = 2,
} = {}) {
  const errors = [];
  const warnings = [];

  const unitResult = getTotalScoreUnits({ totalScore, unitScore });

if (!unitResult.ok) {
  errors.push(unitResult.error);
}
  for (const objective of objectives) {
    const result = validateObjective(objective);
    if (!result.ok) errors.push(...result.errors.map((error) => `${objective?.objectiveId ?? "未知目標"}：${error}`));
  }

  for (const item of items) {
    const result = validateItem(item);
    if (!result.ok) errors.push(...result.errors.map((error) => `${item?.itemId ?? "未知題目"}：${error}`));
  }

  const totalItemScore = items.reduce((sum, item) => sum + (Number(item?.score) || 0), 0);
  if (items.length > 0 && totalItemScore !== totalScore) {
    errors.push(`題目總分 ${totalItemScore} 不等於全卷總分 ${totalScore}。`);
  }

  const summary = summarizeScoreByObjective(items);
  const scoreByObjectiveId = new Map(summary.map((row) => [row.objectiveId, row.score]));

  for (const plan of objectivePlans) {
    const actualScore = scoreByObjectiveId.get(plan.objectiveId) ?? 0;
    if (actualScore !== plan.targetScore) {
      warnings.push(`${plan.objectiveId} 目前 ${actualScore} 分，規劃 ${plan.targetScore} 分。`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary,
    totalItemScore,
  };
}
