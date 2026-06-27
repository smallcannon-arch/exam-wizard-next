import { describe, expect, it } from "vitest";
import {
  buildSafeGenerationFailureDetails,
  getGenerationFailureDisplayRows,
  serializeGenerationFailureDetails,
} from "../frontend/src/core/generationDiagnostics.js";

describe("generation failure diagnostics", () => {
  it("builds display rows for create failures", () => {
    const details = buildSafeGenerationFailureDetails({
      phase: "create",
      endpointPath: "https://worker.test/generation-jobs?secret=hidden",
      httpStatus: 500,
      errorCode: "ASYNC_JOB_UNAVAILABLE",
      errorMessage: "Worker temporarily unavailable.",
      requestId: "req_123",
      timestamp: "2026-06-27T00:00:00.000Z",
    });

    const rows = Object.fromEntries(getGenerationFailureDisplayRows(details));
    expect(rows["階段"]).toBe("建立工作");
    expect(rows.Phase).toBe("create");
    expect(rows["HTTP 狀態"]).toBe(500);
    expect(rows["錯誤代碼"]).toBe("ASYNC_JOB_UNAVAILABLE");
    expect(rows.Endpoint).toBe("/generation-jobs");
  });

  it("marks network and CORS-like failures as retryable", () => {
    const details = buildSafeGenerationFailureDetails({
      phase: "create",
      endpointPath: "/generation-jobs",
      errorMessage: "Failed to fetch",
      isNetworkError: true,
      isCorsLike: true,
    });

    expect(details.isNetworkError).toBe(true);
    expect(details.isCorsLike).toBe(true);
    expect(details.retryable).toBe(true);
    expect(details.advice).toContain("網路");
  });

  it("serializes copy diagnostics without prompt, payload, subject, or generated item text", () => {
    const details = buildSafeGenerationFailureDetails({
      phase: "result",
      endpointPath: "/generation-jobs/gen_1/result",
      jobId: "gen_1",
      errorCode: "ASYNC_JOB_RESULT_INVALID",
      errorMessage: "payload subject detail prompt generated item text answer should be hidden",
      timestamp: "2026-06-27T00:00:00.000Z",
    });

    const text = serializeGenerationFailureDetails(details);
    expect(text).toContain('"phase": "result"');
    expect(text).toContain('"jobId": "gen_1"');
    expect(text).not.toContain("payload subject");
    expect(text).not.toContain("prompt");
    expect(text).not.toContain("generated item text");
    expect(text).not.toContain("answer should");
  });

  it("keeps safe error codes intact in copied diagnostics", () => {
    const details = buildSafeGenerationFailureDetails({
      phase: "result",
      endpointPath: "/generation-jobs/gen_1/result",
      jobId: "gen_1",
      errorCode: "AI_ITEMS_PAYLOAD_INVALID",
      errorMessage: "safe",
      timestamp: "2026-06-27T00:00:00.000Z",
    });

    const text = serializeGenerationFailureDetails(details);
    expect(text).toContain('"errorCode": "AI_ITEMS_PAYLOAD_INVALID"');
    expect(text).toContain('"endpointPath": "/generation-jobs/gen_1/result"');
  });

  it("truncates long safe response messages", () => {
    const details = buildSafeGenerationFailureDetails({
      phase: "poll",
      endpointPath: "/generation-jobs/gen_1",
      errorMessage: "x".repeat(240),
    });

    expect(details.errorMessage).toHaveLength(203);
    expect(details.errorMessage.endsWith("...")).toBe(true);
  });
});
