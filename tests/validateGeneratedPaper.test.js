import { describe, expect, it } from "vitest";
import { validateGeneratedPaper } from "../frontend/src/core/validateGeneratedPaper.js";

const slots = [
  { itemId: "Q-001", questionType: "選擇題", score: 2 },
  { itemId: "Q-002", questionType: "學力檢測題", score: 5 },
];
const objectives = [
  { objectiveId: "O-001", text: "目標一", periodCount: 3 },
  { objectiveId: "O-002", text: "目標二", periodCount: 2 },
];

function item(overrides) {
  return {
    itemId: "Q-001", questionType: "選擇題", score: 2,
    primaryObjectiveId: "O-001", objectiveIds: ["O-001"],
    cognitiveLevel: "理解", question: "題幹", answer: "A",
    options: ["甲", "乙", "丙", "丁"],
    ...overrides,
  };
}

describe("validateGeneratedPaper", () => {
  it("題型/配分相符、目標有效且全覆蓋時通過", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({}),
        item({ itemId: "Q-002", questionType: "學力檢測題", score: 5, primaryObjectiveId: "O-002", objectiveIds: ["O-002"], answer: "(1)A (2)B" }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("題型被更動時報錯", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({ questionType: "填充題" }),
        item({ itemId: "Q-002", questionType: "學力檢測題", score: 5, primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("題型應為"))).toBe(true);
  });

  it("有目標未被覆蓋時，仍可匯入但給提醒（不擋下）", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({}),
        item({ itemId: "Q-002", questionType: "學力檢測題", score: 5, primaryObjectiveId: "O-001", objectiveIds: ["O-001"] }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.join("")).toContain("O-002");
  });

  it("對應到清單外的目標時報錯", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({ primaryObjectiveId: "O-099", objectiveIds: ["O-099"] }),
        item({ itemId: "Q-002", questionType: "學力檢測題", score: 5, primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("不在學習目標清單內"))).toBe(true);
  });
});
