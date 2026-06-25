import { describe, expect, it } from "vitest";
import {
  isRetryableGenerationFailure,
  shouldRetryGeneration,
} from "../frontend/src/core/generationRetry.js";

describe("generation retry policy", () => {
  it("retries transient upstream failures once", () => {
    const result = { ok: false, error: "AI service temporarily unavailable", errorCode: "GEMINI_UPSTREAM_ERROR" };

    expect(isRetryableGenerationFailure(result)).toBe(true);
    expect(shouldRetryGeneration({ result, attempt: 1, maxAttempts: 2 })).toBe(true);
    expect(shouldRetryGeneration({ result, attempt: 2, maxAttempts: 2 })).toBe(false);
  });

  it("does not retry long client or worker timeouts", () => {
    expect(isRetryableGenerationFailure({ ok: false, error: "timeout", errorCode: "CLIENT_TIMEOUT" })).toBe(false);
    expect(isRetryableGenerationFailure({ ok: false, error: "timeout", errorCode: "GEMINI_TIMEOUT" })).toBe(false);
    expect(isRetryableGenerationFailure({ ok: false, errorCode: "AI_JSON_TRUNCATED" })).toBe(false);
  });

  it("does not retry output contract failures", () => {
    expect(isRetryableGenerationFailure({ ok: false, errorCode: "AI_JSON_NO_OBJECT" })).toBe(false);
    expect(isRetryableGenerationFailure({ ok: false, errorCode: "AI_QUALITY_META_MISSING" })).toBe(false);
    expect(isRetryableGenerationFailure({ ok: false, errorCode: "AI_ITEMS_PAYLOAD_INVALID" })).toBe(false);
    expect(isRetryableGenerationFailure({ ok: false, errorCode: "AI_OUTPUT_CONTRACT_INVALID" })).toBe(false);
  });

  it("retries legacy 502 and network failures when no errorCode is available", () => {
    expect(isRetryableGenerationFailure({ ok: false, error: "HTTP 502" })).toBe(true);
    expect(isRetryableGenerationFailure({ ok: false, error: "network fetch failed" })).toBe(true);
  });
});
