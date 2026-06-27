import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGenerationJobViaApi,
  getGenerationJobResultViaApi,
  getGenerationJobStatusViaApi,
} from "../frontend/src/apiClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchJson(body, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })));
}

function mockFetchText(body, status = 500) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  })));
}

function item() {
  return {
    itemId: "Q-1",
    question: "Question",
    options: { A: { text: "Alpha" }, B: { text: "Beta" }, C: { text: "Gamma" }, D: { text: "Delta" } },
    answer: "A",
    qualityMeta: {
      teacherExplanation: "Teacher explanation",
      correctReason: "Correct reason",
      distractorDesign: {
        B: "Distractor B",
        C: "Distractor C",
        D: "Distractor D",
      },
      selfCheck: {
        passed: true,
      },
    },
  };
}

describe("apiClient async generation job calls", () => {
  it("creates generation jobs with the safe async endpoint", async () => {
    mockFetchJson({ ok: true, jobId: "gen_12345678", status: "queued" }, 202);

    const result = await createGenerationJobViaApi({
      apiBaseUrl: "https://worker.test",
      project: { subject: "math" },
      materialText: "summary only",
      objectives: [{ objectiveId: "O-1", text: "Objective" }],
      intents: [{ itemId: "Q-1" }],
      checkedChineseSubcategories: [],
    });

    expect(result).toMatchObject({ ok: true, jobId: "gen_12345678", status: "queued" });
    expect(fetch).toHaveBeenCalledWith("https://worker.test/generation-jobs", expect.objectContaining({
      method: "POST",
    }));
  });

  it("returns safe create-job diagnostics for HTTP JSON failures without request payload", async () => {
    mockFetchJson({
      ok: false,
      errorCode: "ASYNC_JOB_UNAVAILABLE",
      message: "Worker temporarily unavailable.",
      requestId: "req_123",
      prompt: "do not expose this",
    }, 500);

    const result = await createGenerationJobViaApi({
      apiBaseUrl: "https://worker.test",
      project: { subject: "Sensitive subject" },
      materialText: "Sensitive material payload",
      objectives: [{ objectiveId: "O-1", text: "Sensitive objective" }],
      intents: [{ itemId: "Q-1", question: "Sensitive prompt" }],
      checkedChineseSubcategories: [],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject({
      phase: "create",
      endpointPath: "/generation-jobs",
      httpStatus: 500,
      errorCode: "ASYNC_JOB_UNAVAILABLE",
      requestId: "req_123",
      isNetworkError: false,
    });
    expect(JSON.stringify(result.diagnostics)).not.toContain("Sensitive");
    expect(JSON.stringify(result.diagnostics)).not.toContain("prompt");
    expect(JSON.stringify(result.diagnostics)).not.toContain("payload");
  });

  it("returns safe create-job diagnostics for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const result = await createGenerationJobViaApi({
      apiBaseUrl: "https://worker.test",
      project: { subject: "math" },
      materialText: "",
      objectives: [],
      intents: [],
      checkedChineseSubcategories: [],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject({
      phase: "create",
      endpointPath: "/generation-jobs",
      isNetworkError: true,
      isCorsLike: true,
      retryable: true,
    });
  });

  it("reads async generation job status via GET", async () => {
    mockFetchJson({ ok: true, jobId: "gen_12345678", status: "running" });

    const result = await getGenerationJobStatusViaApi({
      apiBaseUrl: "https://worker.test",
      jobId: "gen_12345678",
    });

    expect(result).toMatchObject({ ok: true, status: "running" });
    expect(fetch).toHaveBeenCalledWith("https://worker.test/generation-jobs/gen_12345678", expect.objectContaining({
      method: "GET",
    }));
  });

  it.each([
    [409, "ASYNC_JOB_RESULT_UNAVAILABLE"],
    [500, "ASYNC_JOB_STATUS_INVALID"],
  ])("returns safe poll diagnostics for HTTP %s", async (status, errorCode) => {
    mockFetchJson({ ok: false, errorCode, error: "Status read failed.", jobId: "gen_12345678" }, status);

    const result = await getGenerationJobStatusViaApi({
      apiBaseUrl: "https://worker.test",
      jobId: "gen_12345678",
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject({
      phase: "poll",
      endpointPath: "/generation-jobs/gen_12345678",
      httpStatus: status,
      errorCode,
      jobId: "gen_12345678",
    });
  });

  it("normalizes async generation job result items", async () => {
    mockFetchJson({ ok: true, status: "completed", items: [item()] });

    const result = await getGenerationJobResultViaApi({
      apiBaseUrl: "https://worker.test",
      jobId: "gen_12345678",
    });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].options).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(result.items[0].answer).toBe("A");
  });

  it.each([
    [409, "ASYNC_JOB_RESULT_UNAVAILABLE"],
    [500, "ASYNC_JOB_RESULT_INVALID"],
  ])("returns safe result diagnostics for HTTP %s", async (status, errorCode) => {
    mockFetchJson({ ok: false, errorCode, error: "Result read failed.", jobId: "gen_12345678" }, status);

    const result = await getGenerationJobResultViaApi({
      apiBaseUrl: "https://worker.test",
      jobId: "gen_12345678",
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject({
      phase: "result",
      endpointPath: "/generation-jobs/gen_12345678/result",
      httpStatus: status,
      errorCode,
      jobId: "gen_12345678",
    });
  });

  it("omits response text that may contain payload details", async () => {
    mockFetchText("payload prompt question answer generated item text that should never be copied", 500);

    const result = await getGenerationJobResultViaApi({
      apiBaseUrl: "https://worker.test",
      jobId: "gen_12345678",
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.errorMessage).toBe("[response text omitted: may contain request or generated content]");
    expect(JSON.stringify(result.diagnostics)).not.toContain("generated item text");
    expect(JSON.stringify(result.diagnostics)).not.toContain("question answer");
  });

  it("preserves safe partial result metadata while normalizing items", async () => {
    mockFetchJson({
      ok: true,
      status: "partial",
      partial: true,
      requestedItemCount: 4,
      completedItemCount: 3,
      items: [item()],
      missingItems: [{ itemIndex: 4, errorCode: "AI_OUTPUT_CONTRACT_INVALID" }],
    });

    const result = await getGenerationJobResultViaApi({
      apiBaseUrl: "https://worker.test",
      jobId: "gen_12345678",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.partial).toBe(true);
    expect(result.items[0].options).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(result.missingItems).toEqual([{ itemIndex: 4, errorCode: "AI_OUTPUT_CONTRACT_INVALID" }]);
  });
});
