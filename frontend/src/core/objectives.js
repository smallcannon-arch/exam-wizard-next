// 將 AI／Gem 提取的學習目標正規化，並轉成第②步目標欄位的文字格式（目標文字｜節數）。
// 也負責解析使用者貼回的目標（支援「目標文字｜節數」多行，或 Gem 輸出的 JSON）。
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
    .map((objective) => ({
      unitName: asText(objective?.unitName, "未分單元"),
      lessonName: asText(objective?.lessonName, ""),
      text: asText(objective?.text ?? objective?.objective ?? objective?.description ?? objective?.目標),
      periodCount: toPositiveInteger(objective?.periodCount ?? objective?.periods ?? objective?.節數 ?? objective?.節, 1),
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

// 解析使用者貼回的目標：先試 JSON（Gem 可能輸出 {objectives:[...]} 或陣列），
// 否則用「目標文字｜節數」多行格式（也容許用空白/逗號分隔，或行尾帶節數）。
export function parseObjectiveInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.objectives) ? data.objectives : []);
      const mapped = list
        .map((objective) => ({
          text: asText(objective?.text ?? objective?.objective ?? objective?.description ?? objective?.目標),
          unitName: asText(objective?.unitName ?? objective?.單元),
          periodCount: toPositiveInteger(objective?.periodCount ?? objective?.periods ?? objective?.節數 ?? objective?.節, 1),
        }))
        .filter((objective) => objective.text);
      if (mapped.length > 0) return mapped;
    } catch {
      // 不是合法 JSON，改用文字格式解析
    }
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[｜|\t]/).map((part) => part.trim());
      let text = parts[0] || "";
      let period = parts[1];

      if (period === undefined) {
        const match = line.match(/^(.*?)[\s，,、]*(\d+)\s*節?$/);
        if (match) {
          text = match[1].trim();
          period = match[2];
        }
      }

      return { text, periodCount: toPositiveInteger(period, 1) };
    })
    .filter((objective) => objective.text);
}
