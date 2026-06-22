import { describe, expect, it } from "vitest";
import { toStudentItem } from "../frontend/src/core/itemViews.js";
import {
  createItemOutputDiagnostics,
  createPaperOutputDiagnostics,
  DEFAULT_OUTPUT_BUDGET,
  OUTPUT_BUDGET_WARNINGS,
} from "../frontend/src/core/outputDiagnostics.js";

function distractor(seed = "短") {
  return {
    misconceptionTag: `${seed}_tag`,
    misconceptionDescription: `${seed}迷思說明`,
    whyStudentsMayChooseIt: `${seed}可能被選原因`,
    whyItIsWrong: `${seed}錯誤原因`,
    revisionNote: `${seed}保留`,
  };
}

function item(overrides = {}) {
  return {
    itemId: "Q-001",
    question: "題幹",
    options: ["甲", "乙", "丙", "丁"],
    answer: "A",
    explanation: "學生解析",
    qualityMeta: {
      schemaVersion: "item-quality-meta/v1",
      abilityFocus: "能力重點",
      correctReason: "A 能完整符合題意。",
      teacherExplanation: "教師端說明。",
      distractorDesign: {
        B: distractor("B"),
        C: distractor("C"),
        D: distractor("D"),
      },
      selfCheck: {
        singleCorrectAnswer: true,
        matchesPrimaryObjectiveId: true,
        matchesCognitiveLevel: true,
        allDistractorsHaveMisconceptionTags: true,
        noObviousGiveaway: true,
        gradeAppropriate: true,
        noUnnecessaryDifficulty: true,
      },
    },
    ...overrides,
  };
}

describe("output diagnostics", () => {
  it("有完整 qualityMeta 的題目可計算 item-level 長度", () => {
    const diagnostics = createItemOutputDiagnostics({
      rawOutput: JSON.stringify(item()),
      normalizedItem: item(),
    });

    expect(diagnostics.itemId).toBe("Q-001");
    expect(diagnostics.rawOutputLength).toBeGreaterThan(0);
    expect(diagnostics.studentItemLength).toBeGreaterThan(0);
    expect(diagnostics.qualityMetaLength).toBeGreaterThan(0);
    expect(diagnostics.distractorDesignLength).toBeGreaterThan(0);
    expect(diagnostics.teacherExplanationLength).toBe("教師端說明。".length);
    expect(diagnostics.correctReasonLength).toBe("A 能完整符合題意。".length);
    expect(diagnostics.maxSingleDistractorLength).toBeGreaterThan(0);
    expect(diagnostics.overBudget).toBe(false);
    expect(diagnostics.budgetWarnings).toEqual([]);
  });

  it("超過 item budget 時會產生 budgetWarnings", () => {
    const diagnostics = createItemOutputDiagnostics({
      rawOutput: "R".repeat(20),
      normalizedItem: item({
        qualityMeta: {
          ...item().qualityMeta,
          correctReason: "C".repeat(20),
          teacherExplanation: "T".repeat(20),
          distractorDesign: {
            B: distractor("B".repeat(20)),
            C: distractor("C".repeat(20)),
            D: distractor("D".repeat(20)),
          },
        },
      }),
      budget: {
        rawOutputLength: 5,
        studentItemLength: 5,
        qualityMetaLength: 5,
        distractorDesignLength: 5,
        teacherExplanationLength: 5,
        correctReasonLength: 5,
        perDistractorLength: 5,
      },
    });

    expect(diagnostics.overBudget).toBe(true);
    expect(diagnostics.budgetWarnings).toEqual(expect.arrayContaining([
      OUTPUT_BUDGET_WARNINGS.RAW_OUTPUT_OVER_BUDGET,
      OUTPUT_BUDGET_WARNINGS.STUDENT_ITEM_OVER_BUDGET,
      OUTPUT_BUDGET_WARNINGS.QUALITY_META_OVER_BUDGET,
      OUTPUT_BUDGET_WARNINGS.DISTRACTOR_DESIGN_OVER_BUDGET,
      OUTPUT_BUDGET_WARNINGS.TEACHER_EXPLANATION_OVER_BUDGET,
      OUTPUT_BUDGET_WARNINGS.CORRECT_REASON_OVER_BUDGET,
      OUTPUT_BUDGET_WARNINGS.SINGLE_DISTRACTOR_OVER_BUDGET,
    ]));
  });

  it("欄位不存在時不 throw，長度為 0", () => {
    const diagnostics = createItemOutputDiagnostics({
      normalizedItem: { itemId: "Q-EMPTY" },
    });

    expect(diagnostics.itemId).toBe("Q-EMPTY");
    expect(diagnostics.rawOutputLength).toBe(0);
    expect(diagnostics.qualityMetaLength).toBe(0);
    expect(diagnostics.distractorDesignLength).toBe(0);
    expect(diagnostics.teacherExplanationLength).toBe(0);
    expect(diagnostics.correctReasonLength).toBe(0);
    expect(diagnostics.maxSingleDistractorLength).toBe(0);
  });

  it("distractorDesign 不是 object 時不 throw", () => {
    const diagnostics = createItemOutputDiagnostics({
      normalizedItem: item({
        qualityMeta: {
          ...item().qualityMeta,
          distractorDesign: [{ misconceptionTag: "array_not_object" }],
        },
      }),
    });

    expect(diagnostics.distractorDesignLength).toBe(0);
    expect(diagnostics.maxSingleDistractorLength).toBe(0);
  });

  it("單一 distractor 過長時產生 SINGLE_DISTRACTOR_OVER_BUDGET", () => {
    const diagnostics = createItemOutputDiagnostics({
      normalizedItem: item({
        qualityMeta: {
          ...item().qualityMeta,
          distractorDesign: {
            B: { ...distractor("B"), whyItIsWrong: "很長".repeat(100) },
            C: distractor("C"),
          },
        },
      }),
      budget: {
        ...DEFAULT_OUTPUT_BUDGET,
        perDistractorLength: 20,
      },
    });

    expect(diagnostics.budgetWarnings).toContain(OUTPUT_BUDGET_WARNINGS.SINGLE_DISTRACTOR_OVER_BUDGET);
  });

  it("多題 item diagnostics 可彙整 total 與 average", () => {
    const rows = [
      createItemOutputDiagnostics({ rawOutput: "aaa", normalizedItem: item({ itemId: "Q-001" }) }),
      createItemOutputDiagnostics({ rawOutput: "bbbbb", normalizedItem: item({ itemId: "Q-002" }) }),
    ];
    const paper = createPaperOutputDiagnostics(rows);

    expect(paper.itemCount).toBe(2);
    expect(paper.totalRawOutputLength).toBe(8);
    expect(paper.averageRawOutputLength).toBe(4);
    expect(paper.totalQualityMetaLength).toBe(rows[0].qualityMetaLength + rows[1].qualityMetaLength);
    expect(paper.averageQualityMetaLength).toBe(paper.totalQualityMetaLength / 2);
  });

  it("多題超 budget 時 paper-level 產生 TOO_MANY_OVER_BUDGET_ITEMS", () => {
    const rows = [
      { itemId: "Q-001", overBudget: true },
      { itemId: "Q-002", overBudget: true },
    ];
    const paper = createPaperOutputDiagnostics(rows);

    expect(paper.overBudgetItemCount).toBe(2);
    expect(paper.overBudgetItems).toEqual(["Q-001", "Q-002"]);
    expect(paper.budgetWarnings).toContain(OUTPUT_BUDGET_WARNINGS.TOO_MANY_OVER_BUDGET_ITEMS);
  });

  it("整卷 totalRawOutputLength 超 budget 時產生 PAPER_RAW_OUTPUT_OVER_BUDGET", () => {
    const paper = createPaperOutputDiagnostics([
      { itemId: "Q-001", rawOutputLength: 100, overBudget: false },
      { itemId: "Q-002", rawOutputLength: 100, overBudget: false },
    ], {
      budget: { paperRawOutputLengthPerItem: 50 },
    });

    expect(paper.budgetWarnings).toContain(OUTPUT_BUDGET_WARNINGS.PAPER_RAW_OUTPUT_OVER_BUDGET);
  });

  it("整卷 totalQualityMetaLength 超 budget 時產生 PAPER_QUALITY_META_OVER_BUDGET", () => {
    const paper = createPaperOutputDiagnostics([
      { itemId: "Q-001", qualityMetaLength: 100, overBudget: false },
      { itemId: "Q-002", qualityMetaLength: 100, overBudget: false },
    ], {
      budget: { paperQualityMetaLengthPerItem: 50 },
    });

    expect(paper.budgetWarnings).toContain(OUTPUT_BUDGET_WARNINGS.PAPER_QUALITY_META_OVER_BUDGET);
  });

  it("student item 不包含 diagnostics", () => {
    const result = toStudentItem({
      ...item(),
      diagnostics: createItemOutputDiagnostics({ normalizedItem: item() }),
    });

    expect(result.diagnostics).toBeUndefined();
  });

  it("student item 不包含 qualityMeta、distractorDesign、teacherExplanation、selfCheck", () => {
    const result = toStudentItem({
      ...item(),
      teacherExplanation: "不應進學生版",
      distractorDesign: { B: distractor("B") },
      selfCheck: { singleCorrectAnswer: true },
    });

    expect(result.qualityMeta).toBeUndefined();
    expect(result.distractorDesign).toBeUndefined();
    expect(result.teacherExplanation).toBeUndefined();
    expect(result.selfCheck).toBeUndefined();
  });
});
