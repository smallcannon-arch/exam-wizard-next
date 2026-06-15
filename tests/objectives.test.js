import { describe, expect, it } from "vitest";
import { normalizeExtractedObjectives, objectivesToInputText, parseObjectiveInput } from "../frontend/src/core/objectives.js";

describe("normalizeExtractedObjectives", () => {
  it("補上連號 objectiveId 與預設值，並濾掉沒有 text 的項目", () => {
    const result = normalizeExtractedObjectives([
      { unitName: "天氣", text: "能判讀天氣資料", periodCount: 3 },
      { text: "" },
      { description: "能說明水循環", periodCount: 0 },
    ]);

    expect(result).toEqual([
      { objectiveId: "O-001", unitName: "天氣", lessonName: "", text: "能判讀天氣資料", periodCount: 3 },
      { objectiveId: "O-002", unitName: "未分單元", lessonName: "", text: "能說明水循環", periodCount: 1 },
    ]);
  });

  it("支援中文鍵『節數』", () => {
    const result = normalizeExtractedObjectives([{ 目標: "能觀察月相", 節數: 4 }]);
    expect(result[0].text).toBe("能觀察月相");
    expect(result[0].periodCount).toBe(4);
  });
});

describe("objectivesToInputText", () => {
  it("轉成 目標文字｜節數 的多行文字", () => {
    const text = objectivesToInputText([
      { text: "目標一", periodCount: 2 },
      { text: "目標二", periodCount: 1 },
    ]);

    expect(text).toBe("目標一｜2\n目標二｜1");
  });
});

describe("parseObjectiveInput", () => {
  it("解析『目標文字｜節數』多行", () => {
    expect(parseObjectiveInput("能判讀天氣｜3\n能說明水循環｜2")).toEqual([
      { text: "能判讀天氣", periodCount: 3 },
      { text: "能說明水循環", periodCount: 2 },
    ]);
  });

  it("解析行尾帶節數（無分隔符）", () => {
    expect(parseObjectiveInput("能觀察月相變化 4節")).toEqual([
      { text: "能觀察月相變化", periodCount: 4 },
    ]);
  });

  it("解析 Gem 的 JSON 輸出（含中文鍵）", () => {
    const json = JSON.stringify({ objectives: [{ 目標: "能分類動物", 節數: 5, 單元: "生物" }] });
    expect(parseObjectiveInput(json)).toEqual([
      { text: "能分類動物", unitName: "生物", periodCount: 5 },
    ]);
  });

  it("缺節數時預設為 1", () => {
    expect(parseObjectiveInput("只有目標文字")).toEqual([{ text: "只有目標文字", periodCount: 1 }]);
  });
});

describe("parseObjectiveInput 結構化容錯", () => {
  it("單元標題＋節數＋條列指標 → 指標編號＋平均節數", () => {
    const text = "【單元名稱】4-3 動物的生命延續\n【節數】4\n- 能知道求偶方式\n- 能了解繁殖方式\n- 能了解保護行為\n- 能知道性狀差異";
    const result = parseObjectiveInput(text);
    expect(result).toHaveLength(4);
    expect(result[0].text.startsWith("4-3-1 ")).toBe(true);
    expect(result[3].text.startsWith("4-3-4 ")).toBe(true);
    expect(result.reduce((sum, o) => sum + o.periodCount, 0)).toBe(4);
  });

  it("康軒架構圖（括號節數）也能轉換", () => {
    const result = parseObjectiveInput("1-2 動物適應環境的策略（2節）\n- 了解調節體溫\n- 了解遷移行為");
    expect(result.map((o) => o.text)).toEqual(["1-2-1 了解調節體溫", "1-2-2 了解遷移行為"]);
    expect(result.reduce((sum, o) => sum + o.periodCount, 0)).toBe(2);
  });
});
