import { hasText, isPlainObject, uniqueStrings } from "./schema.js";

export function normalizeRegeneratedItem({ originalItem, regeneratedItem }) {
  if (!isPlainObject(originalItem)) {
    return { ok: false, error: "originalItem 必須是物件。" };
  }

  if (!isPlainObject(regeneratedItem)) {
    return { ok: false, error: "regeneratedItem 必須是物件。" };
  }

  if (!hasText(originalItem.itemId)) {
    return { ok: false, error: "originalItem.itemId 必須是非空白字串。" };
  }

  const normalized = {
    ...originalItem,
    ...regeneratedItem,
    itemId: originalItem.itemId,
    groupId: typeof originalItem.groupId === "string" ? originalItem.groupId : "",
    objectiveIds: uniqueStrings(originalItem.objectiveIds),
    primaryObjectiveId: originalItem.primaryObjectiveId || originalItem.objectiveIds?.[0] || "",
    secondaryObjectiveIds: uniqueStrings(originalItem.secondaryObjectiveIds),
    score: originalItem.score,
    questionType: originalItem.questionType,
    reviewFlags: uniqueStrings(regeneratedItem.reviewFlags),
  };

  if (hasText(normalized.groupId)) {
    normalized.stimulus = typeof originalItem.stimulus === "string" ? originalItem.stimulus : "";
  }

  return { ok: true, item: normalized };
}

export function replaceItemById({ items, itemId, regeneratedItem }) {
  if (!Array.isArray(items)) {
    return { ok: false, items: [], error: "items 必須是陣列。" };
  }

  if (!hasText(itemId)) {
    return { ok: false, items, error: "itemId 必須是非空白字串。" };
  }

  const index = items.findIndex((item) => item?.itemId === itemId);
  if (index < 0) {
    return { ok: false, items, error: `找不到題號 ${itemId}。` };
  }

  const normalized = normalizeRegeneratedItem({
    originalItem: items[index],
    regeneratedItem,
  });

  if (!normalized.ok) {
    return { ok: false, items, error: normalized.error };
  }

  return {
    ok: true,
    item: normalized.item,
    items: items.map((item, currentIndex) => (currentIndex === index ? normalized.item : item)),
  };
}
