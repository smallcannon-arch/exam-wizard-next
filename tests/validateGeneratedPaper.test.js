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

  it("學力檢測題組分群配分加總相符且包含共同引言時通過 (Design B)", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({}),
        item({ itemId: "Q-002-1", groupId: "G-002", questionType: "學力檢測題", score: 2, stimulus: "生活情境...", primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
        item({ itemId: "Q-002-2", groupId: "G-002", questionType: "學力檢測題", score: 3, stimulus: "", primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("學力檢測題組分群配分總和不符時報錯", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({}),
        item({ itemId: "Q-002-1", groupId: "G-002", questionType: "學力檢測題", score: 2, stimulus: "生活情境...", primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
        item({ itemId: "Q-002-2", groupId: "G-002", questionType: "學力檢測題", score: 2, stimulus: "", primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("子題配分總和為 4 分"))).toBe(true);
  });

  it("學力檢測題組缺少引言時報錯", () => {
    const result = validateGeneratedPaper({
      slots, objectives,
      items: [
        item({}),
        item({ itemId: "Q-002-1", groupId: "G-002", questionType: "學力檢測題", score: 2, stimulus: "", primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
        item({ itemId: "Q-002-2", groupId: "G-002", questionType: "學力檢測題", score: 3, stimulus: "", primaryObjectiveId: "O-002", objectiveIds: ["O-002"] }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("題組缺少共同的 stimulus"))).toBe(true);
  });

  it("題位指定目標與題目不符時報錯", () => {
    const localSlots = [
      { itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" },
    ];
    const result = validateGeneratedPaper({
      slots: localSlots,
      objectives,
      items: [
        item({ itemId: "Q-001", primaryObjectiveId: "O-002" }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("對應學習目標應為"))).toBe(true);
  });

  it("題組題位被 AI 回成單題時報錯", () => {
    const localSlots = [
      { itemId: "Q-001", questionType: "選擇題", score: 5, isGroup: true, subScores: [2, 3] },
    ];
    const result = validateGeneratedPaper({
      slots: localSlots,
      objectives,
      items: [
        item({ itemId: "Q-001", score: 5 }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("該題位設定為題組，但 AI 回傳為單題"))).toBe(true);
  });

  it("題組子題缺少 groupId 或不一致時報錯", () => {
    const localSlots = [
      { itemId: "Q-001", questionType: "選擇題", score: 5, isGroup: true, subScores: [2, 3] },
    ];
    // groupId 缺失
    const result1 = validateGeneratedPaper({
      slots: localSlots,
      objectives,
      items: [
        item({ itemId: "Q-001-1", score: 2, groupId: "" }),
        item({ itemId: "Q-001-2", score: 3, groupId: "G-001" }),
      ],
    });
    expect(result1.ok).toBe(false);
    expect(result1.errors.some((e) => e.includes("題組子題缺少 groupId"))).toBe(true);

    // groupId 不一致
    const result2 = validateGeneratedPaper({
      slots: localSlots,
      objectives,
      items: [
        item({ itemId: "Q-001-1", score: 2, groupId: "G-001" }),
        item({ itemId: "Q-001-2", score: 3, groupId: "G-002" }),
      ],
    });
    expect(result2.ok).toBe(false);
    expect(result2.errors.some((e) => e.includes("groupId 必須相同"))).toBe(true);
  });

  it("子題配分順序/數值與 subScores 不符時報錯", () => {
    const localSlots = [
      { itemId: "Q-001", questionType: "選擇題", score: 5, isGroup: true, subScores: [2, 3] },
    ];
    const result = validateGeneratedPaper({
      slots: localSlots,
      objectives,
      items: [
        item({ itemId: "Q-001-1", score: 3, groupId: "G-001" }),
        item({ itemId: "Q-001-2", score: 2, groupId: "G-001" }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("子題配分應為 2 分，但實際為 3 分"))).toBe(true);
  });
});
