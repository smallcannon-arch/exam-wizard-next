import { describe, expect, it } from "vitest";
import {
  normalizeGeneratedItem,
  normalizeGeneratedItems,
} from "../frontend/src/core/normalizeItem.js";

describe("normalizeGeneratedItem", () => {
  it("保留原本 question", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-001",
      question: "原本題幹",
      answer: "A",
      explanation: "解析",
    });

    expect(item.question).toBe("原本題幹");
  });

  it("可將 stem 補成 question", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-002",
      stem: "AI 回傳的 stem 題幹",
      answer: "B",
    });

    expect(item.question).toBe("AI 回傳的 stem 題幹");
  });

  it("可將 problem 補成 question", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-003",
      problem: "AI 回傳的 problem 題幹",
      correctAnswer: "水和空氣",
      rationale: "因為鐵生鏽需要水和空氣。",
    });

    expect(item.question).toBe("AI 回傳的 problem 題幹");
    expect(item.answer).toBe("水和空氣");
    expect(item.explanation).toBe("因為鐵生鏽需要水和空氣。");
  });

  it("可整理物件形式的 options", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004",
      questionText: "下列何者正確？",
      options: [
        { label: "A. 水" },
        { label: "B. 空氣" },
        { label: "C. 油漆" },
      ],
    });

    expect(item.question).toBe("下列何者正確？");
    expect(item.options).toEqual(["A. 水", "B. 空氣", "C. 油漆"]);
  });

  it("批次正規化 items", () => {
    const items = normalizeGeneratedItems([
      {
        itemId: "Q-001",
        question: "題目一",
      },
      {
        itemId: "Q-002",
        prompt: "題目二",
      },
    ]);

    expect(items.map((item) => item.question)).toEqual(["題目一", "題目二"]);
  });
});