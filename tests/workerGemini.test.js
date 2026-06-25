import { afterEach, describe, expect, it, vi } from "vitest";
import { callGemini, DEFAULT_GEMINI_TIMEOUT_MS, resolveGeminiTimeoutMs } from "../worker/src/gemini.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("returns safe Gemini finishReason metadata without exposing request secrets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: {
            parts: [{ text: "{\"items\":[" }],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const result = await callGemini({
      env: { GEMINI_API_KEY: "secret-test-key" },
      prompt: "raw prompt should not be returned",
    });
    const text = JSON.stringify(result).toLowerCase();

    expect(result.ok).toBe(true);
    expect(result.finishReason).toBe("MAX_TOKENS");
    expect(text).not.toContain("secret-test-key");
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("headers");
    expect(text).not.toContain("x-goog-api-key");
  });
});
