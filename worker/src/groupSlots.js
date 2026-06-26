function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toPositiveInteger(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function normalizeSafeText(value, fallback = "") {
  return hasText(value) ? String(value).trim() : fallback;
}

function isGroupQuestionTypeValue(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return [
    "proficiency",
    "scenario",
    "scenario_group",
    "group",
    "tasa",
    "\u5b78\u529b",
    "\u6aa2\u6e2c",
    "\u60c5\u5883",
    "\u984c\u7d44",
  ].some((term) => text.includes(term));
}

function deriveGroupId(parentItemId, parentPosition) {
  const itemId = normalizeSafeText(parentItemId, `slot-${parentPosition}`);
  const numericSuffix = itemId.match(/(\d+)$/);
  if (numericSuffix) return `G-${numericSuffix[1]}`;
  return `G-${itemId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48) || parentPosition}`;
}

function buildBaseExpectedSlot(slot, parentPosition, expectedItemIndex) {
  return {
    itemId: normalizeSafeText(slot?.itemId, `Q-${String(parentPosition).padStart(3, "0")}`),
    questionType: normalizeSafeText(slot?.questionType || slot?.itemType),
    itemType: normalizeSafeText(slot?.itemType),
    score: Number(slot?.score) || 0,
    primaryObjectiveId: normalizeSafeText(slot?.primaryObjectiveId),
    objectiveIds: Array.isArray(slot?.objectiveIds) ? slot.objectiveIds.filter(hasText).map((value) => String(value).trim()) : [],
    cognitiveLevel: normalizeSafeText(slot?.cognitiveLevel),
    chineseDimension: normalizeSafeText(slot?.chineseDimension),
    chineseSubcategory: normalizeSafeText(slot?.chineseSubcategory),
    expectedItemIndex,
    parentSlotIndex: parentPosition,
  };
}

export function expandGroupSlot(slot, parentPosition = 1, startItemIndex = 1) {
  if (!isPlainObject(slot)) {
    return { ok: false, error: "group slot must be an object." };
  }

  if (!slot.isGroup) {
    return {
      ok: true,
      expectedSlots: [buildBaseExpectedSlot(slot, parentPosition, startItemIndex)],
      expectedItemCount: 1,
      groupChildCount: 0,
    };
  }

  if (!isGroupQuestionTypeValue(slot.questionType || slot.itemType)) {
    return { ok: false, error: "group slot questionType is not supported." };
  }

  const subScores = Array.isArray(slot.subScores)
    ? slot.subScores.map((score) => toPositiveInteger(score))
    : [];
  const subCount = toPositiveInteger(slot.subCount);
  if (!subCount) {
    return { ok: false, error: "group slot subCount must be a positive integer." };
  }
  if (subScores.length > 0 && (subScores.length !== subCount || subScores.some((score) => score === null))) {
    return { ok: false, error: "group slot subScores must match subCount." };
  }

  const parentItemId = normalizeSafeText(slot.itemId, `Q-${String(parentPosition).padStart(3, "0")}`);
  const groupId = normalizeSafeText(slot.groupId, deriveGroupId(parentItemId, parentPosition));
  const expectedSlots = [];
  for (let childIndex = 1; childIndex <= subCount; childIndex += 1) {
    expectedSlots.push({
      ...buildBaseExpectedSlot(slot, parentPosition, startItemIndex + childIndex - 1),
      itemId: `${parentItemId}-${childIndex}`,
      parentItemId,
      groupId,
      childIndex,
      subCount,
      subScore: subScores[childIndex - 1] || 0,
      score: subScores[childIndex - 1] || Number(slot.score) || 0,
      isGroupChild: true,
    });
  }

  return {
    ok: true,
    expectedSlots,
    expectedItemCount: expectedSlots.length,
    groupChildCount: expectedSlots.length,
  };
}

export function expandExpectedGenerationSlots(entries = [], options = {}) {
  if (!Array.isArray(entries)) {
    return { ok: false, error: "expected slots must be an array." };
  }

  const startItemIndex = toPositiveInteger(options.startItemIndex) || 1;
  const expectedSlots = [];
  let nextItemIndex = startItemIndex;
  let groupChildCount = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const expanded = expandGroupSlot(entries[index], index + 1, nextItemIndex);
    if (!expanded.ok) {
      return {
        ok: false,
        error: expanded.error,
        parentSlotIndex: index + 1,
      };
    }
    expectedSlots.push(...expanded.expectedSlots);
    nextItemIndex += expanded.expectedItemCount;
    groupChildCount += expanded.groupChildCount;
  }

  return {
    ok: true,
    parentSlotCount: entries.length,
    expectedItemCount: expectedSlots.length,
    groupChildCount,
    expectedSlots,
  };
}

export function getExpectedGeneratedItemCount(entries = []) {
  const expanded = expandExpectedGenerationSlots(entries);
  return expanded.ok ? expanded.expectedItemCount : null;
}
