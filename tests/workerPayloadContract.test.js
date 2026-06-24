import { describe, expect, it } from "vitest";
import { ERROR_CODES, assertItemsPayload, safeErrorPayload } from "../worker/src/json.js";

function qualityMeta(overrides = {}) {
  return {
    teacherExplanation: "本題檢核學生是否能理解題意並辨識正確解法。",
    correctReason: "A 是唯一符合題意的答案。",
    distractorDesign: {},
    selfCheck: {
      singleCorrectAnswer: true,
    },
    ...overrides,
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
    expect(result.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(result.error).toContain("missing question text");
  });

  it("passes items with compatible fallback question text fields", () => {
    const result = assertItemsPayload({
      items: [item({ question: undefined, stem: "下列哪一項說明正確？" })],
    });

    expect(result.ok).toBe(true);
  });

  it("passes normal payloads with minimum qualityMeta", () => {
    const payload = { items: [item()] };
    const result = assertItemsPayload(payload);

    expect(result.ok).toBe(true);
    expect(result.items).toBe(payload.items);
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
});
