// 將題目整理成逐題審核列：題號、題型、配分、對應目標、認知層次。
// 純資料轉換，不依賴 DOM。

function asText(value, fallback = "") {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function objectiveLabel(item) {
  if (Array.isArray(item?.objectiveIds) && item.objectiveIds.length > 0) {
    return item.objectiveIds.filter(Boolean).join("、");
  }
  return asText(item?.primaryObjectiveId, "未標示");
}

export function buildAuditRows(items = []) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    itemId: asText(item?.itemId, "未知題號"),
    questionType: asText(item?.questionType, "未標示"),
    score: Number(item?.score) || 0,
    objectiveIds: objectiveLabel(item),
    cognitiveLevel: asText(item?.cognitiveLevel, "未標示"),
  }));
}
