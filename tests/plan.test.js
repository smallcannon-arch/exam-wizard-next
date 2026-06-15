import { describe, expect, it } from "vitest";
import { buildPlanSequences, getPlanTotals, normalizePlanRows, validatePlan } from "../frontend/src/core/plan.js";
import { getQuestionTypeOptions, matchSubject } from "../frontend/src/core/questionTypes.js";

const rows = [
  { questionType: "選擇題", count: 20, score: 2 },
  { questionType: "是非題", count: 10, score: 2 },
  { questionType: "學力檢測題", count: 4, score: 5 },
];

describe("normalizePlanRows", () => {
  it("濾掉題型空白或題數/配分非正整數的列", () => {
    expect(normalizePlanRows([
      { questionType: "選擇題", count: 20, score: 2 },
      { questionType: "", count: 5, score: 2 },
      { questionType: "填充題", count: 0, score: 2 },
      { questionType: "簡答題", count: 3, score: 0 },
    ])).toEqual([{ questionType: "選擇題", count: 20, score: 2 }]);
  });
});

describe("getPlanTotals", () => {
  it("計算總題數與總分", () => {
    expect(getPlanTotals(rows)).toEqual({ totalItems: 34, totalScore: 80 });
  });
});

describe("validatePlan", () => {
  it("合計等於總分時通過", () => {
    const plan = [
      { questionType: "選擇題", count: 35, score: 2 },
      { questionType: "學力檢測題", count: 6, score: 5 },
    ];
    const result = validatePlan(plan, 100);
    expect(result.ok).toBe(true);
    expect(result.totalItems).toBe(41);
    expect(result.totalScore).toBe(100);
  });

  it("合計不等於總分時回傳錯誤", () => {
    expect(validatePlan(rows, 100).ok).toBe(false);
    expect(validatePlan(rows, 100).error).toContain("不符");
  });

  it("沒有有效列時回傳錯誤", () => {
    expect(validatePlan([], 100).ok).toBe(false);
  });
});

describe("buildPlanSequences", () => {
  it("導出長度與數量正確的題型與配分序列", () => {
    const { questionTypeSequence, scoreSequence } = buildPlanSequences(rows);
    expect(questionTypeSequence).toHaveLength(34);
    expect(scoreSequence).toHaveLength(34);
    expect(questionTypeSequence.filter((type) => type === "選擇題")).toHaveLength(20);
    expect(questionTypeSequence.filter((type) => type === "學力檢測題")).toHaveLength(4);
    expect(scoreSequence.reduce((sum, score) => sum + score, 0)).toBe(80);
  });
});

describe("questionTypes", () => {
  it("依科目帶出常用題型並附學力檢測題", () => {
    expect(matchSubject("自然")).toBe("自然");
    const options = getQuestionTypeOptions("自然");
    expect(options[0]).toBe("選擇題");
    expect(options).toContain("實驗探究題");
    expect(options[options.length - 1]).toBe("學力檢測題");
  });

  it("未知科目用通用清單", () => {
    expect(matchSubject("天文")).toBe(null);
    expect(getQuestionTypeOptions("天文")).toContain("學力檢測題");
  });
});
