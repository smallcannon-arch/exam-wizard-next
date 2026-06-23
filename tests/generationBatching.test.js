import { describe, expect, it } from "vitest";
import {
  createGenerationBatches,
  mergeSerialBatchItems,
  shouldUseSerialBatching,
} from "../frontend/src/core/generationBatching.js";

function intent(id, overrides = {}) {
  return {
    itemId: id,
    questionType: "choice",
    score: 1,
    ...overrides,
  };
}

function item(id, overrides = {}) {
  return {
    itemId: id,
    question: "Question",
    answer: "A",
    ...overrides,
  };
}

describe("generation serial batching helpers", () => {
  it("keeps 1 to 6 item generations on the single-call path", () => {
    expect(shouldUseSerialBatching(Array.from({ length: 6 }, (_, index) => intent(`Q-${index + 1}`)))).toBe(false);
  });

  it("enables serial batching for 7 to 12 items", () => {
    expect(shouldUseSerialBatching(Array.from({ length: 7 }, (_, index) => intent(`Q-${index + 1}`)))).toBe(true);
    expect(shouldUseSerialBatching(Array.from({ length: 12 }, (_, index) => intent(`Q-${index + 1}`)))).toBe(true);
  });

  it("does not enable serial batching above the MVP maximum", () => {
    expect(shouldUseSerialBatching(Array.from({ length: 13 }, (_, index) => intent(`Q-${index + 1}`)))).toBe(false);
  });

  it("splits 8 items into two ordered batches of 4", () => {
    const intents = Array.from({ length: 8 }, (_, index) => intent(`Q-${index + 1}`));
    const batches = createGenerationBatches(intents);

    expect(batches).toHaveLength(2);
    expect(batches[0].expectedItemIds).toEqual(["Q-1", "Q-2", "Q-3", "Q-4"]);
    expect(batches[1].expectedItemIds).toEqual(["Q-5", "Q-6", "Q-7", "Q-8"]);
    expect(batches.map((batch) => batch.batchNumber)).toEqual([1, 2]);
  });

  it("keeps grouped intents as atomic blueprint entries", () => {
    const intents = [
      intent("Q-1"),
      intent("Q-2", { isGroup: true, subScores: [2, 3] }),
      intent("Q-3"),
    ];
    const batches = createGenerationBatches(intents, { maxItemsPerBatch: 2 });

    expect(batches[0].intents.map((entry) => entry.itemId)).toEqual(["Q-1", "Q-2"]);
    expect(batches[1].intents.map((entry) => entry.itemId)).toEqual(["Q-3"]);
  });

  it("merges validated batch items in batch order", () => {
    const batches = createGenerationBatches([intent("Q-1"), intent("Q-2"), intent("Q-3")], { maxItemsPerBatch: 2 });
    const result = mergeSerialBatchItems({
      batches,
      batchItems: [
        [item("Q-1"), item("Q-2")],
        [item("Q-3")],
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.items.map((entry) => entry.itemId)).toEqual(["Q-1", "Q-2", "Q-3"]);
  });

  it("rejects duplicate item IDs across batches", () => {
    const batches = createGenerationBatches([intent("Q-1"), intent("Q-2")], { maxItemsPerBatch: 1 });
    const result = mergeSerialBatchItems({
      batches,
      batchItems: [
        [item("Q-1")],
        [item("q-1")],
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("duplicate itemId");
  });

  it("rejects empty batch results", () => {
    const batches = createGenerationBatches([intent("Q-1")]);
    const result = mergeSerialBatchItems({ batches, batchItems: [[]] });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("did not return any validated items");
  });
});
