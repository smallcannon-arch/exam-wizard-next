import { describe, expect, it } from "vitest";
import { buildPlanSequences, getPlanTotals, normalizePlanRows, validatePlan } from "../frontend/src/core/plan.js";
import {
  CHOICE_ONLY_STOPGAP_ENABLED,
  CHOICE_ONLY_STOPGAP_MESSAGE,
  FILL_IN_QUESTION_TYPE,
  LITERACY_ASSESSMENT_TYPE,
  MIXED_TYPES_ENABLED,
  PUBLIC_MIXED_QUESTION_TYPE_OPTIONS,
  STANDARD_CHOICE_QUESTION_TYPE,
  TRUE_FALSE_QUESTION_TYPE,
  canConfigureQuestionTypeGroup,
  getQuestionTypeReleaseConfig,
  getQuestionTypeOptions,
  isSupportedGenerationQuestionType,
  matchSubject,
} from "../frontend/src/core/questionTypes.js";
import { createInitialState } from "../frontend/src/state.js";

const mixedEnabled = { mixedTypesEnabled: true };
const stopgapOn = { choiceOnlyStopgapEnabled: true };

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

  it("stopgap override 仍阻擋混合題型與題組", () => {
    const mixed = validatePlan([
      { questionType: "選擇題", count: 20, score: 2 },
      { questionType: "是非題", count: 10, score: 2 },
    ], null, stopgapOn);
    expect(mixed.ok).toBe(false);
    expect(mixed.error).toContain(CHOICE_ONLY_STOPGAP_MESSAGE);

    const grouped = validatePlan([
      { questionType: "選擇題", count: 4, score: 2, isGroup: true, groupCount: 1, subScores: [2, 3] },
    ], null, stopgapOn);
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

  it("mixed enabled 時允許 public typed allowlist 建立混合 blueprint", () => {
    const mixed = validatePlan([
      { questionType: STANDARD_CHOICE_QUESTION_TYPE, count: 20, score: 2 },
      { questionType: TRUE_FALSE_QUESTION_TYPE, count: 10, score: 2 },
      { questionType: FILL_IN_QUESTION_TYPE, count: 10, score: 2 },
      { questionType: LITERACY_ASSESSMENT_TYPE, count: 4, score: 2, isGroup: true, groupCount: 4, subScores: [2, 3] },
    ], null, mixedEnabled);

    expect(mixed.ok).toBe(true);
    expect(mixed.totalItems).toBe(44);
  });

  it("mixed enabled 時拒絕 legacy preset 與 unknown 題型", () => {
    expect(validatePlan([
      { questionType: "應用題", count: 2, score: 5 },
    ], null, mixedEnabled).ok).toBe(false);

    expect(validatePlan([
      { questionType: "短答題", count: 2, score: 5 },
    ], null, mixedEnabled).ok).toBe(false);
  });

  it("mixed enabled 時只允許學力檢測題設定題組", () => {
    expect(validatePlan([
      { questionType: LITERACY_ASSESSMENT_TYPE, count: 2, score: 2, isGroup: true, groupCount: 2, subScores: [2, 3] },
    ], null, mixedEnabled).ok).toBe(true);

    expect(validatePlan([
      { questionType: STANDARD_CHOICE_QUESTION_TYPE, count: 2, score: 2, isGroup: true, groupCount: 2, subScores: [2, 3] },
    ], null, mixedEnabled).ok).toBe(false);

    expect(validatePlan([
      { questionType: LITERACY_ASSESSMENT_TYPE, count: 2, score: 2, isGroup: true, groupCount: 2, subScores: [2] },
    ], null, mixedEnabled).ok).toBe(false);
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
  it("production default 正式開放 public typed allowlist", () => {
    expect(CHOICE_ONLY_STOPGAP_ENABLED).toBe(true);
    expect(MIXED_TYPES_ENABLED).toBe(false);
    expect(getQuestionTypeReleaseConfig()).toEqual({
      choiceOnlyStopgapEnabled: true,
      mixedTypesEnabled: false,
    });
  });

  it("stopgap override 只帶出標準四選一選擇題", () => {
    expect(matchSubject("自然")).toBe("自然");
    const options = getQuestionTypeOptions("自然", stopgapOn);
    expect(options).toEqual(["選擇題"]);

    expect(matchSubject("社會")).toBe("社會");
    const socialOptions = getQuestionTypeOptions("社會", stopgapOn);
    expect(socialOptions).toEqual(["選擇題"]);

    expect(isSupportedGenerationQuestionType(STANDARD_CHOICE_QUESTION_TYPE, stopgapOn)).toBe(true);
    expect(isSupportedGenerationQuestionType(TRUE_FALSE_QUESTION_TYPE, stopgapOn)).toBe(false);
    expect(isSupportedGenerationQuestionType("應用題", stopgapOn)).toBe(false);
  });

  it("未知科目不影響 public typed allowlist", () => {
    expect(matchSubject("天文")).toBe(null);
    expect(getQuestionTypeOptions("天文", mixedEnabled)).toEqual(PUBLIC_MIXED_QUESTION_TYPE_OPTIONS);
  });

  it("mixed enabled default 只帶出 public typed allowlist", () => {
    const options = getQuestionTypeOptions("國語", mixedEnabled);
    expect(options).toEqual(PUBLIC_MIXED_QUESTION_TYPE_OPTIONS);
    expect(options).toEqual([
      STANDARD_CHOICE_QUESTION_TYPE,
      TRUE_FALSE_QUESTION_TYPE,
      FILL_IN_QUESTION_TYPE,
      LITERACY_ASSESSMENT_TYPE,
    ]);
    expect(options).not.toContain("注音");
    expect(options).not.toContain("改錯");
    expect(options).not.toContain("應用題");
    expect(options).not.toContain("圖表判讀題");
  });

  it("mixed enabled default only public allowlist 題型被視為可生成", () => {
    expect(isSupportedGenerationQuestionType(STANDARD_CHOICE_QUESTION_TYPE, mixedEnabled)).toBe(true);
    expect(isSupportedGenerationQuestionType(TRUE_FALSE_QUESTION_TYPE, mixedEnabled)).toBe(true);
    expect(isSupportedGenerationQuestionType(FILL_IN_QUESTION_TYPE, mixedEnabled)).toBe(true);
    expect(isSupportedGenerationQuestionType(LITERACY_ASSESSMENT_TYPE, mixedEnabled)).toBe(true);
    expect(isSupportedGenerationQuestionType("情境題組", mixedEnabled)).toBe(true);

    for (const unsupported of ["注音", "改錯", "應用題", "圖表判讀題", "短答題", ""]) {
      expect(isSupportedGenerationQuestionType(unsupported, mixedEnabled)).toBe(false);
    }
  });

  it("題組入口只在 mixed enabled 的學力檢測題開放", () => {
    expect(canConfigureQuestionTypeGroup(LITERACY_ASSESSMENT_TYPE, stopgapOn)).toBe(false);
    expect(canConfigureQuestionTypeGroup(LITERACY_ASSESSMENT_TYPE, mixedEnabled)).toBe(true);
    expect(canConfigureQuestionTypeGroup(STANDARD_CHOICE_QUESTION_TYPE, mixedEnabled)).toBe(false);
    expect(canConfigureQuestionTypeGroup(TRUE_FALSE_QUESTION_TYPE, mixedEnabled)).toBe(false);
    expect(canConfigureQuestionTypeGroup(FILL_IN_QUESTION_TYPE, mixedEnabled)).toBe(false);
  });
});

describe("initial plan rows", () => {
  it("預設配題為 50 題標準四選一單題", () => {
    expect(createInitialState().planRows).toEqual([
      { questionType: "選擇題", count: 50, score: 2, isGroup: false, groupCount: 1, subScores: [] },
    ]);
  });
});
