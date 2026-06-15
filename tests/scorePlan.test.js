import { describe, expect, it } from "vitest";
import {
  allocateUnitsByPeriod,
  buildScoreSequence,
  getScorePlanTotals,
  parseScorePlan,
  validateScorePlan,
} from "../frontend/src/core/scoring.js";

describe("parseScorePlan", () => {
  it("解析 2分×35題, 3分×10題", () => {
    expect(parseScorePlan("2分×35題, 3分×10題")).toEqual([
      { score: 2, count: 35, subtotal: 70 },
      { score: 3, count: 10, subtotal: 30 },
    ]);
  });

  it("接受 2x35 與換行格式，濾掉無效列", () => {
    expect(parseScorePlan("2x35\n3*10\n壞資料")).toEqual([
      { score: 2, count: 35, subtotal: 70 },
      { score: 3, count: 10, subtotal: 30 },
    ]);
  });
});

describe("validateScorePlan", () => {
  it("加總等於總分時通過", () => {
    const plan = parseScorePlan("2分×35題, 3分×10題");
    const result = validateScorePlan(plan, 100);
    expect(result.ok).toBe(true);
    expect(result.totalItems).toBe(45);
    expect(result.totalScore).toBe(100);
  });

  it("加總不等於總分時回傳錯誤", () => {
    const plan = parseScorePlan("2分×35題, 3分×10題");
    const result = validateScorePlan(plan, 90);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不等於全卷總分");
  });

  it("getScorePlanTotals 計算題數與總分", () => {
    expect(getScorePlanTotals(parseScorePlan("2x35, 3x10"))).toEqual({ totalItems: 45, totalScore: 100 });
  });
});

describe("buildScoreSequence", () => {
  it("依方案展開配分序列，數量與總分正確", () => {
    const sequence = buildScoreSequence(parseScorePlan("2x35, 3x10"));
    expect(sequence).toHaveLength(45);
    expect(sequence.filter((score) => score === 2)).toHaveLength(35);
    expect(sequence.filter((score) => score === 3)).toHaveLength(10);
    expect(sequence.reduce((sum, score) => sum + score, 0)).toBe(100);
  });
});

describe("allocateUnitsByPeriod", () => {
  const objectives = [
    { objectiveId: "O-001", periodCount: 3 },
    { objectiveId: "O-002", periodCount: 2 },
    { objectiveId: "O-003", periodCount: 1 },
  ];

  it("每目標至少 1 題，總數等於 totalUnits", () => {
    const result = allocateUnitsByPeriod({ objectives, totalUnits: 45 });
    expect(result.ok).toBe(true);
    expect(result.counts.every((row) => row.targetUnitCount >= 1)).toBe(true);
    expect(result.counts.reduce((sum, row) => sum + row.targetUnitCount, 0)).toBe(45);
  });

  it("目標數大於題數時回傳錯誤", () => {
    const result = allocateUnitsByPeriod({ objectives, totalUnits: 2 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("大於題目總數");
  });
});
