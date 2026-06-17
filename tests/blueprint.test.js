import { describe, expect, it } from "vitest";
import { buildItemIntents, buildPaperSectionsByTheme, parseQuestionTypeMix, distributeObjectivesToSlots } from "../frontend/src/core/blueprint.js";

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

describe("buildSectionsByQuestionType", () => {
  it("同題型分到同一大題，順序依 typeOrder", async () => {
    const { buildSectionsByQuestionType } = await import("../frontend/src/core/blueprint.js");
    const result = buildSectionsByQuestionType({
      items: [
        { itemId: "Q-001", questionType: "選擇題" },
        { itemId: "Q-002", questionType: "學力檢測題" },
        { itemId: "Q-003", questionType: "選擇題" },
      ],
      typeOrder: ["選擇題", "學力檢測題"],
    });

    expect(result.ok).toBe(true);
    expect(result.sections.map((s) => s.title)).toEqual(["選擇題", "學力檢測題"]);
    expect(result.sections[0].itemIds).toEqual(["Q-001", "Q-003"]);
    expect(result.sections[1].itemIds).toEqual(["Q-002"]);
  });
});

describe("buildSectionsByQuestionType 圖表/實驗併入選擇題", () => {
  it("圖表判讀題、實驗探究題在學生卷併進「選擇題」大題", async () => {
    const { buildSectionsByQuestionType } = await import("../frontend/src/core/blueprint.js");
    const result = buildSectionsByQuestionType({
      items: [
        { itemId: "Q-001", questionType: "選擇題" },
        { itemId: "Q-002", questionType: "圖表判讀題" },
        { itemId: "Q-003", questionType: "實驗探究題" },
        { itemId: "Q-004", questionType: "填充題" },
      ],
      typeOrder: ["選擇題", "圖表判讀題", "實驗探究題", "填充題"],
    });
    expect(result.sections.map((s) => s.title)).toEqual(["選擇題", "填充題"]);
    expect(result.sections[0].itemIds).toEqual(["Q-001", "Q-002", "Q-003"]);
  });
});

describe("distributeObjectivesToSlots", () => {
  it("數學化分配目標至題位，且保證至少每個目標有題並貼近預估配分", () => {
    const slots = [
      { itemId: "Q-001", score: 2 },
      { itemId: "Q-002", score: 2 },
      { itemId: "Q-003", score: 2 },
      { itemId: "Q-004", score: 2 },
      { itemId: "Q-005", score: 2 },
    ];
    const objectives = [
      { objectiveId: "O-001", periodCount: 3 },
      { objectiveId: "O-002", periodCount: 2 },
    ];
    const scoreById = new Map([
      ["O-001", 6],
      ["O-002", 4],
    ]);

    const result = distributeObjectivesToSlots(slots, objectives, scoreById);
    expect(result).toHaveLength(5);
    // Every slot should have a primaryObjectiveId assigned
    expect(result.every((r) => r.primaryObjectiveId)).toBe(true);

    const counts = {};
    result.forEach((r) => {
      counts[r.primaryObjectiveId] = (counts[r.primaryObjectiveId] || 0) + r.score;
    });

    expect(counts["O-001"]).toBe(6);
    expect(counts["O-002"]).toBe(4);
  });

  it("當部分目標的預估配分很大時，不應產生飢餓效應（貪婪演算法應正確分配剩餘題位）", () => {
    const slots = [];
    for (let i = 1; i <= 4; i++) slots.push({ itemId: `Q-G${i}`, score: 5 });
    for (let i = 1; i <= 40; i++) slots.push({ itemId: `Q-S${i}`, score: 2 });

    const objectives = [
      { objectiveId: "O-001", text: "1-1-1 正確字音" },
      { objectiveId: "O-002", text: "1-1-2 確認字形" },
      { objectiveId: "O-003", text: "1-1-3 分辨部首" },
      { objectiveId: "O-004", text: "1-1-4 字詞釋義" },
      { objectiveId: "O-005", text: "1-1-5 句型辨識" },
      { objectiveId: "O-006", text: "1-1-6 文句組成" },
      { objectiveId: "O-007", text: "1-1-7 常用修辭" },
      { objectiveId: "O-008", text: "1-1-8 提取訊息" },
      { objectiveId: "O-009", text: "1-1-9 推論訊息" },
      { objectiveId: "O-010", text: "1-1-10 主題習寫" },
    ];

    const scoreById = new Map([
      ["O-001", 8],
      ["O-002", 8],
      ["O-003", 7],
      ["O-004", 7],
      ["O-005", 17],
      ["O-006", 17],
      ["O-007", 16],
      ["O-008", 7],
      ["O-009", 7],
      ["O-010", 6],
    ]);

    const result = distributeObjectivesToSlots(slots, objectives, scoreById);
    const counts = {};
    result.forEach((r) => {
      counts[r.primaryObjectiveId] = (counts[r.primaryObjectiveId] || 0) + r.score;
    });

    expect(counts["O-005"]).toBeGreaterThanOrEqual(15);
    expect(counts["O-006"]).toBeGreaterThanOrEqual(15);
    expect(counts["O-007"]).toBeGreaterThanOrEqual(14);
  });
});
