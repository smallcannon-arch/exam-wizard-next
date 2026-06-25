import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { GenerationWorkflow, resolveUpstreamRetryDelayMs } from "../worker/src/index.js";
import {
  cleanupExpiredGenerationJobs,
  createGenerationJobPlan,
  resolveAsyncGenerationMaxConcurrentBatches,
} from "../worker/src/generationJobs.js";
import { CONTRACT_VIOLATION_TYPES, ERROR_CODES } from "../worker/src/json.js";

function intent(index) {
  return {
    itemId: `Q-${index}`,
    questionType: "choice",
    score: 1,
  };
}

function payload(count = 8) {
  return {
    project: { subject: "math", grade: "4" },
    materialText: "sensitive classroom source text should not be echoed",
    objectives: [{ objectiveId: "O-1", text: "objective" }],
    intents: Array.from({ length: count }, (_, index) => intent(index + 1)),
    checkedChineseSubcategories: [],
  };
}

function generatedItem(index = 1) {
  return {
    id: `G-${index}`,
    questionType: "choice",
    question: `Question ${index}`,
    options: ["A", "B", "C", "D"],
    answer: "A",
    qualityMeta: {
      teacherExplanation: "Teacher explanation",
      correctReason: "Correct reason",
      distractorDesign: {
        B: generatedDistractor("B"),
        C: generatedDistractor("C"),
        D: generatedDistractor("D"),
      },
      selfCheck: {
        passed: true,
      },
    },
  };
}

function generatedDistractor(option) {
  return {
    misconceptionTag: `misconception_${option}`,
    misconceptionDescription: `Why ${option} may look plausible.`,
    whyStudentsMayChooseIt: `Students may choose ${option}.`,
    whyItIsWrong: `${option} is wrong.`,
    revisionNote: `Keep ${option} distinct.`,
  };
}

function mockGeminiItems(items) {
  mockGeminiItemBatches([items]);
}

function mockGeminiItemBatches(itemBatches) {
  const batches = [...itemBatches];
  vi.stubGlobal("fetch", vi.fn(async () => {
    const items = batches.shift() || [];
    return new Response(JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ text: JSON.stringify({ items }) }],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

function mockGeminiTextResponses(responses) {
  const queue = [...responses];
  vi.stubGlobal("fetch", vi.fn(async () => {
    const response = queue.shift() || {};
    const text = typeof response === "string" ? response : response.text;
    const finishReason = typeof response === "object" ? response.finishReason : undefined;
    return new Response(JSON.stringify({
      candidates: [
        {
          finishReason,
          content: {
            parts: [{ text: text || "" }],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

function mockGeminiHttpThenItems(status, items) {
  let callCount = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response(JSON.stringify({
        error: "raw output with token and headers should not leak",
      }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ text: JSON.stringify({ items }) }],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

function mockGeminiNetworkThenItems(items) {
  let callCount = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    callCount += 1;
    if (callCount === 1) {
      throw new TypeError("network failed with raw prompt and token");
    }

    return new Response(JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ text: JSON.stringify({ items }) }],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

function mockConcurrentGeminiItemBatches(itemBatches) {
  const batches = [...itemBatches];
  let inFlight = 0;
  let maxInFlight = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    const items = batches.shift() || [];
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ items }) }],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
  return {
    getMaxInFlight() {
      return maxInFlight;
    },
  };
}

function jsonRequest(path, body, init = {}) {
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

async function readJson(response) {
  return response.json();
}

function createFakeJobsDb() {
  const state = {
    jobs: [],
    batches: [],
  };

  const db = {
    state,
    seedJob(job) {
      state.jobs.push({
        status: "queued",
        requested_item_count: 4,
        batch_size: 4,
        batch_count: 1,
        completed_batch_count: 0,
        completed_item_count: 0,
        current_batch: null,
        created_at: "2026-06-24T00:00:00.000Z",
        ...job,
      });
    },
    seedBatch(batch) {
      state.batches.push({
        batch_number: 1,
        status: "queued",
        expected_item_count: 4,
        completed_item_count: 0,
        retry_count: 0,
        finish_reason: null,
        output_length: null,
        json_candidate_length: null,
        json_classification_source: null,
        upstream_status: null,
        contract_violation_type: null,
        contract_violation_types: null,
        contract_violation_item_index: null,
        contract_violation_field: null,
        contract_violation_option_code: null,
        ...batch,
      });
    },
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (/INSERT\s+INTO\s+generation_jobs\s*\(/i.test(sql)) {
                state.jobs.push({
                  job_id: values[0],
                  status: values[1],
                  requested_item_count: values[2],
                  batch_size: values[3],
                  batch_count: values[4],
                  completed_batch_count: values[5],
                  completed_item_count: values[6],
                  current_batch: values[7],
                  expires_at: values[8],
                });
                return { success: true };
              }

              if (/INSERT\s+INTO\s+generation_job_batches\s*\(/i.test(sql)) {
                state.batches.push({
                  job_id: values[0],
                  batch_number: values[1],
                  status: values[2],
                  expected_item_count: values[3],
                  completed_item_count: values[4],
                  retry_count: values[5],
                  finish_reason: null,
                  output_length: null,
                  json_candidate_length: null,
                  json_classification_source: null,
                  upstream_status: null,
                  contract_violation_type: null,
                  contract_violation_types: null,
                  contract_violation_item_index: null,
                  contract_violation_field: null,
                  contract_violation_option_code: null,
                });
                return { success: true };
              }

              if (/DELETE\s+FROM\s+generation_job_batches/i.test(sql)) {
                const before = state.batches.length;
                state.batches = state.batches.filter((batch) => batch.job_id !== values[0]);
                return { success: true, meta: { changes: before - state.batches.length } };
              }

              if (/DELETE\s+FROM\s+generation_jobs/i.test(sql)) {
                const before = state.jobs.length;
                state.jobs = state.jobs.filter((job) => job.job_id !== values[0]);
                return { success: true, meta: { changes: before - state.jobs.length } };
              }

              if (/UPDATE\s+generation_jobs/i.test(sql)) {
                const jobId = values[values.length - 1];
                const job = state.jobs.find((entry) => entry.job_id === jobId);
                if (!job) return { success: true, meta: { changes: 0 } };

                if (/result_json/i.test(sql)) {
                  job.status = values[0];
                  job.completed_batch_count = values[1];
                  job.completed_item_count = values[2];
                  job.current_batch = values[3];
                  job.error_code = null;
                  job.result_item_count = values[4];
                  job.result_json = values[5];
                  return { success: true, meta: { changes: 1 } };
                }

                if (/completed_batch_count/i.test(sql) && /completed_item_count/i.test(sql)) {
                  job.status = values[0];
                  job.completed_batch_count = values[1];
                  job.completed_item_count = values[2];
                  job.current_batch = values[3];
                  return { success: true, meta: { changes: 1 } };
                }

                if (/error_code/i.test(sql)) {
                  job.status = values[0];
                  job.error_code = values[1];
                  return { success: true, meta: { changes: 1 } };
                }

                job.status = values[0];
                if (/current_batch/i.test(sql)) {
                  job.current_batch = values[1];
                }
                return { success: true, meta: { changes: 1 } };
              }

              if (/UPDATE\s+generation_job_batches/i.test(sql)) {
                const jobId = values[values.length - 2];
                const batchNumber = values[values.length - 1];
                const batch = state.batches.find((entry) => (
                  entry.job_id === jobId && entry.batch_number === batchNumber
                ));
                if (!batch) return { success: true, meta: { changes: 0 } };

                if (/error_code/i.test(sql) && /latency_ms/i.test(sql) && !/error_code\s*=\s*NULL/i.test(sql)) {
                  batch.status = values[0];
                  batch.error_code = values[1];
                  batch.latency_ms = values[2];
                  batch.retry_count = values[3];
                  batch.finish_reason = values[4];
                  batch.output_length = values[5];
                  batch.json_candidate_length = values[6];
                  batch.json_classification_source = values[7];
                  batch.upstream_status = values[8];
                  batch.contract_violation_type = values[9];
                  batch.contract_violation_types = values[10];
                  batch.contract_violation_item_index = values[11];
                  batch.contract_violation_field = values[12];
                  batch.contract_violation_option_code = values[13];
                  return { success: true, meta: { changes: 1 } };
                }

                if (/latency_ms/i.test(sql)) {
                  batch.status = values[0];
                  batch.completed_item_count = values[1];
                  batch.latency_ms = values[2];
                  if (/retry_count/i.test(sql)) {
                    batch.retry_count = values[3];
                  }
                  if (/finish_reason/i.test(sql)) {
                    batch.finish_reason = values[4];
                    batch.output_length = values[5];
                    batch.json_candidate_length = values[6];
                    batch.json_classification_source = values[7];
                    batch.upstream_status = values[8];
                  }
                  if (/error_code\s*=\s*NULL/i.test(sql)) {
                    batch.error_code = null;
                  }
                  return { success: true, meta: { changes: 1 } };
                }

                if (/error_code/i.test(sql)) {
                  batch.status = values[0];
                  batch.error_code = values[1];
                  return { success: true, meta: { changes: 1 } };
                }

                batch.status = values[0];
                return { success: true, meta: { changes: 1 } };
              }

              throw new Error("unexpected SQL");
            },
            async first() {
              if (/FROM\s+generation_jobs/i.test(sql)) {
                return state.jobs.find((job) => job.job_id === values[0]) || null;
              }

              throw new Error("unexpected SQL");
            },
            async all() {
              if (/FROM\s+generation_job_batches/i.test(sql)) {
                const results = state.batches
                  .filter((batch) => batch.job_id === values[0])
                  .sort((left, right) => Number(left.batch_number) - Number(right.batch_number));
                return { results, success: true };
              }

              if (/SELECT\s+job_id\s+FROM\s+generation_jobs/i.test(sql)) {
                const [nowIso, limit] = values;
                const results = state.jobs
                  .filter((job) => job.expires_at && job.expires_at <= nowIso)
                  .sort((left, right) => {
                    const expiresCompare = String(left.expires_at).localeCompare(String(right.expires_at));
                    if (expiresCompare !== 0) return expiresCompare;
                    return String(left.created_at || "").localeCompare(String(right.created_at || ""));
                  })
                  .slice(0, limit)
                  .map((job) => ({ job_id: job.job_id }));

                return { results, success: true };
              }

              throw new Error("unexpected SQL");
            },
          };
        },
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
      return statements.map(() => ({ success: true }));
    },
  };

  return db;
}

describe("async generation job skeleton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("splits job plans into safe 4-item batches", () => {
    const plan = createGenerationJobPlan(payload(10));

    expect(plan.ok).toBe(true);
    expect(plan.progress.requestedItemCount).toBe(10);
    expect(plan.progress.batchSize).toBe(4);
    expect(plan.progress.batchCount).toBe(3);
    expect(plan.batches.map((batch) => batch.expectedItemCount)).toEqual([4, 4, 2]);
    expect(plan.batches[0].expectedItemIds).toEqual(["Q-1", "Q-2", "Q-3", "Q-4"]);
  });

  it("resolves bounded batch concurrency with conservative defaults", () => {
    expect(resolveAsyncGenerationMaxConcurrentBatches()).toBe(1);
    expect(resolveAsyncGenerationMaxConcurrentBatches({ ASYNC_GENERATION_MAX_CONCURRENT_BATCHES: "0" })).toBe(1);
    expect(resolveAsyncGenerationMaxConcurrentBatches({ ASYNC_GENERATION_MAX_CONCURRENT_BATCHES: "2" })).toBe(2);
    expect(resolveAsyncGenerationMaxConcurrentBatches({ ASYNC_GENERATION_MAX_CONCURRENT_BATCHES: "20" })).toBe(3);
    expect(resolveAsyncGenerationMaxConcurrentBatches({ ASYNC_GENERATION_MAX_CONCURRENT_BATCHES: "bad" })).toBe(1);
  });

  it("resolves bounded upstream retry backoff delays", () => {
    expect(resolveUpstreamRetryDelayMs({}, 0, 0.5)).toBe(2000);
    expect(resolveUpstreamRetryDelayMs({}, 1, 0.5)).toBe(4000);
    expect(resolveUpstreamRetryDelayMs({}, 0, 0)).toBe(1500);
    expect(resolveUpstreamRetryDelayMs({}, 0, 1)).toBe(2500);
    expect(resolveUpstreamRetryDelayMs({ ASYNC_GENERATION_UPSTREAM_RETRY_BASE_DELAY_MS: "0" }, 0, 0.5)).toBe(0);
    expect(resolveUpstreamRetryDelayMs({ ASYNC_GENERATION_UPSTREAM_RETRY_BASE_DELAY_MS: "9000" }, 2, 0.5)).toBe(10000);
  });

  it("rejects requests above the 50-item MVP cap", () => {
    const plan = createGenerationJobPlan(payload(51));

    expect(plan.ok).toBe(false);
    expect(plan.errorCode).toBe(ERROR_CODES.REQUEST_INVALID);
  });

  it("returns a safe unavailable error when the Workflow binding is absent", async () => {
    const response = await worker.fetch(jsonRequest("/generation-jobs", payload(4)), { ALLOWED_ORIGIN: "*" });
    const body = await readJson(response);
    const text = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(501);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.ASYNC_JOB_UNAVAILABLE);
    expect(text).not.toContain("sensitive classroom source text");
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("token");
    expect(text).not.toContain("headers");
    expect(text).not.toContain("stack");
  });

  it("applies requested intent questionType authority on the synchronous generate endpoint", async () => {
    const data = payload(1);
    data.intents[0].questionType = "fill";
    mockGeminiItems([
      generatedItem(1),
    ]);

    const response = await worker.fetch(jsonRequest("/generate-items", data), {
      ALLOWED_ORIGIN: "*",
      GEMINI_API_KEY: "test-key",
    });
    const body = await readJson(response);
    const text = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("token");
    expect(text).not.toContain("question 1");
  });

  it("creates a D1-backed queued job without invoking Gemini or returning raw request data", async () => {
    const db = createFakeJobsDb();
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    };

    const response = await worker.fetch(jsonRequest("/generation-jobs", payload(8)), env);
    const body = await readJson(response);
    const responseText = JSON.stringify(body);
    const storedText = JSON.stringify(db.state);

    expect(response.status).toBe(202);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^gen_/);
    expect(body.status).toBe("queued");
    expect(body.requestedItemCount).toBe(8);
    expect(body.batchSize).toBe(4);
    expect(body.batchCount).toBe(2);
    expect(db.state.jobs).toHaveLength(1);
    expect(db.state.jobs[0]).toMatchObject({
      job_id: body.jobId,
      status: "queued",
      requested_item_count: 8,
      batch_size: 4,
      batch_count: 2,
      completed_batch_count: 0,
      completed_item_count: 0,
    });
    expect(db.state.batches.map((batch) => batch.expected_item_count)).toEqual([4, 4]);
    expect(responseText).not.toContain("sensitive classroom source text");
    expect(responseText).not.toContain("objective");
    expect(storedText).not.toContain("sensitive classroom source text");
    expect(storedText).not.toContain("objective");
    expect(storedText.toLowerCase()).not.toContain("raw prompt");
    expect(storedText.toLowerCase()).not.toContain("raw output");
    expect(storedText.toLowerCase()).not.toContain("token");
    expect(storedText.toLowerCase()).not.toContain("headers");
  });

  it("returns D1-backed queued job status", async () => {
    const db = createFakeJobsDb();
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    };
    const createResponse = await worker.fetch(jsonRequest("/generation-jobs", payload(5)), env);
    const created = await readJson(createResponse);

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${created.jobId}`), env);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      jobId: created.jobId,
      status: "queued",
      requestedItemCount: 5,
      batchSize: 4,
      batchCount: 2,
      completedBatchCount: 0,
      completedItemCount: 0,
      currentBatch: null,
      batches: [
        {
          batchNumber: 1,
          status: "queued",
          expectedItemCount: 4,
          completedItemCount: 0,
          retryCount: 0,
        },
        {
          batchNumber: 2,
          status: "queued",
          expectedItemCount: 1,
          completedItemCount: 0,
          retryCount: 0,
        },
      ],
    });
  });

  it("starts a Workflow instance after creating D1-backed job metadata", async () => {
    const db = createFakeJobsDb();
    const createCalls = [];
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
      GENERATION_WORKFLOW: {
        async create(options) {
          createCalls.push(options);
          return { id: options.id };
        },
      },
    };

    const response = await worker.fetch(jsonRequest("/generation-jobs", payload(8)), env);
    const body = await readJson(response);
    const storedText = JSON.stringify(db.state);
    const responseText = JSON.stringify(body);

    expect(response.status).toBe(202);
    expect(body.ok).toBe(true);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].id).toBe(body.jobId);
    expect(createCalls[0].params.jobId).toBe(body.jobId);
    expect(createCalls[0].params.batches).toHaveLength(2);
    expect(createCalls[0].params.request.materialText).toBe(payload(8).materialText);
    expect(storedText).not.toContain("sensitive classroom source text");
    expect(storedText).not.toContain("objective");
    expect(responseText).not.toContain("sensitive classroom source text");
    expect(responseText).not.toContain("objective");
  });

  it("returns a safe error and marks the job failed when Workflow start fails", async () => {
    const db = createFakeJobsDb();
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
      GENERATION_WORKFLOW: {
        async create() {
          throw new Error("provider stack with raw prompt and token should not leak");
        },
      },
    };

    const response = await worker.fetch(jsonRequest("/generation-jobs", payload(4)), env);
    const body = await readJson(response);
    const text = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.ASYNC_JOB_UNAVAILABLE);
    expect(db.state.jobs).toHaveLength(1);
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.jobs[0].error_code).toBe(ERROR_CODES.ASYNC_JOB_UNAVAILABLE);
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("token");
    expect(text).not.toContain("stack");
    expect(text).not.toContain("sensitive classroom source text");
  });

  it("runs the single-batch Workflow executor and stores normalized items", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    const items = Array.from({ length: 4 }, (_, index) => generatedItem(index + 1));
    mockGeminiItems(items);
    db.seedJob({ job_id: jobId, expires_at: "2026-06-25T00:00:00.000Z" });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
      GEMINI_MODEL: "gemini-test-model",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({
      ok: true,
      jobId,
      status: "completed",
      requestedItemCount: 4,
      batchSize: 4,
      batchCount: 1,
      completedBatchCount: 1,
      completedItemCount: 4,
      currentBatch: null,
    });
    expect(db.state.jobs[0].status).toBe("completed");
    expect(db.state.jobs[0].current_batch).toBe(null);
    expect(db.state.jobs[0].result_item_count).toBe(4);
    expect(JSON.parse(db.state.jobs[0].result_json)).toMatchObject({
      batchCount: 1,
      completedBatchCount: 1,
      partial: false,
    });
    expect(JSON.parse(db.state.jobs[0].result_json).items).toHaveLength(4);
    expect(JSON.parse(db.state.jobs[0].result_json).items.map((item) => item.itemIndex)).toEqual([1, 2, 3, 4]);
    expect(db.state.batches[0].status).toBe("completed");
    expect(db.state.batches[0].completed_item_count).toBe(4);
    expect(db.state.batches[0].latency_ms).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("sensitive classroom source text");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("raw prompt");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("raw output");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("token");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("runs multi-batch Workflow jobs sequentially and stores final items only after all batches pass", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_multi_12345678";
    const data = payload(6);
    const plan = createGenerationJobPlan(data);
    mockGeminiItemBatches([
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)),
      Array.from({ length: 2 }, (_, index) => generatedItem(index + 5)),
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 6,
      batch_count: 2,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });
    db.seedBatch({ job_id: jobId, batch_number: 2, expected_item_count: 2 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({
      ok: true,
      jobId,
      status: "completed",
      requestedItemCount: 6,
      batchSize: 4,
      batchCount: 2,
      completedBatchCount: 2,
      completedItemCount: 6,
      currentBatch: null,
    });
    expect(db.state.jobs[0].status).toBe("completed");
    expect(db.state.jobs[0].completed_batch_count).toBe(2);
    expect(db.state.jobs[0].completed_item_count).toBe(6);
    expect(db.state.jobs[0].current_batch).toBe(null);
    expect(db.state.jobs[0].result_item_count).toBe(6);
    expect(JSON.parse(db.state.jobs[0].result_json)).toMatchObject({
      batchCount: 2,
      completedBatchCount: 2,
      partial: false,
    });
    expect(JSON.parse(db.state.jobs[0].result_json).items.map((item) => item.id)).toEqual([
      "G-1",
      "G-2",
      "G-3",
      "G-4",
      "G-5",
      "G-6",
    ]);
    expect(JSON.parse(db.state.jobs[0].result_json).items.map((item) => item.itemIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(db.state.batches.map((batch) => batch.status)).toEqual(["completed", "completed"]);
    expect(db.state.batches.map((batch) => batch.completed_item_count)).toEqual([4, 2]);
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("sensitive classroom source text");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("raw prompt");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("raw output");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("token");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("runs bounded concurrent Workflow batches and preserves final item order", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_concurrent_12345678";
    const data = payload(9);
    const plan = createGenerationJobPlan(data);
    const concurrency = mockConcurrentGeminiItemBatches([
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)),
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 5)),
      [generatedItem(9)],
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 9,
      batch_count: 3,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });
    db.seedBatch({ job_id: jobId, batch_number: 2, expected_item_count: 4 });
    db.seedBatch({ job_id: jobId, batch_number: 3, expected_item_count: 1 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      ASYNC_GENERATION_MAX_CONCURRENT_BATCHES: "2",
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const stepNames = [];
    const step = {
      async do(name, callback) {
        stepNames.push(name);
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({
      ok: true,
      jobId,
      status: "completed",
      requestedItemCount: 9,
      batchSize: 4,
      batchCount: 3,
      completedBatchCount: 3,
      completedItemCount: 9,
      currentBatch: null,
    });
    expect(stepNames).toContain("mark batches 1,2 running");
    expect(stepNames).toContain("mark batches 3 running");
    expect(concurrency.getMaxInFlight()).toBe(2);
    expect(JSON.parse(db.state.jobs[0].result_json).items.map((item) => item.id)).toEqual([
      "G-1",
      "G-2",
      "G-3",
      "G-4",
      "G-5",
      "G-6",
      "G-7",
      "G-8",
      "G-9",
    ]);
    expect(JSON.parse(db.state.jobs[0].result_json).items.map((item) => item.itemIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(db.state.batches.map((batch) => batch.status)).toEqual(["completed", "completed", "completed"]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("marks a later failed batch as partial when enough planned slots remain usable", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_multi_partial_12345678";
    const data = payload(20);
    const plan = createGenerationJobPlan(data);
    const leakedOptionText = "E. LEAK_SENTINEL_PARTIAL_OPTION_TEXT should not leak";
    mockGeminiItemBatches([
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)),
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 5)),
      [
        {
          ...generatedItem(9),
          question: "LEAK_SENTINEL_PARTIAL_QUESTION_TEXT should not leak",
          options: ["A", "B", "C", "D", leakedOptionText],
        },
        generatedItem(10),
        generatedItem(11),
        generatedItem(12),
      ],
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 13)),
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 17)),
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 20,
      batch_count: 5,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    for (let batchNumber = 1; batchNumber <= 5; batchNumber += 1) {
      db.seedBatch({ job_id: jobId, batch_number: batchNumber, expected_item_count: 4 });
    }

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({
      ok: true,
      status: "partial",
      completedItemCount: 16,
      missingItemCount: 4,
    });
    expect(db.state.jobs[0].status).toBe("partial");
    expect(db.state.jobs[0].error_code).toBeNull();
    expect(db.state.jobs[0].completed_batch_count).toBe(4);
    expect(db.state.jobs[0].completed_item_count).toBe(16);
    const resultPayload = JSON.parse(db.state.jobs[0].result_json);
    expect(resultPayload).toMatchObject({
      batchCount: 5,
      completedBatchCount: 4,
      completedItemCount: 16,
      requestedItemCount: 20,
      partial: true,
    });
    expect(resultPayload.items.map((item) => item.id)).toEqual([
      "G-1",
      "G-2",
      "G-3",
      "G-4",
      "G-5",
      "G-6",
      "G-7",
      "G-8",
      "G-13",
      "G-14",
      "G-15",
      "G-16",
      "G-17",
      "G-18",
      "G-19",
      "G-20",
    ]);
    expect(resultPayload.items.map((item) => item.itemIndex)).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
    ]);
    expect(resultPayload.missingItems.map((item) => item.itemIndex)).toEqual([9, 10, 11, 12]);
    expect(resultPayload.missingItems).toEqual(resultPayload.missingItems.map((item) => ({
      itemIndex: item.itemIndex,
      batchNumber: 3,
      errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
      failureItemIndex: 9,
      contractViolationTypes: [CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID],
      contractViolationField: "options",
      contractViolationOptionCode: "E",
    })));
    expect(db.state.batches.map((batch) => batch.status)).toEqual([
      "completed",
      "completed",
      "failed_terminal",
      "completed",
      "completed",
    ]);
    expect(db.state.batches[2].error_code).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    const stateText = JSON.stringify(db.state).toLowerCase();
    expect(stateText).not.toContain("leak_sentinel");
    expect(stateText).not.toContain("raw output");
    expect(stateText).not.toContain("token");
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("marks the job failed when failed batches leave too few usable planned slots", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_multi_below_partial_12345678";
    const data = payload(12);
    const plan = createGenerationJobPlan(data);
    mockGeminiItemBatches([
      Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)),
      [
        { id: "G-5", question: "Question without qualityMeta" },
        generatedItem(6),
        generatedItem(7),
        generatedItem(8),
      ],
      [
        { id: "G-9", question: "Question without qualityMeta" },
        generatedItem(10),
        generatedItem(11),
        generatedItem(12),
      ],
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 12,
      batch_count: 3,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    for (let batchNumber = 1; batchNumber <= 3; batchNumber += 1) {
      db.seedBatch({ job_id: jobId, batch_number: batchNumber, expected_item_count: 4 });
    }

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_QUALITY_META_MISSING });
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.jobs[0].error_code).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
    expect(db.state.jobs[0].completed_batch_count).toBe(1);
    expect(db.state.jobs[0].completed_item_count).toBe(4);
    expect(db.state.jobs[0].result_json).toBeUndefined();
    expect(db.state.batches.map((batch) => batch.status)).toEqual([
      "completed",
      "failed_terminal",
      "failed_terminal",
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("marks the single batch failed when AI output misses qualityMeta", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_fail_12345678";
    const data = payload(1);
    const plan = createGenerationJobPlan(data);
    mockGeminiItems([{ id: "G-1", question: "Question without qualityMeta" }]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 1,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 1 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_QUALITY_META_MISSING });
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.jobs[0].error_code).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
    expect(db.state.batches[0].status).toBe("failed_terminal");
    expect(db.state.batches[0].error_code).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("raw output");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("token");
  });

  it("marks the batch failed when AI output adds an option outside A/B/C/D", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_fail_option_contract_12345678";
    const leakedOptionText = "E. LEAK_SENTINEL_EXTRA_OPTION_TEXT 越界選項內容不應外洩";
    const data = payload(1);
    const plan = createGenerationJobPlan(data);
    mockGeminiItems([
      {
        ...generatedItem(1),
        question: "LEAK_SENTINEL_QUESTION_TEXT should not leak through status",
        options: ["A", "B", "C", "D", leakedOptionText],
      },
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 1,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 1 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID });
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.jobs[0].error_code).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(db.state.jobs[0].result_json).toBeUndefined();
    expect(db.state.batches[0].status).toBe("failed_terminal");
    expect(db.state.batches[0].error_code).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(db.state.batches[0].retry_count).toBe(0);
    expect(db.state.batches[0].finish_reason).toBe("STOP");
    expect(db.state.batches[0].output_length).toBeGreaterThan(0);
    expect(db.state.batches[0].json_candidate_length).toBeGreaterThan(0);
    expect(db.state.batches[0].json_classification_source).toBe("none");
    expect(db.state.batches[0].contract_violation_type).toBe(CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID);
    expect(JSON.parse(db.state.batches[0].contract_violation_types)).toEqual([
      CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID,
    ]);
    expect(db.state.batches[0].contract_violation_item_index).toBe(1);
    expect(db.state.batches[0].contract_violation_field).toBe("options");
    expect(db.state.batches[0].contract_violation_option_code).toBe("E");

    const statusResponse = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const statusBody = await readJson(statusResponse);
    const statusText = JSON.stringify(statusBody).toLowerCase();

    expect(statusBody.batches[0].contractViolation).toEqual({
      type: CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID,
      types: [CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID],
      itemIndex: 1,
      field: "options",
      optionCode: "E",
    });
    expect(statusText).not.toContain("leak_sentinel");
    expect(statusText).not.toContain("越界選項內容不應外洩");
    expect(statusText).not.toContain("raw output");
    expect(statusText).not.toContain("token");
    expect(statusText).not.toContain("headers");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses requested batch intent questionType instead of model self-report", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_requested_type_authority_12345678";
    const data = payload(1);
    data.intents[0].questionType = "fill";
    const plan = createGenerationJobPlan(data);
    mockGeminiItems([
      generatedItem(1),
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 1,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 1 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID });
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.batches[0].status).toBe("failed_terminal");
    expect(db.state.batches[0].contract_violation_type).toBe(CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH);
    expect(JSON.parse(db.state.batches[0].contract_violation_types)).toEqual([
      CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH,
    ]);
    expect(db.state.batches[0].contract_violation_item_index).toBe(1);
    expect(db.state.batches[0].contract_violation_field).toBe("questionType");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("raw output");
    expect(JSON.stringify(db.state).toLowerCase()).not.toContain("token");
  });

  it("retries a malformed JSON batch once and stores only one completed batch result", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_retry_parse_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    mockGeminiTextResponses([
      "{\"items\":[",
      JSON.stringify({ items: Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)) }),
    ]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: true, status: "completed", completedItemCount: 4 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(db.state.batches[0].status).toBe("completed");
    expect(db.state.batches[0].retry_count).toBe(1);
    expect(db.state.batches[0].error_code).toBeNull();
    expect(db.state.batches[0].output_length).toBeGreaterThan(0);
    expect(db.state.batches[0].json_candidate_length).toBeGreaterThan(0);
    expect(db.state.batches[0].json_classification_source).toBe("none");
    expect(JSON.parse(db.state.jobs[0].result_json).items).toHaveLength(4);

    const statusResponse = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const statusBody = await readJson(statusResponse);
    const statusText = JSON.stringify(statusBody).toLowerCase();

    expect(statusBody.batches).toHaveLength(1);
    expect(statusBody.batches[0]).toMatchObject({
      batchNumber: 1,
      status: "completed",
      retryCount: 1,
      diagnostics: {
        jsonClassificationSource: "none",
      },
    });
    expect(statusBody.batches[0].diagnostics.outputLength).toBeGreaterThan(0);
    expect(statusText).not.toContain("raw prompt");
    expect(statusText).not.toContain("raw output");
    expect(statusText).not.toContain("token");
  });

  it("retries a rate-limited upstream batch with backoff and stores safe upstream status metadata", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_retry_rate_limit_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    mockGeminiHttpThenItems(429, Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)));
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      ASYNC_GENERATION_UPSTREAM_RETRY_BASE_DELAY_MS: "0",
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: true, status: "completed", completedItemCount: 4 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(db.state.batches[0].status).toBe("completed");
    expect(db.state.batches[0].retry_count).toBe(1);
    expect(db.state.batches[0].error_code).toBeNull();
    expect(db.state.batches[0].finish_reason).toBe("STOP");
    expect(db.state.batches[0].upstream_status).toBe(429);

    const statusResponse = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const statusBody = await readJson(statusResponse);
    const statusText = JSON.stringify(statusBody).toLowerCase();

    expect(statusBody.batches[0]).toMatchObject({
      batchNumber: 1,
      status: "completed",
      retryCount: 1,
      diagnostics: {
        finishReason: "STOP",
        jsonClassificationSource: "none",
        upstreamStatus: 429,
      },
    });
    expect(statusText).not.toContain("raw prompt");
    expect(statusText).not.toContain("raw output");
    expect(statusText).not.toContain("token");
    expect(statusText).not.toContain("headers");
  });

  it("retries a transient upstream 5xx batch once", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_retry_5xx_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    mockGeminiHttpThenItems(503, Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)));
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      ASYNC_GENERATION_UPSTREAM_RETRY_BASE_DELAY_MS: "0",
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: true, status: "completed", completedItemCount: 4 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(db.state.batches[0].retry_count).toBe(1);
    expect(db.state.batches[0].upstream_status).toBe(503);
  });

  it("retries a transient network error batch once without storing unsafe details", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_retry_network_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    mockGeminiNetworkThenItems(Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)));
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      ASYNC_GENERATION_UPSTREAM_RETRY_BASE_DELAY_MS: "0",
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    const stateText = JSON.stringify(db.state).toLowerCase();
    expect(result).toMatchObject({ ok: true, status: "completed", completedItemCount: 4 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(db.state.batches[0].retry_count).toBe(1);
    expect(db.state.batches[0].upstream_status).toBeNull();
    expect(stateText).not.toContain("raw prompt");
    expect(stateText).not.toContain("token");
    expect(stateText).not.toContain("headers");
  });

  it("does not retry non-rate-limit upstream 4xx errors", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_non_retry_4xx_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "raw output with token and headers should not leak",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })));
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      ASYNC_GENERATION_UPSTREAM_RETRY_BASE_DELAY_MS: "0",
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    const stateText = JSON.stringify(db.state).toLowerCase();
    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.GEMINI_UPSTREAM_REQUEST_ERROR });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.batches[0].status).toBe("failed_terminal");
    expect(db.state.batches[0].retry_count).toBe(0);
    expect(db.state.batches[0].error_code).toBe(ERROR_CODES.GEMINI_UPSTREAM_REQUEST_ERROR);
    expect(db.state.batches[0].upstream_status).toBe(400);
    expect(stateText).not.toContain("raw output");
    expect(stateText).not.toContain("token");
    expect(stateText).not.toContain("headers");
  });

  it("does not retry hard JSON truncation reported by Gemini finishReason", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_truncated_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    mockGeminiTextResponses([{ text: "{\"items\":[", finishReason: "MAX_TOKENS" }]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_JSON_TRUNCATED });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.batches[0].status).toBe("failed_terminal");
    expect(db.state.batches[0].retry_count).toBe(0);
    expect(db.state.batches[0].finish_reason).toBe("MAX_TOKENS");
    expect(db.state.batches[0].json_classification_source).toBe("finish_reason");
  });

  it("fails safely after one malformed JSON retry is exhausted", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_workflow_retry_exhausted_12345678";
    const data = payload(4);
    const plan = createGenerationJobPlan(data);
    mockGeminiTextResponses(["{\"items\":[,]}", "{\"items\":[,]}"]);
    db.seedJob({
      job_id: jobId,
      requested_item_count: 4,
      batch_count: 1,
      expires_at: "2026-06-25T00:00:00.000Z",
    });
    db.seedBatch({ job_id: jobId, batch_number: 1, expected_item_count: 4 });

    const workflow = new GenerationWorkflow();
    workflow.env = {
      GENERATION_JOBS_DB: db,
      GEMINI_API_KEY: "test-key",
    };
    const step = {
      async do(_name, callback) {
        return callback();
      },
    };

    const result = await workflow.run({
      payload: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    }, step);

    const stateText = JSON.stringify(db.state).toLowerCase();
    expect(result).toMatchObject({ ok: false, errorCode: ERROR_CODES.AI_JSON_PARSE_FAILED });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(db.state.jobs[0].status).toBe("failed");
    expect(db.state.batches[0].status).toBe("failed_terminal");
    expect(db.state.batches[0].retry_count).toBe(1);
    expect(db.state.jobs[0].result_json).toBeUndefined();
    expect(stateText).not.toContain("raw prompt");
    expect(stateText).not.toContain("raw output");
    expect(stateText).not.toContain("token");
  });

  it("returns a safe not-found error for missing D1-backed jobs", async () => {
    const response = await worker.fetch(new Request("https://worker.test/generation-jobs/gen_12345678"), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: createFakeJobsDb(),
    });
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.ASYNC_JOB_NOT_FOUND);
  });

  it("returns a safe errorCode for failed D1-backed job status", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_failed_status_12345678";
    db.seedJob({
      job_id: jobId,
      status: "failed",
      requested_item_count: 25,
      batch_size: 4,
      batch_count: 7,
      completed_batch_count: 0,
      completed_item_count: 0,
      current_batch: 1,
      error_code: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    });
    db.seedBatch({
      job_id: jobId,
      batch_number: 1,
      status: "failed_terminal",
      expected_item_count: 4,
      completed_item_count: 0,
      retry_count: 1,
      error_code: ERROR_CODES.AI_JSON_PARSE_FAILED,
      latency_ms: 1234,
      finish_reason: "STOP",
      output_length: 256,
      json_candidate_length: 256,
      json_classification_source: "parser",
      contract_violation_type: CONTRACT_VIOLATION_TYPES.DISTRACTOR_REQUIRED_FIELD_MISSING,
      contract_violation_types: JSON.stringify([CONTRACT_VIOLATION_TYPES.DISTRACTOR_REQUIRED_FIELD_MISSING]),
      contract_violation_item_index: 3,
      contract_violation_field: "misconceptionTag",
      contract_violation_option_code: "B",
    });

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const body = await readJson(response);
    const text = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.errorCode).toBe(ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID);
    expect(body.batches).toEqual([{
      batchNumber: 1,
      status: "failed_terminal",
      expectedItemCount: 4,
      completedItemCount: 0,
      retryCount: 1,
      latencyMs: 1234,
      errorCode: ERROR_CODES.AI_JSON_PARSE_FAILED,
      diagnostics: {
        finishReason: "STOP",
        outputLength: 256,
        jsonCandidateLength: 256,
        jsonClassificationSource: "parser",
      },
      contractViolation: {
        type: CONTRACT_VIOLATION_TYPES.DISTRACTOR_REQUIRED_FIELD_MISSING,
        types: [CONTRACT_VIOLATION_TYPES.DISTRACTOR_REQUIRED_FIELD_MISSING],
        itemIndex: 3,
        field: "misconceptionTag",
        optionCode: "B",
      },
    }]);
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("token");
    expect(text).not.toContain("headers");
    expect(text).not.toContain("question");
  });

  it("returns completed D1-backed job results through the safe result endpoint", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_result_12345678";
    const items = Array.from({ length: 4 }, (_, index) => generatedItem(index + 1));
    db.seedJob({
      job_id: jobId,
      status: "completed",
      requested_item_count: 4,
      batch_count: 1,
      completed_batch_count: 1,
      completed_item_count: 4,
      result_item_count: 4,
      result_json: JSON.stringify({
        items,
        batchCount: 1,
        completedBatchCount: 1,
        partial: false,
      }),
    });

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}/result`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const body = await readJson(response);
    const text = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("completed");
    expect(body.items).toHaveLength(4);
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("token");
  });

  it("returns partial D1-backed job results with safe missing-slot metadata", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_partial_result_12345678";
    const itemIndexes = [1, 2, 3, 4, 5, 6, 7, 8, 13, 14, 15, 16, 17, 18, 19, 20];
    const items = itemIndexes.map((itemIndex) => ({
      ...generatedItem(itemIndex),
      itemIndex,
    }));
    db.seedJob({
      job_id: jobId,
      status: "partial",
      requested_item_count: 20,
      batch_count: 5,
      completed_batch_count: 4,
      completed_item_count: 16,
      result_item_count: 16,
      result_json: JSON.stringify({
        items,
        batchCount: 5,
        completedBatchCount: 4,
        completedItemCount: 16,
        requestedItemCount: 20,
        partial: true,
        missingItems: [
          ...[9, 10, 11, 12].map((itemIndex) => ({
            itemIndex,
            batchNumber: 3,
            errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
            failureItemIndex: 9,
            contractViolationTypes: [CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID],
            contractViolationField: "options",
            contractViolationOptionCode: "E",
            unsafeText: "LEAK_SENTINEL_MISSING_ITEM_TEXT should not leak",
          })),
        ],
      }),
    });

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}/result`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const body = await readJson(response);
    const text = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("partial");
    expect(body.partial).toBe(true);
    expect(body.items).toHaveLength(16);
    expect(body.items.map((item) => item.itemIndex)).toEqual(itemIndexes);
    expect(body.missingItems).toEqual([9, 10, 11, 12].map((itemIndex) => ({
      itemIndex,
      batchNumber: 3,
      errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
      failureItemIndex: 9,
      contractViolationTypes: [CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID],
      contractViolationField: "options",
      contractViolationOptionCode: "E",
    })));
    expect(text).not.toContain("leak_sentinel");
    expect(text).not.toContain("raw prompt");
    expect(text).not.toContain("raw output");
    expect(text).not.toContain("token");
  });

  it("rejects malformed partial D1-backed result payloads", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_bad_partial_result_12345678";
    db.seedJob({
      job_id: jobId,
      status: "partial",
      requested_item_count: 4,
      batch_count: 2,
      completed_batch_count: 1,
      completed_item_count: 2,
      result_item_count: 2,
      result_json: JSON.stringify({
        items: [
          { ...generatedItem(1), itemIndex: 1 },
          { ...generatedItem(2), itemIndex: 2 },
        ],
        partial: true,
        missingItems: [
          {
            itemIndex: 4,
            batchNumber: 2,
            errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
          },
        ],
      }),
    });

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}/result`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const body = await readJson(response);

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.ASYNC_JOB_RESULT_INVALID);
    expect(body.items).toBeUndefined();
  });

  it("does not return result items while D1-backed jobs are still running", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_running_12345678";
    db.seedJob({
      job_id: jobId,
      status: "running",
      requested_item_count: 4,
      batch_count: 1,
      completed_batch_count: 0,
      completed_item_count: 0,
      result_json: JSON.stringify({
        items: Array.from({ length: 4 }, (_, index) => generatedItem(index + 1)),
      }),
    });

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}/result`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.ASYNC_JOB_RESULT_UNAVAILABLE);
    expect(body.items).toBeUndefined();
  });

  it("rejects invalid completed D1-backed result payloads", async () => {
    const db = createFakeJobsDb();
    const jobId = "gen_invalid_12345678";
    db.seedJob({
      job_id: jobId,
      status: "completed",
      requested_item_count: 1,
      batch_count: 1,
      completed_batch_count: 1,
      completed_item_count: 1,
      result_item_count: 1,
      result_json: JSON.stringify({ items: [], partial: false }),
    });
    db.state.jobs[0].result_json = JSON.stringify({
      items: [{ ...generatedItem(1), qualityMeta: undefined }],
      partial: false,
    });

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}/result`), {
      ALLOWED_ORIGIN: "*",
      GENERATION_JOBS_DB: db,
    });
    const body = await readJson(response);

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.AI_QUALITY_META_MISSING);
    expect(body.items).toBeUndefined();
  });

  it("cleans only expired D1-backed jobs and their batch metadata", async () => {
    const db = createFakeJobsDb();
    db.seedJob({
      job_id: "gen_expired_12345678",
      expires_at: "2026-06-24T00:00:00.000Z",
      created_at: "2026-06-23T00:00:00.000Z",
    });
    db.seedBatch({ job_id: "gen_expired_12345678" });
    db.seedJob({
      job_id: "gen_future_12345678",
      expires_at: "2026-06-25T00:00:00.000Z",
      created_at: "2026-06-23T00:01:00.000Z",
    });
    db.seedBatch({ job_id: "gen_future_12345678" });
    db.seedJob({
      job_id: "gen_no_expiry_12345678",
      expires_at: null,
      created_at: "2026-06-23T00:02:00.000Z",
    });
    db.seedBatch({ job_id: "gen_no_expiry_12345678" });

    const result = await cleanupExpiredGenerationJobs(db, {
      now: "2026-06-24T00:00:01.000Z",
    });

    expect(result).toEqual({ ok: true, deletedJobCount: 1 });
    expect(db.state.jobs.map((job) => job.job_id)).toEqual([
      "gen_future_12345678",
      "gen_no_expiry_12345678",
    ]);
    expect(db.state.batches.map((batch) => batch.job_id)).toEqual([
      "gen_future_12345678",
      "gen_no_expiry_12345678",
    ]);
  });

  it("limits expired D1 job cleanup batches", async () => {
    const db = createFakeJobsDb();
    for (let index = 1; index <= 3; index += 1) {
      const jobId = `gen_expired_${index}2345678`;
      db.seedJob({
        job_id: jobId,
        expires_at: `2026-06-24T00:00:0${index}.000Z`,
        created_at: `2026-06-23T00:00:0${index}.000Z`,
      });
      db.seedBatch({ job_id: jobId });
    }

    const result = await cleanupExpiredGenerationJobs(db, {
      now: "2026-06-24T00:00:10.000Z",
      limit: 2,
    });

    expect(result).toEqual({ ok: true, deletedJobCount: 2 });
    expect(db.state.jobs.map((job) => job.job_id)).toEqual(["gen_expired_32345678"]);
    expect(db.state.batches.map((batch) => batch.job_id)).toEqual(["gen_expired_32345678"]);
  });

  it("returns a safe cleanup unavailable error when D1 is absent", async () => {
    const result = await cleanupExpiredGenerationJobs(null);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.ASYNC_JOB_UNAVAILABLE);
  });

  it("creates a Workflow-backed async generation job without returning raw request data", async () => {
    const createCalls = [];
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_WORKFLOW: {
        async create(options) {
          createCalls.push(options);
          return { id: options.id };
        },
      },
    };

    const response = await worker.fetch(jsonRequest("/generation-jobs", payload(8)), env);
    const body = await readJson(response);
    const text = JSON.stringify(body);

    expect(response.status).toBe(202);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^gen_/);
    expect(body.status).toBe("queued");
    expect(body.requestedItemCount).toBe(8);
    expect(body.batchCount).toBe(2);
    expect(body.completedItemCount).toBe(0);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].id).toBe(body.jobId);
    expect(createCalls[0].params.batches).toHaveLength(2);
    expect(text).not.toContain("sensitive classroom source text");
    expect(text).not.toContain("objective");
  });

  it("returns safe progress from Workflow status", async () => {
    const jobId = "gen_12345678";
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_WORKFLOW: {
        async get(id) {
          expect(id).toBe(jobId);
          return {
            async status() {
              return {
                status: "running",
                output: {
                  progress: {
                    requestedItemCount: 12,
                    batchSize: 4,
                    batchCount: 3,
                    completedBatchCount: 1,
                    completedItemCount: 4,
                    currentBatch: 2,
                  },
                },
              };
            },
          };
        },
      },
    };

    const response = await worker.fetch(new Request(`https://worker.test/generation-jobs/${jobId}`), env);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      jobId,
      status: "running",
      requestedItemCount: 12,
      batchSize: 4,
      batchCount: 3,
      completedBatchCount: 1,
      completedItemCount: 4,
      currentBatch: 2,
    });
  });

  it("rejects unsafe or unknown job IDs before touching the Workflow binding", async () => {
    let touched = false;
    const env = {
      ALLOWED_ORIGIN: "*",
      GENERATION_WORKFLOW: {
        async get() {
          touched = true;
        },
      },
    };

    const response = await worker.fetch(new Request("https://worker.test/generation-jobs/raw-output"), env);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe(ERROR_CODES.REQUEST_INVALID);
    expect(touched).toBe(false);
  });
});
