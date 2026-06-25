import { describe, expect, it } from "vitest";
import { buildPlanSequences, getPlanTotals, normalizePlanRows, validatePlan } from "../frontend/src/core/plan.js";
import { CHOICE_ONLY_STOPGAP_MESSAGE, getQuestionTypeOptions, matchSubject } from "../frontend/src/core/questionTypes.js";
import { createInitialState } from "../frontend/src/state.js";

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
      { questionType: "選擇題", count: 50, score: 2 },
    ];
    const result = validatePlan(plan, 100);
    expect(result.ok).toBe(true);
    expect(result.totalItems).toBe(50);
    expect(result.totalScore).toBe(100);
  });

  it("止血期間阻擋混合題型與題組", () => {
    const mixed = validatePlan([
      { questionType: "選擇題", count: 20, score: 2 },
      { questionType: "是非題", count: 10, score: 2 },
    ]);
    expect(mixed.ok).toBe(false);
    expect(mixed.error).toContain(CHOICE_ONLY_STOPGAP_MESSAGE);

    const grouped = validatePlan([
      { questionType: "選擇題", count: 4, score: 2, isGroup: true, groupCount: 1, subScores: [2, 3] },
    ]);
    expect(grouped.ok).toBe(false);
    expect(grouped.error).toContain(CHOICE_ONLY_STOPGAP_MESSAGE);
  });

  it("合計不等於總分時回傳錯誤", () => {
    const choiceRows = [{ questionType: "選擇題", count: 20, score: 2 }];
    expect(validatePlan(choiceRows, 100).ok).toBe(false);
    expect(validatePlan(choiceRows, 100).error).toContain("不符");
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
  it("止血期間只帶出標準四選一選擇題", () => {
    expect(matchSubject("自然")).toBe("自然");
    const options = getQuestionTypeOptions("自然");
    expect(options).toEqual(["選擇題"]);

    expect(matchSubject("社會")).toBe("社會");
    const socialOptions = getQuestionTypeOptions("社會");
    expect(socialOptions).toEqual(["選擇題"]);
  });

  it("未知科目用通用清單", () => {
    expect(matchSubject("天文")).toBe(null);
    expect(getQuestionTypeOptions("天文")).toEqual(["選擇題"]);
  });
});

describe("initial plan rows", () => {
  it("預設配題為 50 題標準四選一單題", () => {
    expect(createInitialState().planRows).toEqual([
      { questionType: "選擇題", count: 50, score: 2, isGroup: false, groupCount: 1, subScores: [] },
    ]);
  });
});
