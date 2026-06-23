import { describe, expect, it } from "vitest";
import { DEFAULT_GEMINI_TIMEOUT_MS, resolveGeminiTimeoutMs } from "../worker/src/gemini.js";

describe("Worker Gemini timeout policy", () => {
  it("defaults to five minutes to avoid premature aborts", () => {
    expect(DEFAULT_GEMINI_TIMEOUT_MS).toBe(300000);
    expect(resolveGeminiTimeoutMs({})).toBe(300000);
  });

  it("allows environment overrides", () => {
    expect(resolveGeminiTimeoutMs({ GEMINI_TIMEOUT_MS: "240000" })).toBe(240000);
  });

  it("falls back when the configured timeout is invalid", () => {
    expect(resolveGeminiTimeoutMs({ GEMINI_TIMEOUT_MS: "0" })).toBe(300000);
    expect(resolveGeminiTimeoutMs({ GEMINI_TIMEOUT_MS: "not-a-number" })).toBe(300000);
  });
});
