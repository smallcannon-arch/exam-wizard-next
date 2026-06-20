import { describe, expect, it } from "vitest";
import { toReviewItem, toStudentItem } from "../frontend/src/core/itemViews.js";

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
});
