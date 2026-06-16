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
    ])).toEqual([{ questionType: "選擇題", count: 20, score: 2, isGroup: false, groupCount: 1, subScores: [] }]);
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

describe("normalizePlanRows 混合題組與單題", () => {
  it("應正確帶出 groupCount 與 subScores", () => {
    const inputRows = [
      { questionType: "選擇題", count: 5, score: 2, isGroup: true, groupCount: 2, subScores: [3, 4] }
    ];
    expect(normalizePlanRows(inputRows)).toEqual([
      { questionType: "選擇題", count: 5, score: 2, isGroup: true, groupCount: 2, subScores: [3, 4] }
    ]);
  });
});

describe("getPlanTotals 混合題組與單題", () => {
  it("應正確計算混合題組與單題之總配分", () => {
    const inputRows = [
      { questionType: "選擇題", count: 5, score: 2, isGroup: true, groupCount: 2, subScores: [3, 4] }
    ];
    // 2 組題組 (每組 3+4=7分) + 3 題單題 (每題 2分) = 14 + 6 = 20分
    expect(getPlanTotals(inputRows)).toEqual({ totalItems: 5, totalScore: 20 });
  });
});

describe("buildPlanSequences 混合題組與單題", () => {
  it("導出之題型、配分與設定序列應正確，且題組排在前面", () => {
    const inputRows = [
      { questionType: "選擇題", count: 5, score: 2, isGroup: true, groupCount: 2, subScores: [3, 4] }
    ];
    const { questionTypeSequence, scoreSequence, configSequence } = buildPlanSequences(inputRows);
    expect(questionTypeSequence).toEqual(["選擇題", "選擇題", "選擇題", "選擇題", "選擇題"]);
    expect(scoreSequence).toEqual([7, 7, 2, 2, 2]);
    expect(configSequence).toEqual([
      { isGroup: true, subScores: [3, 4] },
      { isGroup: true, subScores: [3, 4] },
      { isGroup: false, subScores: [] },
      { isGroup: false, subScores: [] },
      { isGroup: false, subScores: [] }
    ]);
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
