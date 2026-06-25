import { describe, expect, it } from "vitest";
import {
  buildPartialSlotView,
  getMissingItemTeacherMessage,
  getPartialResultSummary,
  getSlotsForGeneratedItems,
  isPartialGenerationResult,
  normalizePartialResult,
} from "../frontend/src/core/partialResult.js";

const slots = Array.from({ length: 4 }, (_, index) => ({
  itemId: `Q-${String(index + 1).padStart(3, "0")}`,
  questionType: "選擇題",
}));

function item(index, patch = {}) {
  return {
    itemId: `Q-${String(index).padStart(3, "0")}`,
    itemIndex: index,
    question: `Question ${index}`,
    ...patch,
  };
}

describe("partial result helpers", () => {
  it("treats partial as a success-like generation result", () => {
    expect(isPartialGenerationResult({ status: "partial" })).toBe(true);
    expect(isPartialGenerationResult({ partial: true })).toBe(true);
    expect(isPartialGenerationResult({ status: "completed" })).toBe(false);
  });

  it("normalizes safe missing metadata without copying raw details", () => {
    const result = normalizePartialResult({
      status: "partial",
      requestedItemCount: 4,
      completedItemCount: 3,
      missingItems: [
        {
          itemIndex: 3,
          batchNumber: 2,
          errorCode: "AI_OUTPUT_CONTRACT_INVALID",
          rawOutput: "should not be copied",
          optionText: "should not be copied",
        },
      ],
    });

    expect(result).toEqual({
      partial: true,
      requestedItemCount: 4,
      completedItemCount: 3,
      missingCount: 1,
      missingItems: [
        {
          itemIndex: 3,
          batchNumber: 2,
          errorCode: "AI_OUTPUT_CONTRACT_INVALID",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("should not be copied");
  });

  it("builds success-framed summary copy", () => {
    expect(getPartialResultSummary({
      requestedItemCount: 50,
      completedItemCount: 47,
      missingCount: 3,
    }).title).toBe("已完成 47 / 50 題，3 題待補");
  });

  it("uses one teacher-facing message instead of classifying internal error codes", () => {
    expect(getMissingItemTeacherMessage({ errorCode: "AI_OUTPUT_CONTRACT_INVALID" })).toBe("此題未能生成，可於後續補齊。");
    expect(getMissingItemTeacherMessage({ errorCode: "AI_STIMULUS_MISSING" })).toBe("此題未能生成，可於後續補齊。");
    expect(getMissingItemTeacherMessage({ errorCode: "UNKNOWN_CODE" })).toBe("此題未能生成，可於後續補齊。");
  });

  it("creates a slot view that preserves original positions", () => {
    const view = buildPartialSlotView({
      slots,
      items: [item(1), item(2), item(4)],
      missingItems: [{ itemIndex: 3, errorCode: "AI_STIMULUS_MISSING" }],
    });

    expect(view.map((entry) => `${entry.type}:${entry.itemIndex}`)).toEqual([
      "item:1",
      "item:2",
      "missing:3",
      "item:4",
    ]);
    expect(view[2]).toMatchObject({
      message: "此題未能生成，可於後續補齊。",
      missingItem: {
        itemIndex: 3,
        errorCode: "AI_STIMULUS_MISSING",
      },
    });
  });

  it("does not convert missing slots into generated items", () => {
    const view = buildPartialSlotView({
      slots,
      items: [item(1), item(4)],
      missingItems: [
        { itemIndex: 2, errorCode: "AI_JSON_PARSE_FAILED" },
        { itemIndex: 3, errorCode: "AI_OUTPUT_CONTRACT_INVALID" },
      ],
    });

    const generatedItems = view.flatMap((entry) => entry.items || []);
    expect(generatedItems).toHaveLength(2);
    expect(generatedItems.map((entry) => entry.itemIndex)).toEqual([1, 4]);
  });

  it("selects validation slots for generated items only", () => {
    const validationSlots = getSlotsForGeneratedItems({
      slots,
      items: [item(1), item(4)],
    });

    expect(validationSlots.map((slot) => slot.itemId)).toEqual(["Q-001", "Q-004"]);
  });
});
