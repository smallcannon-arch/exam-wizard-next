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

function qualityMeta(overrides = {}) {
  return {
    schemaVersion: "item-quality-meta/v1",
    subject: "國語",
    grade: "四年級",
    unit: "閱讀理解",
    cognitiveLevel: "理解",
    difficulty: "中",
    itemType: "single_choice",
    abilityFocus: "能理解題意並選出正確答案。",
    correctReason: "A 為正確答案。",
    distractorDesign: {
      B: {
        misconceptionTag: "keyword_trap",
        misconceptionDescription: "學生只看關鍵詞。",
        whyStudentsMayChooseIt: "選項含有題幹詞語。",
        whyItIsWrong: "不符合完整題意。",
        revisionNote: "保留。",
      },
      C: {
        misconceptionTag: "partial_reading",
        misconceptionDescription: "學生只讀局部資訊。",
        whyStudentsMayChooseIt: "局部看似合理。",
        whyItIsWrong: "忽略其他線索。",
        revisionNote: "保留。",
      },
      D: {
        misconceptionTag: "stem_neglect",
        misconceptionDescription: "學生未看清題幹。",
        whyStudentsMayChooseIt: "受表面語氣吸引。",
        whyItIsWrong: "與題幹要求不符。",
        revisionNote: "保留。",
      },
    },
    teacherExplanation: "本題用來檢核學生是否能理解題意，三個錯誤選項分別對應不同迷思。",
    selfCheck: {
      singleCorrectAnswer: true,
      matchesPrimaryObjectiveId: true,
      matchesCognitiveLevel: true,
      allDistractorsHaveMisconceptionTags: true,
      noObviousGiveaway: true,
      gradeAppropriate: true,
      noUnnecessaryDifficulty: true,
    },
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

  it("AI 回傳向度與題位鎖定值不符時，給警示但不擋下", () => {
    const result = validateGeneratedPaper({
      slots: [
        { itemId: "Q-001", questionType: "選擇題", score: 2, chineseDimension: "字詞短語" },
        { itemId: "Q-002", questionType: "學力檢測題", score: 5, chineseDimension: "段篇讀寫" },
      ],
      objectives,
      items: [
        item({ chineseDimension: "句式語法" }),
        item({ itemId: "Q-002", questionType: "學力檢測題", score: 5, primaryObjectiveId: "O-002", objectiveIds: ["O-002"], answer: "(1)A (2)B", chineseDimension: "段篇讀寫" }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("評量向度") && w.includes("不符"))).toBe(true);
  });

  it("單題閱讀測驗缺少 stimulus 時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "閱讀測驗", score: 2 }],
      objectives: [objectives[0]],
      items: [
        item({
          questionType: "閱讀測驗",
          question: "根據本文，下列哪一項最符合主旨？",
          stimulus: "",
        }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("閱讀測驗必須提供 stimulus"))).toBe(true);
  });

  it("題目引用上文但缺少 stimulus 時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2 }],
      objectives: [objectives[0]],
      items: [
        item({
          question: "根據這段文字，阿里山五奇不包括下列哪一項？",
          stimulus: "",
        }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("缺少 stimulus"))).toBe(true);
  });

  it("題目引用上文且提供 stimulus 時可通過", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2 }],
      objectives: [objectives[0]],
      items: [
        item({
          question: "根據這段文字，阿里山五奇不包括下列哪一項？",
          stimulus: "阿里山以日出、雲海、晚霞、森林與鐵道聞名，是臺灣重要的自然景觀。",
        }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
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

  it("子題數量與 subCount 不符時報錯", () => {
    const localSlots = [
      { itemId: "Q-001", questionType: "選擇題", score: 5, isGroup: true, subCount: 3, subScores: [2, 3] },
    ];
    const result = validateGeneratedPaper({
      slots: localSlots,
      objectives,
      items: [
        item({ itemId: "Q-001-1", score: 2, groupId: "G-001" }),
        item({ itemId: "Q-001-2", score: 3, groupId: "G-001" }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("與題位設定的 3 子題數不符"))).toBe(true);
  });

  it("舊版題目沒有 qualityMeta 仍可通過基本驗證", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({})],
    });

    expect(result.ok).toBe(true);
  });

  it("v2 品質模式下完整 qualityMeta 可通過", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: qualityMeta() })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("v2 compact qualityMeta 缺系統 metadata 仍可通過", () => {
    const meta = qualityMeta();
    delete meta.subject;
    delete meta.grade;
    delete meta.unit;
    delete meta.cognitiveLevel;
    delete meta.difficulty;
    delete meta.itemType;

    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: meta })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("v2 item 有 qualityMeta 但缺 teacherExplanation 時報錯", () => {
    const meta = qualityMeta();
    delete meta.teacherExplanation;
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: meta })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("qualityMeta 缺少 teacherExplanation"))).toBe(true);
  });

  it("v2 item 的 teacherExplanation 為空字串時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: qualityMeta({ teacherExplanation: "   " }) })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("qualityMeta 缺少 teacherExplanation"))).toBe(true);
  });

  it("v2 item 的 qualityMeta.distractorDesign 為 array 時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({
        qualityMeta: qualityMeta({
          distractorDesign: [
            { option: "B", misconceptionTag: "keyword_trap" },
          ],
        }),
      })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("qualityMeta.distractorDesign 必須是物件"))).toBe(true);
  });

  it("v2 item 的 qualityMeta.distractorDesign 為 null 時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: qualityMeta({ distractorDesign: null }) })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("qualityMeta.distractorDesign 必須是物件"))).toBe(true);
  });

  it("v2 item 缺 qualityMeta.distractorDesign 時報錯", () => {
    const meta = qualityMeta();
    delete meta.distractorDesign;
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: meta })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("qualityMeta.distractorDesign 必須是物件"))).toBe(true);
  });

  it("answer 不在選項中時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ answer: "E" })],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("answer") && e.includes("不在選項範圍內"))).toBe(true);
  });

  it("選擇類題目的 options 為 object 時報錯", () => {
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({
        options: {
          A: "甲",
          B: "乙",
          C: "丙",
          D: "丁",
        },
      })],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("options 必須是陣列"))).toBe(true);
  });

  it("v2 品質模式下錯誤選項缺 misconceptionTag 時報錯", () => {
    const meta = qualityMeta({
      distractorDesign: {
        B: {
          misconceptionDescription: "學生只看關鍵詞。",
          whyStudentsMayChooseIt: "選項含有題幹詞語。",
          whyItIsWrong: "不符合完整題意。",
          revisionNote: "保留。",
        },
        C: qualityMeta().distractorDesign.C,
        D: qualityMeta().distractorDesign.D,
      },
    });
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: meta })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("錯誤選項 B 缺少 misconceptionTag"))).toBe(true);
  });

  it("正答出現在 distractorDesign 中時報錯", () => {
    const meta = qualityMeta({
      distractorDesign: {
        A: {
          misconceptionTag: "should_not_exist",
          misconceptionDescription: "正答不應放入誘答設計。",
          whyStudentsMayChooseIt: "無。",
          whyItIsWrong: "無。",
          revisionNote: "移除。",
        },
        B: qualityMeta().distractorDesign.B,
        C: qualityMeta().distractorDesign.C,
        D: qualityMeta().distractorDesign.D,
      },
    });
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [objectives[0]],
      items: [item({ qualityMeta: meta })],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("正答 A 不應出現在 qualityMeta.distractorDesign"))).toBe(true);
  });
});
