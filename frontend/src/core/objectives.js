// 將 AI 提取的學習目標正規化，並轉成第②步目標欄位的文字格式（目標文字｜節數）。
// 純資料轉換，不依賴 DOM。

function asText(value, fallback = "") {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function toPositiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function normalizeExtractedObjectives(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((objective, index) => ({
      objectiveId: `O-${String(index + 1).padStart(3, "0")}`,
      unitName: asText(objective?.unitName, "未分單元"),
      lessonName: asText(objective?.lessonName, ""),
      text: asText(objective?.text ?? objective?.objective ?? objective?.description, ""),
      periodCount: toPositiveInteger(objective?.periodCount, 1),
    }))
    .filter((objective) => objective.text)
    .map((objective, index) => ({
      ...objective,
      objectiveId: `O-${String(index + 1).padStart(3, "0")}`,
    }));
}

export function objectivesToInputText(objectives) {
  if (!Array.isArray(objectives)) return "";

  return objectives
    .map((objective) => ({
      text: asText(objective?.text),
      periodCount: toPositiveInteger(objective?.periodCount, 1),
    }))
    .filter((objective) => objective.text)
    .map((objective) => `${objective.text}｜${objective.periodCount}`)
    .join("\n");
}
