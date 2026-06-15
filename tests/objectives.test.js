import { describe, expect, it } from "vitest";
import { normalizeExtractedObjectives, objectivesToInputText } from "../frontend/src/core/objectives.js";

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

  it("非陣列回傳空陣列", () => {
    expect(normalizeExtractedObjectives(null)).toEqual([]);
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
