import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_FRAMEWORKS,
  getAvailableFrameworks,
  resolveFrameworkId,
  usesChineseDimension,
} from "../frontend/src/core/frameworks.js";
import { objectiveScoresByPeriod, computeChineseDimensionScores } from "../frontend/src/core/periods.js";

describe("resolveFrameworkId", () => {
  it("國語未設定 frameworkId 時退回 learning_objectives", () => {
    expect(resolveFrameworkId({ subject: "國語" })).toBe("learning_objectives");
    expect(resolveFrameworkId({ subject: "國語", frameworkId: "" })).toBe("learning_objectives");
  });

  it("非法 frameworkId 也退回 learning_objectives", () => {
    expect(resolveFrameworkId({ subject: "國語", frameworkId: "亂打" })).toBe("learning_objectives");
  });

  it("合法 frameworkId 原樣回傳", () => {
    expect(resolveFrameworkId({ subject: "國語", frameworkId: "chinese_dimension_items" })).toBe("chinese_dimension_items");
  });
});

describe("usesChineseDimension（須同時 subject 與 framework 成立）", () => {
  it("國語未設 framework（教材目標模式）→ 不啟用向度", () => {
    expect(usesChineseDimension({ subject: "國語" })).toBe(false);
  });

  it("國語 + learning_objectives → 不啟用向度", () => {
    expect(usesChineseDimension({ subject: "國語", frameworkId: "learning_objectives" })).toBe(false);
  });

  it("國語 + chinese_dimension_items → 啟用向度", () => {
    expect(usesChineseDimension({ subject: "國語", frameworkId: "chinese_dimension_items" })).toBe(true);
  });

  it("非國語即使誤設 chinese_dimension_items 也不得啟用向度", () => {
    expect(usesChineseDimension({ subject: "數學", frameworkId: "chinese_dimension_items" })).toBe(false);
    expect(usesChineseDimension({ subject: "自然", frameworkId: "chinese_dimension_items" })).toBe(false);
  });
});

describe("getAvailableFrameworks", () => {
  it("國語提供教材目標與評量向度兩種", () => {
    expect(getAvailableFrameworks("國語")).toEqual(["learning_objectives", "chinese_dimension_items"]);
  });

  it("其他科僅教材目標模式", () => {
    expect(getAvailableFrameworks("數學")).toEqual(["learning_objectives"]);
    expect(getAvailableFrameworks("自然")).toEqual(["learning_objectives"]);
  });

  it("ASSESSMENT_FRAMEWORKS 旗標一致", () => {
    expect(ASSESSMENT_FRAMEWORKS.learning_objectives.usesChineseDimension).toBe(false);
    expect(ASSESSMENT_FRAMEWORKS.chinese_dimension_items.usesChineseDimension).toBe(true);
  });
});

describe("配分策略：教材目標模式用節數、向度模式用向度比例", () => {
  const objectives = [
    { objectiveId: "O-001", periodCount: 3 },
    { objectiveId: "O-002", periodCount: 2 },
    { objectiveId: "O-003", periodCount: 5 },
  ];

  it("教材目標模式（usesChineseDimension=false）→ objectiveScoresByPeriod 依節數比例", () => {
    // 對應國語 learning_objectives / 自然 / 社會 / 數學
    const map = objectiveScoresByPeriod(objectives, 100);
    expect(map.get("O-001")).toBe(30);
    expect(map.get("O-002")).toBe(20);
    expect(map.get("O-003")).toBe(50);
    const sum = [...map.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("評量向度模式（usesChineseDimension=true）→ computeChineseDimensionScores 依向度比例", () => {
    const dimObjectives = [
      { objectiveId: "O-001", dimension: "字詞短語" },
      { objectiveId: "O-002", dimension: "句式語法" },
      { objectiveId: "O-003", dimension: "段篇讀寫" },
    ];
    const map = computeChineseDimensionScores(dimObjectives, 100, { 字詞短語: 50, 句式語法: 30, 段篇讀寫: 20 });
    expect(map.get("O-001")).toBe(50);
    expect(map.get("O-002")).toBe(30);
    expect(map.get("O-003")).toBe(20);
  });
});
