function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

// 一個 intent 可能同時帶 intentId（如 I-001）與 itemId（如 Q-001），
// 兩者都可作為對照鍵。以 intentId 為主，缺則退回 itemId。
function getIntentKeys(intent) {
  return [normalizeId(intent?.intentId), normalizeId(intent?.itemId)].filter(Boolean);
}

function getCanonicalId(intent) {
  return normalizeId(intent?.intentId) || normalizeId(intent?.itemId);
}

// AI 回傳的題目可能只帶 itemId、只帶 intentId、或兩者皆帶。
function getItemKeys(item) {
  return [normalizeId(item?.intentId), normalizeId(item?.itemId)].filter(Boolean);
}

function hasObjective(item) {
  if (hasText(item?.primaryObjectiveId)) return true;

  if (Array.isArray(item?.objectiveIds)) {
    return item.objectiveIds.some((objectiveId) => hasText(objectiveId));
  }

  return false;
}

function hasValidScore(item) {
  const score = Number(item?.score);
  return Number.isFinite(score) && score > 0;
}

function validateOneItem(item, canonicalId) {
  const errors = [];
  const label = canonicalId || "未知題號";

  if (!isPlainObject(item)) {
    return [`${label}：題目資料不是物件。`];
  }

  if (!hasText(item.question)) {
    errors.push(`${label}：缺少 question。`);
  }

  if (!hasText(item.answer)) {
    errors.push(`${label}：缺少 answer。`);
  }

  if (!hasValidScore(item)) {
    errors.push(`${label}：缺少有效 score。`);
  }

  if (!hasObjective(item)) {
    errors.push(`${label}：缺少對應目標。`);
  }

  if (!hasText(item.questionType)) {
    errors.push(`${label}：缺少 questionType。`);
  }

  return errors;
}

export function validateGeneratedItemsAgainstIntents({ intents = [], items = [] } = {}) {
  const errors = [];

  if (!Array.isArray(intents) || intents.length === 0) {
    return {
      ok: false,
      errors: ["缺少題目藍圖 intents，無法檢查 AI 回傳題目。"],
    };
  }

  if (!Array.isArray(items)) {
    return {
      ok: false,
      errors: ["AI 回傳 items 不是陣列。"],
    };
  }

  // 任一 intent 鍵（intentId 或 itemId）→ 該 intent 的正規 ID。
  const keyToCanonical = new Map();
  const canonicalOrder = [];

  for (const intent of intents) {
    const canonical = getCanonicalId(intent);
    if (!canonical) continue;
    canonicalOrder.push(canonical);
    for (const key of getIntentKeys(intent)) {
      if (!keyToCanonical.has(key)) keyToCanonical.set(key, canonical);
    }
  }

  const matchedByCanonical = new Map();

  for (const item of items) {
    const keys = getItemKeys(item);

    if (keys.length === 0) {
      errors.push("AI 回傳某一題缺少 itemId 或 intentId。");
      continue;
    }

    let canonical = null;
    for (const key of keys) {
      if (keyToCanonical.has(key)) {
        canonical = keyToCanonical.get(key);
        break;
      }
    }

    if (!canonical) {
      errors.push(`${keys[0]}：AI 回傳了藍圖以外的題目。`);
      continue;
    }

    if (matchedByCanonical.has(canonical)) {
      errors.push(`${canonical}：AI 回傳重複題號。`);
      continue;
    }

    matchedByCanonical.set(canonical, item);
  }

  for (const canonical of canonicalOrder) {
    const item = matchedByCanonical.get(canonical);

    if (!item) {
      errors.push(`${canonical}：AI 未回傳此題。`);
      continue;
    }

    errors.push(...validateOneItem(item, canonical));
  }

  if (items.length !== canonicalOrder.length) {
    errors.push(
      `AI 回傳題目數 ${items.length} 題，與藍圖預期 ${canonicalOrder.length} 題不一致。`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
