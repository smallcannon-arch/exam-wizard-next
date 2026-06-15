// 題位制的生成後檢核：題型與配分需與題位相符；每題須指派有效的學習目標；
// 所有學習目標都要被覆蓋；題數與總分需正確。LLM 回傳的順序即卷面順序。
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getPrimaryObjective(item) {
  if (hasText(item?.primaryObjectiveId)) return item.primaryObjectiveId.trim();
  if (Array.isArray(item?.objectiveIds)) {
    const first = item.objectiveIds.find((id) => hasText(id));
    if (first) return first.trim();
  }
  return "";
}

export function validateGeneratedPaper({ slots = [], objectives = [], items = [] } = {}) {
  const errors = [];

  if (!Array.isArray(slots) || slots.length === 0) {
    return { ok: false, errors: ["缺少題位資料，請先建立藍圖。"] };
  }
  if (!Array.isArray(items)) {
    return { ok: false, errors: ["AI 回傳 items 不是陣列。"] };
  }

  const objectiveIdSet = new Set(objectives.map((objective) => normalizeId(objective?.objectiveId)).filter(Boolean));
  const slotById = new Map(slots.map((slot) => [normalizeId(slot.itemId), slot]));
  const seen = new Set();
  const covered = new Set();

  for (const item of items) {
    if (!isPlainObject(item)) {
      errors.push("AI 回傳某題不是物件。");
      continue;
    }

    const id = normalizeId(item.itemId);
    if (!id) {
      errors.push("某題缺少 itemId。");
      continue;
    }

    const slot = slotById.get(id);
    if (!slot) {
      errors.push(`${id}：不在題位清單內。`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${id}：AI 回傳重複題號。`);
      continue;
    }
    seen.add(id);

    if (normalizeId(item.questionType) !== normalizeId(slot.questionType)) {
      errors.push(`${id}：題型應為「${slot.questionType}」，不可更動。`);
    }
    if (Number(item.score) !== Number(slot.score)) {
      errors.push(`${id}：配分應為 ${slot.score} 分，不可更動。`);
    }
    if (!hasText(item.question)) {
      errors.push(`${id}：缺少 question。`);
    }
    if (!hasText(item.answer)) {
      errors.push(`${id}：缺少 answer。`);
    }

    const primary = getPrimaryObjective(item);
    if (!primary) {
      errors.push(`${id}：缺少對應學習目標。`);
    } else if (objectiveIdSet.size > 0 && !objectiveIdSet.has(primary)) {
      errors.push(`${id}：對應目標 ${primary} 不在學習目標清單內。`);
    }

    if (Array.isArray(item.objectiveIds)) {
      for (const objectiveId of item.objectiveIds) {
        const normalized = normalizeId(objectiveId);
        if (objectiveIdSet.has(normalized)) covered.add(normalized);
      }
    }
    if (objectiveIdSet.has(primary)) covered.add(primary);
  }

  for (const slot of slots) {
    if (!seen.has(normalizeId(slot.itemId))) {
      errors.push(`${slot.itemId}：AI 未回傳此題。`);
    }
  }

  for (const objectiveId of objectiveIdSet) {
    if (!covered.has(objectiveId)) {
      errors.push(`學習目標 ${objectiveId} 未被任何題目覆蓋。`);
    }
  }

  if (items.length !== slots.length) {
    errors.push(`AI 回傳題數 ${items.length}，與題位數 ${slots.length} 不一致。`);
  }

  return { ok: errors.length === 0, errors };
}
