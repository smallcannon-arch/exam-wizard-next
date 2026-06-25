import { buildExtractObjectivesPrompt, buildGenerateItemsPrompt, buildNormalizeObjectivesPrompt, buildRegenerateItemPrompt } from "./prompts.js";
import { callGemini } from "./gemini.js";
import { ERROR_CODES, assertItemsPayload, assertObjectivesPayload, extractJsonObject, readJson, safeErrorPayload } from "./json.js";
import { handleOptions, jsonResponse } from "./cors.js";
import {
  completeGenerationJob,
  markGenerationBatchCompleted,
  markGenerationBatchFailed,
  markGenerationBatchesRunning,
  markGenerationJobFailed,
  markGenerationJobRunning,
  resolveAsyncGenerationMaxConcurrentBatches,
  routeGenerationJobRequest,
} from "./generationJobs.js";

let WorkflowEntrypointBase = class {};
try {
  const workersRuntime = await import("cloudflare:workers");
  if (typeof workersRuntime.WorkflowEntrypoint === "function") {
    WorkflowEntrypointBase = workersRuntime.WorkflowEntrypoint;
  }
} catch {
  // Node-based unit tests do not provide the Cloudflare runtime module.
}

function errorResponse(request, env, result, status) {
  return jsonResponse(request, env, safeErrorPayload(result), status);
}

const ASYNC_BATCH_MAX_RETRY_COUNT = 1;
const RETRYABLE_BATCH_ERROR_CODES = new Set([
  ERROR_CODES.AI_JSON_NO_OBJECT,
  ERROR_CODES.AI_JSON_PARSE_FAILED,
]);

function isRetryableBatchGenerationResult(result) {
  return !!result && !result.ok && RETRYABLE_BATCH_ERROR_CODES.has(result.errorCode);
}

async function generateAndValidateBatch({ env, request, batch, batchNumber }) {
  const startedAt = Date.now();
  let lastResult = null;

  for (let attempt = 0; attempt <= ASYNC_BATCH_MAX_RETRY_COUNT; attempt += 1) {
    const prompt = buildGenerateItemsPrompt({
      project: request.project,
      materialText: request.materialText,
      objectives: request.objectives,
      intents: batch.intents,
      checkedChineseSubcategories: request.checkedChineseSubcategories,
    });

    const ai = await callGemini({ env, prompt });
    const latencyMs = Date.now() - startedAt;
    if (!ai.ok) {
      lastResult = {
        ok: false,
        batchNumber,
        errorCode: ai.errorCode || ERROR_CODES.GEMINI_UPSTREAM_ERROR,
        latencyMs,
        retryCount: attempt,
      };
    } else {
      const parsed = extractJsonObject(ai.text, { finishReason: ai.finishReason });
      if (!parsed.ok) {
        lastResult = {
          ok: false,
          batchNumber,
          errorCode: parsed.errorCode,
          latencyMs,
          retryCount: attempt,
          diagnostics: parsed.diagnostics,
        };
      } else {
        const payload = assertItemsPayload(parsed.data, batch.expectedItemCount);
        if (!payload.ok) {
          lastResult = {
            ok: false,
            batchNumber,
            errorCode: payload.errorCode,
            latencyMs,
            retryCount: attempt,
          };
        } else {
          return {
            ok: true,
            batchNumber,
            items: payload.items,
            itemCount: payload.items.length,
            latencyMs,
            retryCount: attempt,
          };
        }
      }
    }

    if (!isRetryableBatchGenerationResult(lastResult) || attempt >= ASYNC_BATCH_MAX_RETRY_COUNT) {
      return lastResult;
    }
  }

  return lastResult || {
    ok: false,
    batchNumber,
    errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    latencyMs: Date.now() - startedAt,
    retryCount: ASYNC_BATCH_MAX_RETRY_COUNT,
  };
}

export class GenerationWorkflow extends WorkflowEntrypointBase {
  async run(event, step) {
    const jobId = event?.payload?.jobId;
    const progress = event?.payload?.progress || {};
    const request = event?.payload?.request || {};
    const batches = Array.isArray(event?.payload?.batches) ? event.payload.batches : [];

    const result = await step.do("mark job running", async () => {
      const marked = await markGenerationJobRunning(this.env?.GENERATION_JOBS_DB, jobId);
      if (!marked.ok) return marked;
      return {
        ok: true,
        jobId,
        status: "running",
        requestedItemCount: progress.requestedItemCount,
        batchSize: progress.batchSize,
        batchCount: progress.batchCount,
        completedBatchCount: 0,
        completedItemCount: 0,
        currentBatch: 1,
      };
    });
    if (!result.ok) return result;

    if (batches.length === 0) {
      await markGenerationJobFailed(this.env?.GENERATION_JOBS_DB, jobId, ERROR_CODES.ASYNC_JOB_STATUS_INVALID);
      return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
    }

    const maxConcurrentBatches = resolveAsyncGenerationMaxConcurrentBatches(this.env);
    const completedBatches = [];
    for (let index = 0; index < batches.length; index += maxConcurrentBatches) {
      const batchWindow = batches.slice(index, index + maxConcurrentBatches).map((batch, offset) => ({
        batch,
        batchNumber: Number.isFinite(Number(batch?.batchNumber))
          ? Number(batch.batchNumber)
          : index + offset + 1,
      }));
      const batchNumbers = batchWindow.map((entry) => entry.batchNumber);

      const running = await step.do(`mark batches ${batchNumbers.join(",")} running`, async () => (
        markGenerationBatchesRunning(this.env?.GENERATION_JOBS_DB, jobId, batchNumbers)
      ));
      if (!running.ok) return running;

      const generatedResults = await Promise.all(batchWindow.map(({ batch, batchNumber }) => (
        step.do(`generate and validate batch ${batchNumber}`, async () => {
          return generateAndValidateBatch({
            env: this.env,
            request,
            batch,
            batchNumber,
          });
        })
      )));

      const successfulBatches = generatedResults
        .filter((generated) => generated.ok)
        .sort((a, b) => a.batchNumber - b.batchNumber);
      for (const generated of successfulBatches) {
        completedBatches.push(generated);
        const completedItemCount = completedBatches.reduce((sum, entry) => sum + entry.itemCount, 0);
        const batchCompleted = await step.do(`mark batch ${generated.batchNumber} completed`, async () => (
          markGenerationBatchCompleted(this.env?.GENERATION_JOBS_DB, jobId, generated.batchNumber, generated.itemCount, generated.latencyMs, {
            requestedItemCount: progress.requestedItemCount,
            batchCount: progress.batchCount || batches.length,
            completedBatchCount: completedBatches.length,
            completedItemCount,
            retryCount: generated.retryCount,
          })
        ));
        if (!batchCompleted.ok) return batchCompleted;
      }

      const failedBatches = generatedResults
        .filter((generated) => !generated.ok)
        .sort((a, b) => a.batchNumber - b.batchNumber);
      if (failedBatches.length) {
        for (const generated of failedBatches) {
          await step.do(`mark batch ${generated.batchNumber} failed`, async () => (
            markGenerationBatchFailed(this.env?.GENERATION_JOBS_DB, jobId, generated.batchNumber, generated.errorCode, {
              latencyMs: generated.latencyMs,
              retryCount: generated.retryCount,
            })
          ));
        }
        return failedBatches[0];
      }
    }

    const items = completedBatches
      .sort((a, b) => a.batchNumber - b.batchNumber)
      .flatMap((batch) => batch.items);
    const expectedItemCount = Number(progress.requestedItemCount);
    if (Number.isFinite(expectedItemCount) && items.length !== expectedItemCount) {
      await step.do("mark job failed after final item count check", async () => (
        markGenerationJobFailed(this.env?.GENERATION_JOBS_DB, jobId, ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID)
      ));
      return { ok: false, errorCode: ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID };
    }

    const completed = await step.do("complete multi-batch job", async () => (
      completeGenerationJob(this.env?.GENERATION_JOBS_DB, jobId, items, {
        requestedItemCount: progress.requestedItemCount,
        batchSize: progress.batchSize,
        batchCount: progress.batchCount || batches.length,
      })
    ));
    if (!completed.ok) return completed;

    return completed;
  }
}

async function handleExtractObjectives(request, env) {
  const body = await readJson(request);
  if (!body.ok) return errorResponse(request, env, body, 400);

  const { project = {}, materialText = "", files = [] } = body.data;
  const safeFiles = Array.isArray(files)
    ? files.filter((file) => file && typeof file.data === "string" && file.data.trim())
    : [];
  const hasFiles = safeFiles.length > 0;

  if (!hasFiles && (!materialText || !String(materialText).trim())) {
    return errorResponse(request, env, { error: "請上傳教材 PDF 或填入教材內容。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  if (safeFiles.length > 5) {
    return errorResponse(request, env, { error: "因 AI Token 限制，一次最多只能勾選 5 個檔案提取。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const totalBytes = safeFiles.reduce((sum, file) => sum + Math.ceil((file.data.length * 3) / 4), 0);
  if (totalBytes > 18 * 1024 * 1024) {
    return errorResponse(request, env, { error: "上傳檔案總量過大（約 18MB 上限），請減少檔案或頁數。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const prompt = buildExtractObjectivesPrompt({ project, materialText, hasFiles });
  const ai = await callGemini({ env, prompt, files: safeFiles });
  if (!ai.ok) return errorResponse(request, env, ai, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return errorResponse(request, env, parsed, 502);

  const payload = assertObjectivesPayload(parsed.data);
  if (!payload.ok) return errorResponse(request, env, payload, 502);

  return jsonResponse(request, env, { ok: true, objectives: payload.objectives, materialSummary: parsed.data.materialSummary || "" });
}

async function handleNormalizeObjectives(request, env) {
  const body = await readJson(request);
  if (!body.ok) return errorResponse(request, env, body, 400);

  const { text = "" } = body.data;
  if (!text || !String(text).trim()) {
    return errorResponse(request, env, { error: "沒有可整理的內容。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const prompt = buildNormalizeObjectivesPrompt({ text });
  const ai = await callGemini({ env, prompt });
  if (!ai.ok) return errorResponse(request, env, ai, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return errorResponse(request, env, parsed, 502);

  const payload = assertObjectivesPayload(parsed.data);
  if (!payload.ok) return errorResponse(request, env, payload, 502);

  return jsonResponse(request, env, { ok: true, objectives: payload.objectives });
}

async function handleGenerateItems(request, env) {
  const body = await readJson(request);
  if (!body.ok) return errorResponse(request, env, body, 400);

  const { project = {}, materialText = "", objectives = [], intents = [], checkedChineseSubcategories = [] } = body.data;

  if (!Array.isArray(objectives) || objectives.length === 0) {
    return errorResponse(request, env, { error: "缺少 objectives。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  if (!Array.isArray(intents) || intents.length === 0) {
    return errorResponse(request, env, { error: "缺少 intents。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const prompt = buildGenerateItemsPrompt({ project, materialText, objectives, intents, checkedChineseSubcategories });
  const ai = await callGemini({ env, prompt });
  if (!ai.ok) return errorResponse(request, env, ai, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return errorResponse(request, env, parsed, 502);

  const payload = assertItemsPayload(parsed.data);
  if (!payload.ok) return errorResponse(request, env, payload, 502);

  return jsonResponse(request, env, { ok: true, items: payload.items });
}

async function handleRegenerateItem(request, env) {
  const body = await readJson(request);
  if (!body.ok) return errorResponse(request, env, body, 400);

  const { project = {}, materialText = "", objectives = [], originalItem, reason = "", checkedChineseSubcategories = [] } = body.data;

  if (!originalItem || typeof originalItem !== "object") {
    return errorResponse(request, env, { error: "缺少 originalItem。", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const prompt = buildRegenerateItemPrompt({ project, materialText, objectives, originalItem, reason, checkedChineseSubcategories });
  const ai = await callGemini({ env, prompt });
  if (!ai.ok) return errorResponse(request, env, ai, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return errorResponse(request, env, parsed, 502);

  const payload = assertItemsPayload(parsed.data, 1);
  if (!payload.ok) return errorResponse(request, env, payload, 502);

  return jsonResponse(request, env, { ok: true, items: payload.items });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return handleOptions(request, env);

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse(request, env, { ok: true, service: "exam-wizard-next-proxy" });
    }

    const generationJobResponse = routeGenerationJobRequest(request, env, url);
    if (generationJobResponse) return generationJobResponse;

    if (url.pathname === "/extract-objectives" && request.method === "POST") {
      return handleExtractObjectives(request, env);
    }

    if (url.pathname === "/normalize-objectives" && request.method === "POST") {
      return handleNormalizeObjectives(request, env);
    }

    if (url.pathname === "/generate-items" && request.method === "POST") {
      return handleGenerateItems(request, env);
    }

    if (url.pathname === "/regenerate-item" && request.method === "POST") {
      return handleRegenerateItem(request, env);
    }

    return errorResponse(request, env, { error: "Not Found", errorCode: ERROR_CODES.NOT_FOUND }, 404);
  },
};
