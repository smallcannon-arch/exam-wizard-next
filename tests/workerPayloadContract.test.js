import { describe, expect, it } from "vitest";
import { CONTRACT_VIOLATION_TYPES, ERROR_CODES, assertItemsPayload, safeErrorPayload } from "../worker/src/json.js";

function qualityMeta(overrides = {}) {
  return {
    teacherExplanation: "本題檢核學生是否能理解題意並辨識正確解法。",
    correctReason: "A 是唯一符合題意的答案。",
    distractorDesign: {
      B: distractor("B"),
      C: distractor("C"),
      D: distractor("D"),
    },
    selfCheck: {
      singleCorrectAnswer: true,
    },
    ...overrides,
  };
}

function distractor(option) {
  return {
    misconceptionTag: `misconception_${option}`,
    misconceptionDescription: `Why ${option} may look plausible.`,
    whyStudentsMayChooseIt: `Students may choose ${option}.`,
    whyItIsWrong: `${option} is wrong.`,
    revisionNote: `Keep ${option} distinct.`,
  };
}

function item(overrides = {}) {
  return {
    itemId: "Q-001",
    question: "下列何者正確？",
    options: ["A. 正確答案", "B. 錯誤答案", "C. 錯誤答案", "D. 錯誤答案"],
    answer: "A",
    qualityMeta: qualityMeta(),
    ...overrides,
  };
}

function itemWithoutOptions(overrides = {}) {
  const next = item(overrides);
  delete next.options;
  return next;
}

function slot(questionType, overrides = {}) {
  return {
    itemId: "Q-001",
    questionType,
    ...overrides,
  };
}

const CHOICE_TYPE = "\u9078\u64c7\u984c";
const TRUE_FALSE_TYPE = "\u662f\u975e\u984c";
const FILL_IN_TYPE = "\u586b\u5145\u984c";

function uiSlot(questionType, index, overrides = {}) {
  return slot(questionType, {
    itemId: `Q-${String(index).padStart(3, "0")}`,
    isGroup: false,
    subCount: 0,
    subScores: [],
    ...overrides,
  });
}

function trueFalseQualityMeta(answer = "O") {
  const wrong = answer === "X" ? "O" : "X";
  return qualityMeta({
    distractorDesign: {
      [wrong]: distractor(wrong),
    },
  });
}

function trueFalseItem(overrides = {}) {
  const answer = overrides.answer === "X" ? "X" : "O";
  const next = item({
    questionType: "true_false",
    answer,
    correctAnswer: answer,
    qualityMeta: trueFalseQualityMeta(answer),
  });
  delete next.options;
  return {
    ...next,
    ...overrides,
  };
}

function fillInItem(overrides = {}) {
  const next = item({
    questionType: "fill_in",
    answer: "water",
    acceptedAnswers: ["water", "Water"],
    qualityMeta: qualityMeta({
      distractorDesign: {},
    }),
  });
  delete next.options;
  return {
    ...next,
    ...overrides,
  };
}

function expectContractViolation(result, type, field) {
  expect(result.ok).toBe(false);
  expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
  expect(result.contractViolation).toMatchObject({
    type,
    itemIndex: 1,
    field,
  });
}

describe("Worker items payload contract", () => {
  it("rejects payloads missing items", () => {
    const result = assertItemsPayload({});

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID);
  });

  it("rejects payloads when items is not an array", () => {
    const result = assertItemsPayload({ items: {} });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID);
  });

  it("rejects items missing qualityMeta", () => {
    const result = assertItemsPayload({ items: [item({ qualityMeta: undefined })] });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
  });

  it("rejects items missing qualityMeta.teacherExplanation", () => {
    const result = assertItemsPayload({
      items: [item({ qualityMeta: qualityMeta({ teacherExplanation: "" }) })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
  });

  it("rejects items missing qualityMeta.correctReason", () => {
    const result = assertItemsPayload({
      items: [item({ qualityMeta: qualityMeta({ correctReason: " " }) })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
  });

  it("rejects items missing qualityMeta.distractorDesign", () => {
    const meta = qualityMeta();
    delete meta.distractorDesign;

    const result = assertItemsPayload({ items: [item({ qualityMeta: meta })] });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
  });

  it("rejects items missing qualityMeta.selfCheck", () => {
    const meta = qualityMeta();
    delete meta.selfCheck;

    const result = assertItemsPayload({ items: [item({ qualityMeta: meta })] });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
  });

  it("rejects items missing question text", () => {
    const result = assertItemsPayload({ items: [item({ question: undefined })] });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_ITEM_TEXT_MISSING);
    expect(result.error).toContain("missing question text");
  });

  it("passes items with compatible fallback question text fields", () => {
    const result = assertItemsPayload({
      items: [item({ question: undefined, stem: "下列哪一項說明正確？" })],
    });

    expect(result.ok).toBe(true);
  });

  it("rejects items that reference reading text without stimulus", () => {
    const result = assertItemsPayload({
      items: [item({ question: "根據本文，下列哪一項說明正確？", stimulus: "" })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_STIMULUS_MISSING);
    expect(result.error).toContain("missing stimulus");
  });

  it("rejects reading-comprehension items without stimulus", () => {
    const result = assertItemsPayload({
      items: [item({ questionType: "閱讀測驗", stimulus: undefined })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_STIMULUS_MISSING);
  });

  it("passes items that reference reading text with stimulus", () => {
    const result = assertItemsPayload({
      items: [item({
        question: "根據本文，下列哪一項說明正確？",
        stimulus: "小明閱讀一篇關於校園植物的短文，並整理出主要內容。",
      })],
    });

    expect(result.ok).toBe(true);
  });

  it("passes normal payloads with minimum qualityMeta", () => {
    const payload = { items: [item()] };
    const result = assertItemsPayload(payload);

    expect(result.ok).toBe(true);
    expect(result.items).toBe(payload.items);
  });

  it("rejects choice items with more than A/B/C/D options", () => {
    const result = assertItemsPayload({
      items: [item({ options: ["A", "B", "C", "D", "E"] })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toEqual({
      type: CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID,
      types: [CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID],
      itemIndex: 1,
      field: "options",
      optionCode: "E",
    });
  });

  it("rejects choice items with empty option text and returns safe metadata", () => {
    const result = assertItemsPayload({
      items: [item({ options: ["A", "B", "", "D"] })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.OPTIONS_TEXT_INVALID,
      itemIndex: 1,
      field: "options",
    });
  });

  it("rejects choice items with invalid answer codes and returns safe metadata", () => {
    const result = assertItemsPayload({
      items: [item({ answer: "E" })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.ANSWER_CODE_INVALID,
      itemIndex: 1,
      field: "answer",
      optionCode: "E",
    });
  });

  it("rejects distractorDesign keys outside A/B/C/D", () => {
    const result = assertItemsPayload({
      items: [item({
        qualityMeta: qualityMeta({
          distractorDesign: {
            B: distractor("B"),
            C: distractor("C"),
            D: distractor("D"),
            E: distractor("E"),
          },
        }),
      })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.DISTRACTOR_KEY_INVALID,
      itemIndex: 1,
      field: "qualityMeta.distractorDesign",
      optionCode: "E",
    });
  });

  it("rejects choice items missing a wrong-option distractorDesign entry", () => {
    const result = assertItemsPayload({
      items: [item({
        qualityMeta: qualityMeta({
          distractorDesign: {
            B: distractor("B"),
            C: distractor("C"),
          },
        }),
      })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.DISTRACTOR_MISSING_WRONG_OPTION,
      itemIndex: 1,
      field: "qualityMeta.distractorDesign",
      optionCode: "D",
    });
  });

  it("rejects distractorDesign entries for the correct answer", () => {
    const result = assertItemsPayload({
      items: [item({
        qualityMeta: qualityMeta({
          distractorDesign: {
            A: distractor("A"),
            B: distractor("B"),
            C: distractor("C"),
            D: distractor("D"),
          },
        }),
      })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.DISTRACTOR_CORRECT_ANSWER_INCLUDED,
      itemIndex: 1,
      field: "qualityMeta.distractorDesign",
      optionCode: "A",
    });
  });

  it("rejects distractorDesign entries missing required fields", () => {
    const missing = distractor("B");
    delete missing.misconceptionTag;

    const result = assertItemsPayload({
      items: [item({
        qualityMeta: qualityMeta({
          distractorDesign: {
            B: missing,
            C: distractor("C"),
            D: distractor("D"),
          },
        }),
      })],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.DISTRACTOR_REQUIRED_FIELD_MISSING,
      itemIndex: 1,
      field: "misconceptionTag",
      optionCode: "B",
    });
  });

  it("accepts lowercase wrong-option distractorDesign keys after normalization", () => {
    const payload = {
      items: [item({
        qualityMeta: qualityMeta({
          distractorDesign: {
            b: distractor("B"),
            c: distractor("C"),
            d: distractor("D"),
          },
        }),
      })],
    };
    const result = assertItemsPayload(payload);

    expect(result.ok).toBe(true);
  });

  it("rejects requested choice-like slots when options are missing", () => {
    const result = assertItemsPayload({
      items: [itemWithoutOptions({ questionType: "choice" })],
    }, 1, {
      expectedSlots: [slot(CHOICE_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID,
      itemIndex: 1,
      field: "options",
      optionCode: null,
    });
  });

  it("accepts requested true/false slots without choice options", () => {
    const result = assertItemsPayload({
      items: [itemWithoutOptions({
        questionType: "true_false",
        answer: "O",
        correctAnswer: "O",
        qualityMeta: qualityMeta({
          distractorDesign: {
            X: distractor("X"),
          },
        }),
      })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expect(result.ok).toBe(true);
  });

  it("accepts requested true/false slots with X answers", () => {
    const result = assertItemsPayload({
      items: [trueFalseItem({
        answer: "X",
        correctAnswer: "X",
        qualityMeta: trueFalseQualityMeta("X"),
      })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expect(result.ok).toBe(true);
  });

  it("currently rejects requested true/false slots with empty options arrays", () => {
    const result = assertItemsPayload({
      items: [trueFalseItem({ options: [] })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.TRUE_FALSE_OPTIONS_INVALID, "options");
  });

  it.each([
    ["yes text", "\u662f"],
    ["no text", "\u5426"],
    ["boolean true", true],
    ["boolean false", false],
  ])("currently rejects requested true/false slots with %s answers", (_label, answer) => {
    const result = assertItemsPayload({
      items: [trueFalseItem({ answer })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.TRUE_FALSE_ANSWER_INVALID, "answer");
  });

  it("rejects requested true/false slots that include choice options", () => {
    const result = assertItemsPayload({
      items: [item({
        questionType: "true_false",
        answer: "O",
        qualityMeta: qualityMeta({
          distractorDesign: {
            X: distractor("X"),
          },
        }),
      })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.TRUE_FALSE_OPTIONS_INVALID,
      itemIndex: 1,
      field: "options",
    });
  });

  it("rejects requested true/false slots with non O/X answers", () => {
    const result = assertItemsPayload({
      items: [itemWithoutOptions({
        questionType: "true_false",
        answer: "A",
        qualityMeta: qualityMeta({
          distractorDesign: {
            X: distractor("X"),
          },
        }),
      })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.TRUE_FALSE_ANSWER_INVALID,
      itemIndex: 1,
      field: "answer",
      optionCode: "A",
    });
  });

  it("rejects requested true/false slots when model self-reports choice", () => {
    const result = assertItemsPayload({
      items: [trueFalseItem({ questionType: "choice" })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH, "questionType");
  });

  it("accepts requested fill-in slots without choice options", () => {
    const result = assertItemsPayload({
      items: [itemWithoutOptions({
        questionType: "fill_in",
        answer: "water",
        acceptedAnswers: ["water", "Water"],
        qualityMeta: qualityMeta({
          distractorDesign: {},
        }),
      })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expect(result.ok).toBe(true);
  });

  it("currently rejects requested fill-in slots with empty options arrays", () => {
    const result = assertItemsPayload({
      items: [fillInItem({ options: [] })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.FILL_IN_OPTIONS_INVALID, "options");
  });

  it("rejects requested fill-in slots with empty answers", () => {
    const result = assertItemsPayload({
      items: [fillInItem({ answer: " " })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.FILL_IN_ANSWER_INVALID, "answer");
  });

  it.each(["A", "B", "C", "D", "O", "X"])(
    "currently rejects requested fill-in slots with answer code %s",
    (answer) => {
      const result = assertItemsPayload({
        items: [fillInItem({ answer })],
      }, 1, {
        expectedSlots: [slot(FILL_IN_TYPE)],
      });

      expectContractViolation(result, CONTRACT_VIOLATION_TYPES.FILL_IN_ANSWER_INVALID, "answer");
    },
  );

  it("rejects requested fill-in slots that include choice options", () => {
    const result = assertItemsPayload({
      items: [item({
        questionType: "fill_in",
        answer: "water",
        qualityMeta: qualityMeta({
          distractorDesign: {},
        }),
      })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.FILL_IN_OPTIONS_INVALID,
      itemIndex: 1,
      field: "options",
    });
  });

  it("rejects requested fill-in slots with answer codes instead of text", () => {
    const result = assertItemsPayload({
      items: [itemWithoutOptions({
        questionType: "fill_in",
        answer: "A",
        qualityMeta: qualityMeta({
          distractorDesign: {},
        }),
      })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.FILL_IN_ANSWER_INVALID,
      itemIndex: 1,
      field: "answer",
      optionCode: "A",
    });
  });

  it("rejects requested fill-in slots when model self-reports choice", () => {
    const result = assertItemsPayload({
      items: [fillInItem({ questionType: "choice" })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH, "questionType");
  });

  it("currently rejects requested fill-in slots with answer string arrays", () => {
    const result = assertItemsPayload({
      items: [fillInItem({ answer: ["water", "Water"] })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expectContractViolation(result, CONTRACT_VIOLATION_TYPES.FILL_IN_ANSWER_INVALID, "answer");
  });

  it("does not expose raw item text in typed contract diagnostics", () => {
    const rawMarker = "RAW_TRUE_FALSE_FIXTURE_MARKER";
    const result = assertItemsPayload({
      items: [trueFalseItem({
        question: rawMarker,
        answer: "A",
      })],
    }, 1, {
      expectedSlots: [slot(TRUE_FALSE_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(rawMarker);
  });

  it("accepts true/false UI-shaped payload fixtures", () => {
    const expectedSlots = [1, 2, 3, 4].map((index) => uiSlot(TRUE_FALSE_TYPE, index));
    const items = [1, 2, 3, 4].map((index) => trueFalseItem({
      itemId: `Q-${String(index).padStart(3, "0")}`,
      answer: index % 2 === 0 ? "X" : "O",
      correctAnswer: index % 2 === 0 ? "X" : "O",
      qualityMeta: trueFalseQualityMeta(index % 2 === 0 ? "X" : "O"),
    }));

    const result = assertItemsPayload({ items }, 4, { expectedSlots });

    expect(expectedSlots).toHaveLength(4);
    expect(expectedSlots.every((entry) => entry.questionType === TRUE_FALSE_TYPE)).toBe(true);
    expect(expectedSlots.every((entry) => entry.isGroup === false)).toBe(true);
    expect(expectedSlots.every((entry) => entry.subCount === 0)).toBe(true);
    expect(expectedSlots.every((entry) => Array.isArray(entry.subScores) && entry.subScores.length === 0)).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("accepts fill-in UI-shaped payload fixtures", () => {
    const expectedSlots = [1, 2, 3, 4].map((index) => uiSlot(FILL_IN_TYPE, index));
    const items = [1, 2, 3, 4].map((index) => fillInItem({
      itemId: `Q-${String(index).padStart(3, "0")}`,
      answer: `answer ${index}`,
      acceptedAnswers: [`answer ${index}`],
    }));

    const result = assertItemsPayload({ items }, 4, { expectedSlots });

    expect(expectedSlots).toHaveLength(4);
    expect(expectedSlots.every((entry) => entry.questionType === FILL_IN_TYPE)).toBe(true);
    expect(expectedSlots.every((entry) => entry.isGroup === false)).toBe(true);
    expect(expectedSlots.every((entry) => entry.subCount === 0)).toBe(true);
    expect(expectedSlots.every((entry) => Array.isArray(entry.subScores) && entry.subScores.length === 0)).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("uses requested slot questionType as authority instead of model self-report", () => {
    const result = assertItemsPayload({
      items: [item({
        questionType: "choice",
      })],
    }, 1, {
      expectedSlots: [slot(FILL_IN_TYPE)],
    });

    expect(result.ok).toBe(false);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH,
      itemIndex: 1,
      field: "questionType",
    });
  });

  it("rejects typed validation slots that omit requested questionType", () => {
    const result = assertItemsPayload({
      items: [item({
        questionType: "choice",
      })],
    }, 1, {
      expectedSlots: [{ itemId: "Q-001" }],
    });

    expect(result.ok).toBe(false);
    expect(result.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISSING,
      itemIndex: 1,
      field: "questionType",
    });
  });

  it("accepts requested group slots expanded as child items with stimulus and rejects missing stimulus", () => {
    const groupSlot = slot("proficiency", { isGroup: true, subCount: 2, subScores: [2, 3] });
    const accepted = assertItemsPayload({
      items: [
        item({
          itemId: "Q-001-1",
          questionType: "proficiency",
          groupId: "G-001",
          stimulus: "Shared reading text",
          score: 2,
        }),
        item({
          itemId: "Q-001-2",
          questionType: "proficiency",
          groupId: "G-001",
          stimulus: "",
          score: 3,
        }),
      ],
    }, 2, {
      expectedSlots: [groupSlot],
    });
    const inheritedStimulus = assertItemsPayload({
      items: [
        item({
          itemId: "Q-001-1",
          questionType: "proficiency",
          groupId: "G-001",
          stimulus: "Shared reading text",
        }),
        item({
          itemId: "Q-001-2",
          questionType: "proficiency",
          groupId: "G-001",
          stimulus: "",
        }),
      ],
    }, 2, {
      expectedSlots: [groupSlot],
    });
    const missingStimulus = assertItemsPayload({
      items: [
        item({
          itemId: "Q-001-1",
          questionType: "proficiency",
          groupId: "G-001",
          stimulus: "",
        }),
        item({
          itemId: "Q-001-2",
          questionType: "proficiency",
          groupId: "G-001",
          stimulus: "",
        }),
      ],
    }, 2, {
      expectedSlots: [groupSlot],
    });

    expect(accepted.ok).toBe(true);
    expect(inheritedStimulus.ok).toBe(true);
    expect(missingStimulus.ok).toBe(false);
    expect(missingStimulus.contractViolation).toMatchObject({
      type: CONTRACT_VIOLATION_TYPES.GROUP_STIMULUS_INVALID,
      itemIndex: 1,
      field: "stimulus",
    });
  });

  it("does not expose raw prompt, raw output, tokens, headers, or stack traces in error payloads", () => {
    const payload = safeErrorPayload({
      error: "raw prompt raw output API_KEY token headers stack trace",
      errorCode: ERROR_CODES.GEMINI_UPSTREAM_ERROR,
    });
    const text = JSON.stringify(payload).toLowerCase();

    expect(payload.errorCode).toBe(ERROR_CODES.GEMINI_UPSTREAM_ERROR);
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("api_key");
    expect(text).not.toContain("token");
    expect(text).not.toContain("headers");
    expect(text).not.toContain("stack trace");
  });

  it("keeps specific output contract error codes in safe error payloads", () => {
    const itemTextPayload = safeErrorPayload({
      error: "AI response item 1 is missing question text.",
      errorCode: ERROR_CODES.AI_ITEM_TEXT_MISSING,
    });
    const stimulusPayload = safeErrorPayload({
      error: "AI response item 1 references reading text but is missing stimulus.",
      errorCode: ERROR_CODES.AI_STIMULUS_MISSING,
    });

    expect(itemTextPayload.errorCode).toBe(ERROR_CODES.AI_ITEM_TEXT_MISSING);
    expect(stimulusPayload.errorCode).toBe(ERROR_CODES.AI_STIMULUS_MISSING);
  });
});
