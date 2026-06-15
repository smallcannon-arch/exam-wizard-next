import { describe, expect, it } from "vitest";
import { buildProportionalSequence, interleaveByCounts, largestRemainder } from "../frontend/src/core/distribute.js";

function countByKey(sequence) {
  const counts = {};
  for (const key of sequence) counts[key] = (counts[key] || 0) + 1;
  return counts;
}

describe("largestRemainder", () => {
  it("70/20/10 分到 10 個名額為 7/2/1", () => {
    const result = largestRemainder(10, [
      { key: "選擇題", weight: 70 },
      { key: "填充題", weight: 20 },
      { key: "短答題", weight: 10 },
    ]);

    expect(result).toEqual([
      { key: "選擇題", count: 7 },
      { key: "填充題", count: 2 },
      { key: "短答題", count: 1 },
    ]);
  });

  it("總名額為 0 或無權重時，count 皆為 0", () => {
    expect(largestRemainder(0, [{ key: "a", weight: 1 }])).toEqual([{ key: "a", count: 0 }]);
    expect(largestRemainder(5, [])).toEqual([]);
  });
});

describe("interleaveByCounts", () => {
  it("保留各類別數量並交錯展開", () => {
    const sequence = interleaveByCounts([
      { key: "選擇題", count: 7 },
      { key: "填充題", count: 2 },
      { key: "短答題", count: 1 },
    ]);

    expect(sequence).toHaveLength(10);
    expect(countByKey(sequence)).toEqual({ 選擇題: 7, 填充題: 2, 短答題: 1 });
  });
});

describe("buildProportionalSequence", () => {
  it("依比例產生長度正確、數量正確的序列", () => {
    const sequence = buildProportionalSequence(20, [
      { key: "選擇題", weight: 50 },
      { key: "填充題", weight: 50 },
    ]);

    expect(sequence).toHaveLength(20);
    expect(countByKey(sequence)).toEqual({ 選擇題: 10, 填充題: 10 });
  });
});
