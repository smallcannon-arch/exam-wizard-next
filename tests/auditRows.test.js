import { describe, expect, it } from "vitest";
import { buildAuditRows } from "../frontend/src/core/auditRows.js";

describe("buildAuditRows", () => {
  it("整理逐題審核列，含對應目標與認知層次", () => {
    const rows = buildAuditRows([
      {
        itemId: "Q-001",
        questionType: "選擇題",
        score: 2,
        objectiveIds: ["O-001"],
        cognitiveLevel: "理解",
      },
      {
        itemId: "Q-002",
        questionType: "填充題",
        score: 3,
        primaryObjectiveId: "O-002",
      },
    ]);

    expect(rows).toEqual([
      { itemId: "Q-001", questionType: "選擇題", score: 2, objectiveIds: "O-001", cognitiveLevel: "理解" },
      { itemId: "Q-002", questionType: "填充題", score: 3, objectiveIds: "O-002", cognitiveLevel: "未標示" },
    ]);
  });

  it("多目標以頓號合併，缺漏以未標示表示", () => {
    const rows = buildAuditRows([
      { itemId: "Q-003", objectiveIds: ["O-001", "O-002"] },
    ]);

    expect(rows[0].objectiveIds).toBe("O-001、O-002");
    expect(rows[0].questionType).toBe("未標示");
    expect(rows[0].score).toBe(0);
  });

  it("非陣列回傳空陣列", () => {
    expect(buildAuditRows(null)).toEqual([]);
  });
});
