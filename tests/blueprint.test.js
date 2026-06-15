import { describe, expect, it } from "vitest";
import { buildItemIntents, buildPaperSectionsByTheme, parseQuestionTypeMix } from "../frontend/src/core/blueprint.js";

describe("buildItemIntents", () => {
  it("依 objectivePlans 產生一題一個意圖", () => {
    const result = buildItemIntents({
      unitScore: 2,
      objectives: [
        { objectiveId: "O-001", unitName: "天氣", text: "能判讀天氣資料" },
      ],
      objectivePlans: [
        { objectiveId: "O-001", targetUnitCount: 3, targetScore: 6 },
      ],
      questionTypeMix: ["選擇題", "填充題"],
    });

    expect(result.ok).toBe(true);
    expect(result.intents).toHaveLength(3);
    expect(result.intents.map((intent) => intent.questionType)).toEqual(["選擇題", "填充題", "選擇題"]);
    expect(result.intents.every((intent) => intent.score === 2)).toBe(true);
    expect(result.intents.every((intent) => intent.primaryObjectiveId === "O-001")).toBe(true);
  });
});

describe("parseQuestionTypeMix", () => {
  it("解析 選擇題:70, 填充題:20, 短答題:10", () => {
    expect(parseQuestionTypeMix("選擇題:70, 填充題:20, 短答題:10")).toEqual([
      { questionType: "選擇題", percent: 70 },
      { questionType: "填充題", percent: 20 },
      { questionType: "短答題", percent: 10 },
    ]);
  });

  it("接受空白分隔與換行，濾掉無效列", () => {
    expect(parseQuestionTypeMix("選擇題 60\n填充題 40\n亂寫")).toEqual([
      { questionType: "選擇題", percent: 60 },
      { questionType: "填充題", percent: 40 },
    ]);
  });
});

describe("buildItemIntents 進階序列", () => {
  it("questionTypeSequence 依全卷序列指派題型", () => {
    const result = buildItemIntents({
      objectives: [{ objectiveId: "O-001", unitName: "天氣", text: "t" }],
      objectivePlans: [{ objectiveId: "O-001", targetUnitCount: 3 }],
      questionTypeSequence: ["選擇題", "短答題", "填充題"],
    });

    expect(result.intents.map((intent) => intent.questionType)).toEqual(["選擇題", "短答題", "填充題"]);
  });

  it("scoreSequence 依全卷序列指派配分", () => {
    const result = buildItemIntents({
      objectives: [{ objectiveId: "O-001", unitName: "天氣", text: "t" }],
      objectivePlans: [{ objectiveId: "O-001", targetUnitCount: 3 }],
      scoreSequence: [2, 3, 2],
    });

    expect(result.intents.map((intent) => intent.score)).toEqual([2, 3, 2]);
  });
});

describe("buildPaperSectionsByTheme", () => {
  it("section 只依主題區塊排版，不改變題目意圖", () => {
    const intents = [
      { itemId: "Q-001", themeBlockId: "天氣" },
      { itemId: "Q-002", themeBlockId: "天氣" },
      { itemId: "Q-003", themeBlockId: "水" },
    ];

    const result = buildPaperSectionsByTheme({ intents });
    expect(result.ok).toBe(true);
    expect(result.sections).toEqual([
      { sectionId: "S-01", order: 1, title: "1. 天氣", layoutMode: "themeBlock", itemIds: ["Q-001", "Q-002"] },
      { sectionId: "S-02", order: 2, title: "2. 水", layoutMode: "themeBlock", itemIds: ["Q-003"] },
    ]);
  });
});
