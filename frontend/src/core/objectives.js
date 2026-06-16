// 將 AI／Gem 提取的學習目標正規化，並把使用者貼回的各種格式「智慧轉換」成標準目標。
// 可容錯：標準「目標文字｜節數」多行、JSON、或「單元標題＋節數＋條列指標」的結構化格式。
// 純資料轉換，不依賴 DOM。
import { largestRemainder } from "./distribute.js";

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
      unitName: asText(objective?.unitName),
      periodCount: toPositiveInteger(objective?.periodCount, 1),
    }))
    .filter((objective) => objective.text)
    .map((objective) => {
      if (objective.unitName && objective.unitName !== "未分單元") {
        return `${objective.unitName} ｜ ${objective.text} ｜ ${objective.periodCount}`;
      }
      return `${objective.text}｜${objective.periodCount}`;
    })
    .join("\n");
}

// 取最前面的指標／單元編號（需含分隔，如 4-3、3-1-1）；純數字或無編號回傳空字串。
function extractLeadingCode(text) {
  const match = String(text || "").match(/^\s*([0-9]+(?:[-－.][0-9]+)+)/);
  return match ? match[1].replace(/[－.]/g, "-") : "";
}

function inlineNode(text) {
  const match = String(text || "").match(/[（(]\s*(\d+)\s*節\s*[)）]/);
  return match ? toPositiveInteger(match[1], null) : null;
}

function stripInlineNode(text) {
  return String(text || "").replace(/[（(]\s*\d+\s*節\s*[)）]/g, "").trim();
}

function parseFlatLine(line) {
  const parts = String(line).split(/[｜|\t]/).map((part) => part.trim());
  if (parts.length >= 3) {
    return {
      unitName: parts[0],
      text: parts[1],
      periodCount: toPositiveInteger(parts[2], 1)
    };
  }
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
}

// 把單元節數平均分給其下各指標（整數，總和=節數；節數未知時每指標 1）。
function distributePeriods(total, count) {
  if (count <= 0) return [];
  const base = Number.isInteger(total) && total >= count ? total : count;
  return largestRemainder(base, Array.from({ length: count }, (_, index) => ({ key: index, weight: 1 }))).map((row) => row.count || 1);
}

function getUnitNameFromText(text, fallback = "未分單元") {
  const code = extractLeadingCode(text);
  if (code) {
    const parts = code.split("-");
    if (parts[0]) return `第${parts[0]}單元`;
  }
  return fallback;
}

function parseTableObjectiveInput(raw) {
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const out = [];
  let currentUnitCode = "";
  let currentUnitName = "";
  let currentSubIndex = 1;

  for (const line of lines) {
    let parts = line.split(/[｜|\t]/).map((p) => p.trim());
    if (parts.length === 1 && line.includes("  ")) {
      parts = line.split(/\s{2,}/).map((p) => p.trim());
    }

    if (parts.length > 1 && /^\d+$/.test(parts[0])) {
      parts.shift();
    }

    const mainText = parts[0] || "";
    if (!mainText) continue;

    // 1) 判斷是否為單元標題
    if (mainText.includes("單元名稱") || mainText.includes("單元標題") || mainText.includes("單元主題") || /^【?\s*單元/.test(mainText)) {
      const codeMatch = mainText.match(/([0-9]+(?:[-－.][0-9]+)+)/);
      const code = codeMatch ? codeMatch[1].replace(/[－.]/g, "-") : "";
      let name = mainText.replace(/單元名稱：|單元名稱:|單元名稱|單元：|單元:|主題：|主題:|標題：|標題/g, "").trim();
      if (codeMatch) {
        name = name.replace(codeMatch[0], "").trim();
      }
      name = name.replace(/^[:：\-\s]+/, "").trim();

      currentUnitCode = code;
      currentUnitName = name || (code ? `第${code}單元` : "未分單元");
      currentSubIndex = 1;
      continue;
    }

    // 2) 判斷是否為表格欄位標頭、總結行或非目標行
    if (
      mainText.includes("指標編號") ||
      mainText.includes("學習指標") ||
      mainText.includes("授課節數") ||
      mainText.includes("總節數") ||
      mainText.includes("學習節數") ||
      mainText.includes("目標配分") ||
      mainText === "指標" ||
      mainText === "目標" ||
      mainText === "節數：" ||
      mainText === "節數:"
    ) {
      continue;
    }

    // 3) 目標行
    let cleanedText = mainText.replace(/^[\-–—•・‧*\s\d.．、]+/, "").trim();
    if (!cleanedText) continue;

    let period = 1;
    if (parts.length >= 2) {
      for (let i = 1; i < parts.length; i++) {
        const m = parts[i].match(/(\d+)/);
        if (m) {
          period = Number(m[1]);
          break;
        }
      }
    } else {
      const m = cleanedText.match(/(\d+)\s*節/);
      if (m) {
        period = Number(m[1]);
      }
    }

    // 編序
    let finalFormattedText = cleanedText;
    if (currentUnitCode) {
      // 避免重複編序
      const prefix = `${currentUnitCode}-${currentSubIndex}`;
      if (!cleanedText.startsWith(prefix)) {
        finalFormattedText = `${prefix} ${cleanedText}`;
      }
      currentSubIndex += 1;
    }

    out.push({
      text: finalFormattedText,
      periodCount: period,
      unitName: currentUnitName || "未分單元"
    });
  }

  return out;
}

export function parseObjectiveInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];

  // 1) JSON（Gem 可能輸出 {objectives:[...]} 或陣列）
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.objectives) ? data.objectives : []);
      const mapped = list
        .map((objective) => {
          const textStr = asText(objective?.text ?? objective?.objective ?? objective?.description ?? objective?.目標);
          return {
            text: textStr,
            unitName: asText(objective?.unitName ?? objective?.單元) || getUnitNameFromText(textStr, "未分單元"),
            periodCount: toPositiveInteger(objective?.periodCount ?? objective?.periods ?? objective?.節數 ?? objective?.節, 1),
          };
        })
        .filter((objective) => objective.text);
      if (mapped.length > 0) return mapped;
    } catch {
      // 不是合法 JSON，改用文字解析
    }
  }

  // 1.5) 表格複製容錯格式（Excel/Word 複製貼上，包含 \t 或多個空格分隔）
  const isTableFormat = raw.includes("\t") || raw.split("\n").some((l) => l.includes("  ") && (l.includes("單元") || l.includes("節") || l.includes("能")));
  if (isTableFormat) {
    const tableResult = parseTableObjectiveInput(raw);
    if (tableResult.length > 0) return tableResult;
  }

  // 2) 文字：逐行辨識「單元標題 / 節數 / 條列指標 / 標準行」
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const out = [];
  let unit = null;

  const flushUnit = () => {
    if (!unit) return;
    if (unit.indicators.length > 0) {
      const periods = distributePeriods(unit.periodCount, unit.indicators.length);
      unit.indicators.forEach((indicator, index) => {
        const code = unit.code ? `${unit.code}-${index + 1}` : "";
        const textStr = code ? `${code} ${indicator}` : indicator;
        out.push({
          text: textStr,
          periodCount: periods[index] || 1,
          unitName: unit.name || getUnitNameFromText(textStr, "未分單元")
        });
      });
    } else if (unit.name) {
      out.push({
        text: unit.name,
        periodCount: unit.periodCount || 1
      });
    }
    unit = null;
  };

  for (const line of lines) {
    // 節數行：【節數】N / 節數：N / （N節）
    const nodeOnly = line.match(/^【?\s*節數\s*】?\s*[:：]?\s*(\d+)\s*節?$/) || line.match(/^[（(]\s*(\d+)\s*節\s*[)）]$/);
    if (nodeOnly) {
      if (unit) unit.periodCount = toPositiveInteger(nodeOnly[1], unit.periodCount);
      continue;
    }

    // 單元標題：【單元名稱】X / 【單元】X / # X
    const headerLabel = line.match(/^【\s*(?:單元名稱|單元|標題|主題)\s*】\s*(.*)$/) || line.match(/^#{1,6}\s+(.*)$/);
    if (headerLabel) {
      flushUnit();
      const name = headerLabel[1].trim();
      unit = { name: stripInlineNode(name), code: extractLeadingCode(name), periodCount: inlineNode(name), indicators: [] };
      continue;
    }

    // 條列指標：- ・ • * 等開頭
    const bullet = line.match(/^[\-–—•・‧*]\s*(.*)$/);
    if (bullet) {
      const text = bullet[1].trim();
      if (!text) continue;
      if (unit) {
        unit.indicators.push(text);
      } else {
        const parsed = parseFlatLine(text);
        const uName = parsed.unitName || getUnitNameFromText(parsed.text, "");
        const obj = { ...parsed };
        if (uName) obj.unitName = uName;
        out.push(obj);
      }
      continue;
    }

    // 標準行：含「｜」或結尾帶節數 → 直接當一個目標
    if (/[｜|\t]/.test(line) || /\d+\s*節?$/.test(line)) {
      flushUnit();
      const parsed = parseFlatLine(line);
      const uName = parsed.unitName || getUnitNameFromText(parsed.text, "");
      const obj = { ...parsed };
      if (uName) obj.unitName = uName;
      out.push(obj);
      continue;
    }

    // 純標籤行（例如殘留的【…】）略過
    if (/^【[^】]*】\s*$/.test(line)) continue;

    // 其餘無「｜」的行：視為單元標題（如「4-3 動物的生命延續」「活動一 …」）
    flushUnit();
    unit = { name: stripInlineNode(line), code: extractLeadingCode(line), periodCount: inlineNode(line), indicators: [] };
  }
  flushUnit();

  return out.filter((objective) => objective.text);
}
