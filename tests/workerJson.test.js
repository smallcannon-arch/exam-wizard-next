import { describe, expect, it } from "vitest";
import { ERROR_CODES, extractJsonObject, safeErrorPayload } from "../worker/src/json.js";

describe("Worker JSON extraction diagnostics", () => {
  it("keeps the existing tolerant parse behavior for prose-wrapped JSON", () => {
    const result = extractJsonObject("Here is the JSON:\n{\"items\":[{\"id\":\"Q-1\"}]}\nThanks.");

    expect(result.ok).toBe(true);
    expect(result.data.items).toHaveLength(1);
  });

  it("keeps the existing tolerant parse behavior for fenced JSON", () => {
    const result = extractJsonObject("```json\n{\"items\":[]}\n```");

    expect(result.ok).toBe(true);
    expect(result.data.items).toEqual([]);
  });

  it("classifies responses with no JSON object without exposing raw output", () => {
    const result = extractJsonObject("model returned prose only");
    const text = JSON.stringify(result).toLowerCase();

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_JSON_NO_OBJECT);
    expect(result.diagnostics).toMatchObject({
      finishReason: null,
      classificationSource: "parser",
      hasOpeningBrace: false,
      hasClosingBrace: false,
    });
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("api key");
    expect(text).not.toContain("token");
  });

  it("uses Gemini finishReason as hard evidence for truncated JSON", () => {
    const result = extractJsonObject("{\"items\":[", { finishReason: "MAX_TOKENS" });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_JSON_TRUNCATED);
    expect(result.diagnostics).toMatchObject({
      finishReason: "MAX_TOKENS",
      classificationSource: "finishReason",
    });
  });

  it("does not over-classify malformed JSON as truncated without finishReason evidence", () => {
    const result = extractJsonObject("{\"items\":[");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AI_JSON_NO_OBJECT);
    expect(result.diagnostics.classificationSource).toBe("parser");
  });

  it("keeps new parse error codes in safe error payloads", () => {
    expect(safeErrorPayload({
      error: "raw output should not be shown",
      errorCode: ERROR_CODES.AI_JSON_NO_OBJECT,
    })).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_JSON_NO_OBJECT });

    expect(safeErrorPayload({
      error: "raw output should not be shown",
      errorCode: ERROR_CODES.AI_JSON_TRUNCATED,
    })).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_JSON_TRUNCATED });
  });
});
