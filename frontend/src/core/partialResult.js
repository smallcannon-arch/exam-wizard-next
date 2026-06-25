const PARTIAL_STATUSES = new Set(["partial"]);

export const MISSING_SLOT_MESSAGE = "此題未能生成，可於後續補齊。";
export const PARTIAL_EXPORT_BLOCK_MESSAGE = "這份試卷仍有待補題位，暫不匯出正式卷。請先補齊後再輸出。";

function safePositiveInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function safeNonNegativeInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeErrorCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isPartialGenerationResult(result = {}) {
  return result?.partial === true || PARTIAL_STATUSES.has(String(result?.status || "").toLowerCase());
}

export function getMissingItemTeacherMessage() {
  return MISSING_SLOT_MESSAGE;
}

export function getPartialExportBlockMessage() {
  return PARTIAL_EXPORT_BLOCK_MESSAGE;
}

export function shouldBlockPartialExport(partialResult = null) {
  return isPartialGenerationResult(partialResult);
}

export function normalizeMissingItems(missingItems = [], { requestedItemCount = 0 } = {}) {
  if (!Array.isArray(missingItems)) return [];
  const maxIndex = safeNonNegativeInteger(requestedItemCount);
  const seen = new Set();
  const normalized = [];

  for (const entry of missingItems) {
    const itemIndex = safePositiveInteger(entry?.itemIndex);
    if (!itemIndex || (maxIndex > 0 && itemIndex > maxIndex) || seen.has(itemIndex)) continue;
    seen.add(itemIndex);
    normalized.push({
      itemIndex,
      batchNumber: safePositiveInteger(entry?.batchNumber),
      errorCode: normalizeErrorCode(entry?.errorCode),
    });
  }

  return normalized.sort((a, b) => a.itemIndex - b.itemIndex);
}

export function normalizePartialResult(result = {}, { requestedItemCount = 0 } = {}) {
  if (!isPartialGenerationResult(result)) return null;

  const requested = safeNonNegativeInteger(result.requestedItemCount) || safeNonNegativeInteger(requestedItemCount);
  const completed = safeNonNegativeInteger(result.completedItemCount || result.items?.length);
  const missingItems = normalizeMissingItems(result.missingItems, { requestedItemCount: requested });
  const missingCount = missingItems.length || Math.max(0, requested - completed);

  return {
    partial: true,
    requestedItemCount: requested,
    completedItemCount: completed,
    missingCount,
    missingItems,
  };
}

export function getPartialResultSummary(partialResult = {}) {
  const requested = safeNonNegativeInteger(partialResult.requestedItemCount);
  const completed = safeNonNegativeInteger(partialResult.completedItemCount);
  const missingCount = safeNonNegativeInteger(
    partialResult.missingCount ?? (Array.isArray(partialResult.missingItems) ? partialResult.missingItems.length : 0),
  );

  return {
    requested,
    completed,
    missingCount,
    title: `已完成 ${completed} / ${requested} 題，${missingCount} 題待補`,
    body: "可先檢視已完成題目；待補題位已保留，可於後續補齊。",
  };
}

function parentItemId(itemId) {
  const value = typeof itemId === "string" ? itemId.trim() : "";
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length > 2 && /^\d+$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join("-");
  }
  return value;
}

function itemSlotIndex(item, slots = []) {
  const explicitIndex = safePositiveInteger(item?.itemIndex);
  if (explicitIndex) return explicitIndex;

  const parentId = parentItemId(item?.itemId);
  const slotIndex = slots.findIndex((slot) => String(slot?.itemId || "").trim() === parentId);
  return slotIndex >= 0 ? slotIndex + 1 : null;
}

export function getSlotsForGeneratedItems({ slots = [], items = [] } = {}) {
  if (!Array.isArray(slots) || !Array.isArray(items)) return [];
  const indexes = new Set();
  for (const item of items) {
    const index = itemSlotIndex(item, slots);
    if (index) indexes.add(index);
  }
  return slots.filter((_, index) => indexes.has(index + 1));
}

export function buildPartialSlotView({ slots = [], items = [], missingItems = [] } = {}) {
  const missingByIndex = new Map(normalizeMissingItems(missingItems, { requestedItemCount: slots.length })
    .map((entry) => [entry.itemIndex, entry]));
  const itemsByIndex = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const index = itemSlotIndex(item, slots);
    if (!index) continue;
    if (!itemsByIndex.has(index)) itemsByIndex.set(index, []);
    itemsByIndex.get(index).push(item);
  }

  return slots.map((slot, index) => {
    const itemIndex = index + 1;
    const missingItem = missingByIndex.get(itemIndex);
    if (missingItem) {
      return {
        type: "missing",
        itemIndex,
        slot,
        missingItem,
        message: getMissingItemTeacherMessage(),
      };
    }
    return {
      type: "item",
      itemIndex,
      slot,
      items: itemsByIndex.get(itemIndex) || [],
    };
  }).filter((entry) => entry.type === "missing" || entry.items.length > 0);
}
