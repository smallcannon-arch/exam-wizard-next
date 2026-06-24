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
});
