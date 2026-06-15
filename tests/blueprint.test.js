import { describe, expect, it } from "vitest";
import { buildItemIntents, buildPaperSectionsByTheme } from "../frontend/src/core/blueprint.js";

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
