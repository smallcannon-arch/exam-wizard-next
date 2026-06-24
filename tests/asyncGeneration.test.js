import { describe, expect, it } from "vitest";
import {
  createAsyncInitialProgress,
  isAsyncGenerationFailure,
  isAsyncGenerationSuccess,
  progressFromAsyncStatus,
  shouldUseAsyncGeneration,
} from "../frontend/src/core/asyncGeneration.js";

function intents(count) {
  return Array.from({ length: count }, (_, index) => ({ itemId: `Q-${index + 1}` }));
}

describe("asyncGeneration helpers", () => {
  it("uses async generation only for the large safe range", () => {
    expect(shouldUseAsyncGeneration(intents(12))).toBe(false);
    expect(shouldUseAsyncGeneration(intents(13))).toBe(true);
    expect(shouldUseAsyncGeneration(intents(50))).toBe(true);
    expect(shouldUseAsyncGeneration(intents(51))).toBe(false);
  });

  it("creates initial progress without a fake percentage", () => {
    expect(createAsyncInitialProgress(13)).toEqual({
      batchIndex: 0,
      batchCount: 4,
      completedItems: 0,
      currentBatchItems: 4,
    });
  });

  it("maps async job status to existing batch progress fields", () => {
    expect(progressFromAsyncStatus({
      requestedItemCount: 13,
      batchSize: 4,
      batchCount: 4,
      completedBatchCount: 2,
      completedItemCount: 8,
      currentBatch: 3,
    })).toEqual({
      batchIndex: 2,
      batchCount: 4,
      completedItems: 8,
      currentBatchItems: 4,
    });
  });

  it("detects terminal async statuses", () => {
    expect(isAsyncGenerationSuccess("completed")).toBe(true);
    expect(isAsyncGenerationFailure("failed")).toBe(true);
    expect(isAsyncGenerationFailure("partial_failed")).toBe(true);
    expect(isAsyncGenerationFailure("expired")).toBe(true);
    expect(isAsyncGenerationFailure("running")).toBe(false);
  });
});
