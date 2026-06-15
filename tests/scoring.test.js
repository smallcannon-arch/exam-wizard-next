import { describe, expect, it } from "vitest";
import {
  allocateObjectivePlans,
  getTotalScoreUnits,
  summarizeScoreByObjective,
} from "../frontend/src/core/scoring.js";

describe("getTotalScoreUnits", () => {
  it("100 分、每個計分單位 2 分時，共 50 個計分單位", () => {
    const result = getTotalScoreUnits({
      totalScore: 100,
      unitScore: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.totalScoreUnits).toBe(50);
    expect(result.totalScore).toBe(100);
    expect(result.unitScore).toBe(2);
  });

  it("總分無法整除每個計分單位分數時回傳錯誤", () => {
    const result = getTotalScoreUnits({
      totalScore: 100,
      unitScore: 3,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("無法");
  });
});

describe("allocateObjectivePlans", () => {
  const objectives = [
    {
      objectiveId: "O-001",
      text: "目標一",
      periodCount: 2,
    },
    {
      objectiveId: "O-002",
      text: "目標二",
      periodCount: 2,
    },
    {
      objectiveId: "O-003",
      text: "目標三",
      periodCount: 1,
    },
  ];

  it("每個目標至少 1 個計分單位，總分維持 100", () => {
    const result = allocateObjectivePlans({
      totalScore: 100,
      unitScore: 2,
      objectives,
    });

    expect(result.ok).toBe(true);
    expect(result.plans).toHaveLength(3);
    expect(result.plans.every((plan) => plan.targetUnitCount >= 1)).toBe(true);
    expect(
      result.plans.reduce((sum, plan) => sum + plan.targetUnitCount, 0),
    ).toBe(50);
    expect(
      result.plans.reduce((sum, plan) => sum + plan.targetScore, 0),
    ).toBe(100);
  });

  it("目標數大於計分單位數時回傳錯誤", () => {
    const manyObjectives = Array.from({ length: 6 }, (_, index) => ({
      objectiveId: `O-${String(index + 1).padStart(3, "0")}`,
      text: `目標 ${index + 1}`,
      periodCount: 1,
    }));

    const result = allocateObjectivePlans({
      totalScore: 10,
      unitScore: 2,
      objectives: manyObjectives,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("大於可分配計分單位數");
  });
});

describe("summarizeScoreByObjective", () => {
  it("依 primaryObjectiveId 統計計分單位數與分數", () => {
    const summary = summarizeScoreByObjective([
      {
        itemId: "I-001",
        primaryObjectiveId: "O-001",
        score: 2,
      },
      {
        itemId: "I-002",
        primaryObjectiveId: "O-001",
        score: 2,
      },
      {
        itemId: "I-003",
        primaryObjectiveId: "O-002",
        score: 2,
      },
    ]);

    expect(summary).toEqual([
      {
        objectiveId: "O-001",
        unitCount: 2,
        score: 4,
      },
      {
        objectiveId: "O-002",
        unitCount: 1,
        score: 2,
      },
    ]);
  });
});