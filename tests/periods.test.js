import { describe, expect, it } from "vitest";
import { computeObjectiveShares, formatPercent } from "../frontend/src/core/periods.js";

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
