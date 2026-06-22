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

function distractorDesignEntry(tag = "keyword_trap") {
  return {
    misconceptionTag: tag,
    misconceptionDescription: "學生受到表面線索影響。",
    whyStudentsMayChooseIt: "此選項看似合理。",
    whyItIsWrong: "此選項不符合題幹完整條件。",
    revisionNote: "保留此誘答。",
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

  it("可整理 options 陣列中的選項物件", () => {
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

  it("可將 A/B/C/D key 的 options 物件轉成陣列", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004A",
      question: "下列何者正確？",
      answer: "C",
      options: {
        C: "三號選項",
        A: "一號選項",
        D: "四號選項",
        B: "二號選項",
      },
    });

    expect(item.options).toEqual(["一號選項", "二號選項", "三號選項", "四號選項"]);
    expect(item.answer).toBe("C");
  });

  it("可將 options 物件中的選項物件轉成陣列", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004B",
      question: "下列何者正確？",
      answer: "B",
      options: {
        A: { text: "甲選項" },
        B: { label: "乙選項" },
        C: { value: "丙選項" },
        D: { content: "丁選項" },
      },
    });

    expect(item.options).toEqual(["甲選項", "乙選項", "丙選項", "丁選項"]);
    expect(item.answer).toBe("B");
  });

  it("answer 已是 A/B/C/D 時維持選項代號", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004C1",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "A",
    });

    expect(item.answer).toBe("A");
  });

  it("answer 是唯一選項文字時可轉成 A/B/C/D", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004C2",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "乙",
    });

    expect(item.answer).toBe("B");
  });

  it("answer 是選項文字但無法唯一對應時不靜默猜測", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004C3",
      question: "下列何者正確？",
      options: ["甲", "乙", "乙", "丁"],
      answer: "乙",
    });

    expect(item.answer).toBe("乙");
  });

  it("correctAnswer 是唯一選項文字時可同步轉成 A/B/C/D", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004C4",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      correctAnswer: "乙",
    });

    expect(item.answer).toBe("B");
    expect(item.correctAnswer).toBe("B");
  });

  it("answer 與 correctAnswer 衝突時保留差異交由 validate 擋下", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004C5",
      questionType: "選擇題",
      score: 2,
      primaryObjectiveId: "O-001",
      objectiveIds: ["O-001"],
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "A",
      correctAnswer: "乙",
    });
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-004C5", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [{ objectiveId: "O-001", text: "目標一", periodCount: 1 }],
      items: [item],
    });

    expect(item.answer).toBe("A");
    expect(item.correctAnswer).toBe("B");
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("answer 與 correctAnswer 不一致"))).toBe(true);
  });

  it("不會把 qualityMeta.distractorDesign 誤當成 options", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004C",
      question: "下列何者正確？",
      answer: "A",
      qualityMeta: {
        abilityFocus: "辨識正確概念。",
        correctReason: "A 正確。",
        teacherExplanation: "本題檢核概念辨識。",
        distractorDesign: {
          B: { misconceptionTag: "keyword_trap" },
          C: { misconceptionTag: "partial_reading" },
        },
        selfCheck: {
          singleCorrectAnswer: true,
        },
      },
    });

    expect(item.options).toEqual([]);
    expect(item.qualityMeta.distractorDesign.B.misconceptionTag).toBe("keyword_trap");
  });

  it("distractorDesign keys 已是錯誤選項代號時維持", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004D1",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "A",
      qualityMeta: {
        abilityFocus: "辨識正確概念。",
        correctReason: "A 正確。",
        teacherExplanation: "本題檢核概念辨識。",
        distractorDesign: {
          B: distractorDesignEntry("keyword_trap"),
          C: distractorDesignEntry("partial_reading"),
          D: distractorDesignEntry("stem_neglect"),
        },
        selfCheck: { singleCorrectAnswer: true },
      },
    });

    expect(Object.keys(item.qualityMeta.distractorDesign)).toEqual(["B", "C", "D"]);
  });

  it("distractorDesign 使用選項文字作為 key 時可轉成錯誤選項代號", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004D2",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "乙",
      qualityMeta: {
        abilityFocus: "辨識正確概念。",
        correctReason: "B 正確。",
        teacherExplanation: "本題檢核概念辨識。",
        distractorDesign: {
          甲: distractorDesignEntry("keyword_trap"),
          丙: distractorDesignEntry("partial_reading"),
          丁: distractorDesignEntry("stem_neglect"),
        },
        selfCheck: { singleCorrectAnswer: true },
      },
    });

    expect(item.answer).toBe("B");
    expect(Object.keys(item.qualityMeta.distractorDesign)).toEqual(["A", "C", "D"]);
  });

  it("distractorDesign 正確答案 key 不會保留", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004D3",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "乙",
      qualityMeta: {
        abilityFocus: "辨識正確概念。",
        correctReason: "B 正確。",
        teacherExplanation: "本題檢核概念辨識。",
        distractorDesign: {
          甲: distractorDesignEntry("keyword_trap"),
          乙: distractorDesignEntry("should_not_exist"),
          丙: distractorDesignEntry("partial_reading"),
          丁: distractorDesignEntry("stem_neglect"),
        },
        selfCheck: { singleCorrectAnswer: true },
      },
    });

    expect(Object.keys(item.qualityMeta.distractorDesign)).toEqual(["A", "C", "D"]);
  });

  it("distractorDesign 不會被轉成 array", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-004D4",
      question: "下列何者正確？",
      options: ["甲", "乙", "丙", "丁"],
      answer: "A",
      qualityMeta: {
        abilityFocus: "辨識正確概念。",
        correctReason: "A 正確。",
        teacherExplanation: "本題檢核概念辨識。",
        distractorDesign: [{ option: "B", misconceptionTag: "keyword_trap" }],
        selfCheck: { singleCorrectAnswer: true },
      },
    });

    expect(Array.isArray(item.qualityMeta.distractorDesign)).toBe(false);
    expect(item.qualityMeta.distractorDesign).toEqual({});
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

  it("compact qualityMeta 可從 item context 補回系統 metadata", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-007",
      question: "下列何者正確？",
      answer: "A",
      subject: "數學",
      grade: "四年級",
      unitName: "角度",
      cognitiveLevel: "應用",
      difficulty: "中",
      itemType: "single_choice",
      qualityMeta: {
        abilityFocus: "能用鐘面模型判斷旋轉角。",
        correctReason: "A 能正確對應鐘面格數與角度。",
        teacherExplanation: "本題檢核學生是否能把鐘面格數轉換成旋轉角並避開方向混淆。",
        distractorDesign: {
          B: { misconceptionTag: "direction_confusion" },
        },
        selfCheck: {
          singleCorrectAnswer: true,
        },
      },
    });

    expect(item.qualityMeta.schemaVersion).toBe("item-quality-meta/v1");
    expect(item.qualityMeta.subject).toBe("數學");
    expect(item.qualityMeta.grade).toBe("四年級");
    expect(item.qualityMeta.unit).toBe("角度");
    expect(item.qualityMeta.cognitiveLevel).toBe("應用");
    expect(item.qualityMeta.difficulty).toBe("中");
    expect(item.qualityMeta.itemType).toBe("single_choice");
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

  it("可修復 4C 國語題 answer 文字與 distractorDesign 文字 key 回歸格式", () => {
    const item = normalizeGeneratedItem({
      itemId: "Q-CH-001",
      questionType: "選擇題",
      score: 2,
      primaryObjectiveId: "O-001",
      objectiveIds: ["O-001"],
      question: "下列哪個詞語最適合填入句中？",
      options: ["寬裕", "從容", "急忙", "隨便"],
      answer: "從容",
      explanation: "從容最符合句意。",
      qualityMeta: {
        schemaVersion: "item-quality-meta/v1",
        abilityFocus: "能依句意辨析語詞。",
        correctReason: "B 能符合句中不慌不忙的語意。",
        teacherExplanation: "本題檢核學生能否依句意辨析近義詞並排除語氣不合的誘答。",
        distractorDesign: {
          寬裕: distractorDesignEntry("near_synonym_confusion"),
          急忙: distractorDesignEntry("opposite_meaning"),
          隨便: distractorDesignEntry("tone_mismatch"),
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
    });
    const result = validateGeneratedPaper({
      slots: [{ itemId: "Q-CH-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001" }],
      objectives: [{ objectiveId: "O-001", text: "能依句意辨析語詞", periodCount: 1 }],
      items: [item],
      qualityMode: "v2",
    });

    expect(item.answer).toBe("B");
    expect(Object.keys(item.qualityMeta.distractorDesign)).toEqual(["A", "C", "D"]);
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
