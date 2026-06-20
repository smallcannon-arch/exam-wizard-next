import { describe, expect, it } from "vitest";
import {
  normalizeGeneratedItem,
  normalizeGeneratedItems,
} from "../frontend/src/core/normalizeItem.js";
import { validateGeneratedPaper } from "../frontend/src/core/validateGeneratedPaper.js";

function completeLegacyQualityFields() {
  return {
    subject: "國語",
    grade: "四年級",
    unit: "閱讀理解",
    cognitiveLevel: "理解",
    difficulty: "中",
    questionType: "選擇題",
    abilityFocus: "能理解題意並選出正確答案。",
    correctReason: "A 為正確答案，完整符合題幹要求。",
    teacherExplanation: "本題用來檢核學生是否能理解題意，三個錯誤選項分別對應不同迷思。",
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
    selfCheck: {
      singleCorrectAnswer: true,
      matchesPrimaryObjectiveId: true,
      matchesCognitiveLevel: true,
      allDistractorsHaveMisconceptionTags: true,
      noObviousGiveaway: true,
      gradeAppropriate: true,
      noUnnecessaryDifficulty: true,
    },
  };
}

describe("normalizeGeneratedItem", () => {
  it("保留原本 question", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-001",
      question: "原本題幹",
      answer: "A",
      explanation: "解析",
    });

    expect(item.question).toBe("原本題幹");
  });

  it("可將 stem 補成 question", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-002",
      stem: "AI 回傳的 stem 題幹",
      answer: "B",
    });

    expect(item.question).toBe("AI 回傳的 stem 題幹");
  });

  it("可將 problem 補成 question", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-003",
      problem: "AI 回傳的 problem 題幹",
      correctAnswer: "水和空氣",
      rationale: "因為鐵生鏽需要水和空氣。",
    });

    expect(item.question).toBe("AI 回傳的 problem 題幹");
    expect(item.answer).toBe("水和空氣");
    expect(item.explanation).toBe("因為鐵生鏽需要水和空氣。");
  });

  it("可整理物件形式的 options", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004",
      questionText: "下列何者正確？",
      options: [
        { label: "A. 水" },
        { label: "B. 空氣" },
        { label: "C. 油漆" },
      ],
    });

    expect(item.question).toBe("下列何者正確？");
    expect(item.options).toEqual(["A. 水", "B. 空氣", "C. 油漆"]);
  });

  it("可將舊頂層命題設計欄位收進 qualityMeta", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-005",
      question: "下列何者正確？",
      answer: "A",
      explanation: "學生解析",
      cognitiveLevel: "理解",
      questionType: "選擇題",
      abilityFocus: "能理解題意並選出正確答案。",
      correctReason: "A 正確。",
      teacherExplanation: "本題檢核概念理解。",
      distractorDesign: {
        B: { misconceptionTag: "keyword_trap" },
      },
      selfCheck: {
        singleCorrectAnswer: true,
      },
    });

    expect(item.qualityMeta.schemaVersion).toBe("item-quality-meta/v1");
    expect(item.qualityMeta.cognitiveLevel).toBe("理解");
    expect(item.qualityMeta.itemType).toBe("選擇題");
    expect(item.qualityMeta.abilityFocus).toBe("能理解題意並選出正確答案。");
    expect(item.qualityMeta.correctReason).toBe("A 正確。");
    expect(item.qualityMeta.teacherExplanation).toBe("本題檢核概念理解。");
    expect(item.qualityMeta.distractorDesign.B.misconceptionTag).toBe("keyword_trap");
    expect(item.qualityMeta.selfCheck.singleCorrectAnswer).toBe(true);
    expect(item.abilityFocus).toBeUndefined();
    expect(item.correctReason).toBeUndefined();
    expect(item.teacherExplanation).toBeUndefined();
    expect(item.distractorDesign).toBeUndefined();
    expect(item.selfCheck).toBeUndefined();
  });

  it("qualityMeta 既有欄位優先於頂層舊欄位", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-006",
      question: "下列何者正確？",
      answer: "A",
      abilityFocus: "頂層能力重點",
      correctReason: "頂層正答理由",
      teacherExplanation: "頂層教師解析",
      distractorDesign: {
        B: { misconceptionTag: "legacy_trap" },
      },
      selfCheck: {
        singleCorrectAnswer: false,
      },
      qualityMeta: {
        abilityFocus: "巢狀能力重點",
        correctReason: "巢狀正答理由",
        teacherExplanation: "巢狀教師解析",
        distractorDesign: {
          B: { misconceptionTag: "nested_trap" },
        },
        selfCheck: {
          singleCorrectAnswer: true,
        },
      },
    });

    expect(item.qualityMeta.abilityFocus).toBe("巢狀能力重點");
    expect(item.qualityMeta.correctReason).toBe("巢狀正答理由");
    expect(item.qualityMeta.teacherExplanation).toBe("巢狀教師解析");
    expect(item.qualityMeta.distractorDesign.B.misconceptionTag).toBe("nested_trap");
    expect(item.qualityMeta.selfCheck.singleCorrectAnswer).toBe(true);
    expect(item.abilityFocus).toBeUndefined();
    expect(item.correctReason).toBeUndefined();
    expect(item.teacherExplanation).toBeUndefined();
    expect(item.distractorDesign).toBeUndefined();
    expect(item.selfCheck).toBeUndefined();
  });

  it("舊扁平品質欄位正規化後可通過 v2 品質驗證", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-001",
      score: 2,
      primaryObjectiveId: "O-001",
      objectiveIds: ["O-001"],
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "A",
      explanation: "學生解析",
      ...completeLegacyQualityFields(),
    });

    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [{ objectiveId: "O-001", text: "目標一", periodCount: 1 }],
      items: [item],
      qualityMode: "v2",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("批次正規化 items", () => {
    const items = normalizeGeneratedItems([
      {
        itemId: "Q-001",
        question: "題目一",
      },
      {
        itemId: "Q-002",
        prompt: "題目二",
      },
    ]);

    expect(items.map((item) => item.question)).toEqual(["題目一", "題目二"]);
  });
});
