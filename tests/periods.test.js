import { describe, expect, it } from "vitest";
import { computeObjectiveShares, formatPercent, computeChineseDimensionScores } from "../frontend/src/core/periods.js";

describe("computeObjectiveShares", () => {
  it("依節數計算占總教學時數比例", () => {
    const shares = computeObjectiveShares([
      { objectiveId: "O-001", periodCount: 3 },
      { objectiveId: "O-002", periodCount: 2 },
      { objectiveId: "O-003", periodCount: 5 },
    ]);

    expect(shares.map((row) => row.periodCount)).toEqual([3, 2, 5]);
    expect(shares.map((row) => Math.round(row.share * 100))).toEqual([30, 20, 50]);
    expect(shares.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 6);
  });

  it("節數缺漏時以 1 計", () => {
    const shares = computeObjectiveShares([{ objectiveId: "O-001" }, { objectiveId: "O-002", periodCount: 3 }]);
    expect(shares[0].periodCount).toBe(1);
    expect(shares[1].periodCount).toBe(3);
  });
});

describe("formatPercent", () => {
  it("轉成百分比字串", () => {
    expect(formatPercent(0.3)).toBe("30%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("computeChineseDimensionScores（國語向度比例配分）", () => {
  const ratios = { 字詞短語: 50, 句式語法: 30, 段篇讀寫: 20 };

  it("依向度比例分配總分，向度內細項平均分", () => {
    const scores = computeChineseDimensionScores([
      { objectiveId: "O-001", dimension: "字詞短語" },
      { objectiveId: "O-002", dimension: "字詞短語" },
      { objectiveId: "O-003", dimension: "句式語法" },
      { objectiveId: "O-004", dimension: "句式語法" },
      { objectiveId: "O-005", dimension: "段篇讀寫" },
    ], 100, ratios);
    const obj = Object.fromEntries(scores);
    expect(obj["O-001"]).toBe(25);
    expect(obj["O-002"]).toBe(25);
    expect(obj["O-003"]).toBe(15);
    expect(obj["O-004"]).toBe(15);
    expect(obj["O-005"]).toBe(20);
    // 向度佔分符合 50 / 30 / 20
    expect(obj["O-001"] + obj["O-002"]).toBe(50);
    expect(obj["O-003"] + obj["O-004"]).toBe(30);
    expect(obj["O-005"]).toBe(20);
  });

  it("向度內不整除時以最大餘數法補足，總分守恆", () => {
    const scores = computeChineseDimensionScores([
      { objectiveId: "O-001", dimension: "字詞短語" },
      { objectiveId: "O-002", dimension: "字詞短語" },
      { objectiveId: "O-003", dimension: "字詞短語" },
      { objectiveId: "O-004", dimension: "句式語法" },
      { objectiveId: "O-005", dimension: "段篇讀寫" },
    ], 100, ratios);
    const obj = Object.fromEntries(scores);
    // 字詞短語 50 分、3 細項 → 17 / 17 / 16
    expect(obj["O-001"] + obj["O-002"] + obj["O-003"]).toBe(50);
    expect([obj["O-001"], obj["O-002"], obj["O-003"]].sort((a, b) => a - b)).toEqual([16, 17, 17]);
    expect(obj["O-004"]).toBe(30);
    expect(obj["O-005"]).toBe(20);
    expect(Object.values(obj).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("無向度比例時退回各向度等權，總分仍守恆", () => {
    const scores = computeChineseDimensionScores([
      { objectiveId: "O-001", dimension: "" },
      { objectiveId: "O-002", dimension: "" },
      { objectiveId: "O-003", dimension: "" },
      { objectiveId: "O-004", dimension: "" },
      { objectiveId: "O-005", dimension: "" },
    ], 10, {});
    const obj = Object.fromEntries(scores);
    expect(Object.values(obj).reduce((a, b) => a + b, 0)).toBe(10);
    expect(Object.values(obj)).toEqual([2, 2, 2, 2, 2]);
  });
});
