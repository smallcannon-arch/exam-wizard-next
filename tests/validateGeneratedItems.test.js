import { describe, expect, it } from "vitest";
import { validateGeneratedItemsAgainstIntents } from "../frontend/src/core/validateGeneratedItems.js";

const intents = [
  {
    intentId: "Q-001",
    primaryObjectiveId: "O-001",
    questionType: "選擇題",
    score: 2,
  },
  {
    intentId: "Q-002",
    primaryObjectiveId: "O-001",
    questionType: "填充題",
    score: 2,
  },
];

describe("validateGeneratedItemsAgainstIntents", () => {
  it("完整題目可通過", () => {
    const result = validateGeneratedItemsAgainstIntents({
      intents,
      items: [
        {
          itemId: "Q-001",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "選擇題",
          question: "題目一",
          answer: "A",
          score: 2,
        },
        {
          itemId: "Q-002",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "填充題",
          question: "題目二",
          answer: "水",
          score: 2,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("可抓出缺少 question", () => {
    const result = validateGeneratedItemsAgainstIntents({
      intents,
      items: [
        {
          itemId: "Q-001",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "選擇題",
          question: "題目一",
          answer: "A",
          score: 2,
        },
        {
          itemId: "Q-002",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "填充題",
          answer: "水",
          score: 2,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Q-002：缺少 question。");
  });

  it("可抓出 AI 未回傳某題", () => {
    const result = validateGeneratedItemsAgainstIntents({
      intents,
      items: [
        {
          itemId: "Q-001",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "選擇題",
          question: "題目一",
          answer: "A",
          score: 2,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Q-002：AI 未回傳此題。");
  });

  it("可抓出重複題號", () => {
    const result = validateGeneratedItemsAgainstIntents({
      intents,
      items: [
        {
          itemId: "Q-001",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "選擇題",
          question: "題目一",
          answer: "A",
          score: 2,
        },
        {
          itemId: "Q-001",
          primaryObjectiveId: "O-001",
          objectiveIds: ["O-001"],
          questionType: "選擇題",
          question: "題目一重複",
          answer: "B",
          score: 2,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Q-001：AI 回傳重複題號。");
    expect(result.errors).toContain("Q-002：AI 未回傳此題。");
  });

  it("藍圖用 intentId(I-)、AI 只回 itemId(Q-) 仍能對上", () => {
    const dualIntents = [
      { intentId: "I-001", itemId: "Q-001", primaryObjectiveId: "O-001", questionType: "選擇題", score: 2 },
      { intentId: "I-002", itemId: "Q-002", primaryObjectiveId: "O-001", questionType: "填充題", score: 2 },
    ];

    const result = validateGeneratedItemsAgainstIntents({
      intents: dualIntents,
      items: [
        { itemId: "Q-001", primaryObjectiveId: "O-001", objectiveIds: ["O-001"], questionType: "選擇題", question: "題目一", answer: "A", score: 2 },
        { itemId: "Q-002", primaryObjectiveId: "O-001", objectiveIds: ["O-001"], questionType: "填充題", question: "題目二", answer: "水", score: 2 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("AI 同時回傳 intentId 與 itemId 也能對上，缺題以 intentId 標示", () => {
    const dualIntents = [
      { intentId: "I-001", itemId: "Q-001", primaryObjectiveId: "O-001", questionType: "選擇題", score: 2 },
      { intentId: "I-002", itemId: "Q-002", primaryObjectiveId: "O-001", questionType: "填充題", score: 2 },
    ];

    const result = validateGeneratedItemsAgainstIntents({
      intents: dualIntents,
      items: [
        { intentId: "I-001", itemId: "Q-001", primaryObjectiveId: "O-001", objectiveIds: ["O-001"], questionType: "選擇題", question: "題目一", answer: "A", score: 2 },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("I-002：AI 未回傳此題。");
  });
});
