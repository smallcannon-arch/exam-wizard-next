import { describe, expect, it } from "vitest";
import { toReviewItem, toStudentItem } from "../frontend/src/core/itemViews.js";
import { normalizeGeneratedItem } from "../frontend/src/core/normalizeItem.js";

describe("item view projection", () => {
  const item = {
    itemId: "Q-001",
    primaryObjectiveId: "O-001",
    question: "題幹",
    options: ["甲", "乙", "丙", "丁"],
    answer: "A",
    explanation: "學生解析",
    abilityFocus: "不應進學生版",
    correctReason: "不應進學生版",
    teacherExplanation: "不應進學生版",
    selfCheck: { singleCorrectAnswer: true },
    distractorDesign: { B: { misconceptionTag: "keyword_trap" } },
    qualityMeta: {
      schemaVersion: "item-quality-meta/v1",
      teacherExplanation: "教師解析",
    },
  };

  it("toStudentItem 只保留學生版核心欄位", () => {
    const result = toStudentItem(item);

    expect(result).toEqual({
      questionId: "Q-001",
      primaryObjectiveId: "O-001",
      question: "題幹",
      options: ["甲", "乙", "丙", "丁"],
      answer: "A",
      explanation: "學生解析",
    });
    expect(result.qualityMeta).toBeUndefined();
    expect(result.abilityFocus).toBeUndefined();
    expect(result.correctReason).toBeUndefined();
    expect(result.teacherExplanation).toBeUndefined();
    expect(result.distractorDesign).toBeUndefined();
    expect(result.selfCheck).toBeUndefined();
  });

  it("toReviewItem 保留 qualityMeta", () => {
    const result = toReviewItem(item);

    expect(result.qualityMeta.teacherExplanation).toBe("教師解析");
  });

  it("normalized student item 不外洩內部品質欄位", () => {
    const normalized = normalizeGeneratedItem({
      itemId: "Q-002",
      primaryObjectiveId: "O-001",
      question: "題幹",
      options: {
        A: "甲",
        B: "乙",
        C: "丙",
        D: "丁",
      },
      answer: "A",
      explanation: "學生解析",
      qualityMeta: {
        abilityFocus: "內部能力重點",
        correctReason: "A 正確。",
        teacherExplanation: "教師解析",
        distractorDesign: { B: { misconceptionTag: "keyword_trap" } },
        selfCheck: { singleCorrectAnswer: true },
      },
    });
    const result = toStudentItem(normalized);

    expect(result.options).toEqual(["甲", "乙", "丙", "丁"]);
    expect(result.qualityMeta).toBeUndefined();
    expect(result.teacherExplanation).toBeUndefined();
    expect(result.distractorDesign).toBeUndefined();
    expect(result.selfCheck).toBeUndefined();
  });
});
