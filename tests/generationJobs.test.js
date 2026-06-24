import { describe, expect, it } from "vitest";
import worker from "../worker/src/index.js";
import { createGenerationJobPlan } from "../worker/src/generationJobs.js";
import { ERROR_CODES } from "../worker/src/json.js";

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
                });
                return { success: true };
              }

              throw new Error("unexpected SQL");
            },
            async first() {
              if (/FROM\s+generation_jobs/i.test(sql)) {
                return state.jobs.find((job) => job.job_id === values[0]) || null;
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
  it("splits job plans into safe 4-item batches", () => {
    const plan = createGenerationJobPlan(payload(10));

    expect(plan.ok).toBe(true);
    expect(plan.progress.requestedItemCount).toBe(10);
    expect(plan.progress.batchSize).toBe(4);
    expect(plan.progress.batchCount).toBe(3);
    expect(plan.batches.map((batch) => batch.expectedItemCount)).toEqual([4, 4, 2]);
    expect(plan.batches[0].expectedItemIds).toEqual(["Q-1", "Q-2", "Q-3", "Q-4"]);
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
    });
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
