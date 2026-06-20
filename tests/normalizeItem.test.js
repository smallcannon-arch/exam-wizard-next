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

  it("可將舊頂層命題設計欄位收進 qualityMeta", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-005",
      question: "下列何者正確？",
      answer: "A",
      explanation: "學生解析",
      cognitiveLevel: "理解",
      questionType: "選擇題",
      correctReason: "A 正確。",
      teacherExplanation: "本題檢核概念理解。",
      distractorDesign: {
        B: { misconceptionTag: "keyword_trap" },
      },
      selfCheck: {
        singleCorrectAnswer: true,
      },
    });

    expect(item.qualityMeta.schemaVersion).toBe("item-quality-meta/v1");
    expect(item.qualityMeta.cognitiveLevel).toBe("理解");
    expect(item.qualityMeta.itemType).toBe("選擇題");
    expect(item.qualityMeta.correctReason).toBe("A 正確。");
    expect(item.qualityMeta.teacherExplanation).toBe("本題檢核概念理解。");
    expect(item.qualityMeta.distractorDesign.B.misconceptionTag).toBe("keyword_trap");
    expect(item.qualityMeta.selfCheck.singleCorrectAnswer).toBe(true);
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
