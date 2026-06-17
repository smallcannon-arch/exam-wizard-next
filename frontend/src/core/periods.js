// 依各學習目標的節數，計算占總教學時數的比例，作為配分依據。純函式。
import { largestRemainder } from "./distribute.js";

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

// 國語科：依「向度比例」把總分分到各向度，再把各向度預算「平均分」給該向度底下的細項目標。
// 兩層最大餘數法：確保向度佔分正確、不受各向度細項數量影響；總和恆等於 totalScore。
// objectives: [{ objectiveId, dimension }]（dimension 應為 字詞短語／句式語法／段篇讀寫，未知者由呼叫端先歸位）。
// ratios: 例 { 字詞短語: 50, 句式語法: 30, 段篇讀寫: 20 }（相對權重即可，會自動正規化）。
// 回傳 Map(objectiveId -> 整數配分)；教師仍可於上層逐項手動覆寫。
export function computeChineseDimensionScores(objectives, totalScore, ratios = {}) {
  const list = Array.isArray(objectives) ? objectives.filter((o) => o && o.objectiveId) : [];
  const scoreMap = new Map(list.map((o) => [o.objectiveId, 0]));
  const total = Number.isInteger(totalScore) && totalScore > 0 ? totalScore : 0;
  if (total === 0 || list.length === 0) return scoreMap;

  // 1) 依向度分組（保序）
  const dimToIds = new Map();
  for (const o of list) {
    const dim = o.dimension || "";
    if (!dimToIds.has(dim)) dimToIds.set(dim, []);
    dimToIds.get(dim).push(o.objectiveId);
  }

  // 2) 向度預算：以向度比例為權重；若全無有效比例（未知向度），退回各向度等權。
  const dims = [...dimToIds.keys()];
  const ratioWeight = (dim) => {
    const r = Number(ratios?.[dim]);
    return Number.isFinite(r) && r > 0 ? r : 0;
  };
  const hasRatio = dims.some((dim) => ratioWeight(dim) > 0);
  const dimWeights = dims.map((dim) => ({ key: dim, weight: hasRatio ? ratioWeight(dim) : 1 }));
  const dimBudgets = new Map(largestRemainder(total, dimWeights).map((row) => [row.key, row.count]));

  // 3) 向度內：細項平均分（最大餘數法）
  for (const dim of dims) {
    const ids = dimToIds.get(dim);
    const budget = dimBudgets.get(dim) || 0;
    const rows = largestRemainder(budget, ids.map((id) => ({ key: id, weight: 1 })));
    for (const row of rows) scoreMap.set(row.key, row.count);
  }

  return scoreMap;
}
