import { handleOptions, jsonResponse } from "./cors.js";
import { ERROR_CODES, readJson, safeErrorPayload } from "./json.js";

export const ASYNC_GENERATION_MAX_ITEM_COUNT = 50;
export const ASYNC_GENERATION_BATCH_SIZE = 4;

const JOB_STATUS = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  VALIDATING: "validating",
  COMPLETED: "completed",
  FAILED: "failed",
  PARTIAL_FAILED: "partial_failed",
  EXPIRED: "expired",
});

const WORKFLOW_STATUS_MAP = Object.freeze({
  queued: JOB_STATUS.QUEUED,
  waiting: JOB_STATUS.RUNNING,
  running: JOB_STATUS.RUNNING,
  paused: JOB_STATUS.RUNNING,
  sleeping: JOB_STATUS.RUNNING,
  validating: JOB_STATUS.VALIDATING,
  complete: JOB_STATUS.COMPLETED,
  completed: JOB_STATUS.COMPLETED,
  success: JOB_STATUS.COMPLETED,
  partial_failed: JOB_STATUS.PARTIAL_FAILED,
  errored: JOB_STATUS.FAILED,
  error: JOB_STATUS.FAILED,
  failed: JOB_STATUS.FAILED,
  terminated: JOB_STATUS.FAILED,
  expired: JOB_STATUS.EXPIRED,
});

const JOB_EXPIRES_AFTER_HOURS = 24;
const DEFAULT_CLEANUP_LIMIT = 100;
const MAX_CLEANUP_LIMIT = 500;

function errorResponse(request, env, result, status) {
  return jsonResponse(request, env, safeErrorPayload(result), status);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toSafeCount(value, fallback = 0) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : fallback;
}

function createJobId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `gen_${globalThis.crypto.randomUUID()}`;
  }
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isValidJobId(jobId) {
  return typeof jobId === "string" && /^gen_[a-zA-Z0-9_-]{8,80}$/.test(jobId);
}

function createBatches(intents, batchSize = ASYNC_GENERATION_BATCH_SIZE) {
  const batches = [];
  for (let index = 0; index < intents.length; index += batchSize) {
    const entries = intents.slice(index, index + batchSize);
    batches.push({
      batchNumber: batches.length + 1,
      status: "queued",
      expectedItemCount: entries.length,
      expectedItemIds: entries.map((intent, itemIndex) => String(intent?.itemId || `item-${index + itemIndex + 1}`)),
      intents: entries,
    });
  }
  return batches;
}

export function createGenerationJobPlan(data = {}) {
  const {
    project = {},
    materialText = "",
    objectives = [],
    intents = [],
    checkedChineseSubcategories = [],
  } = isPlainObject(data) ? data : {};

  if (!isPlainObject(project)) {
    return { ok: false, error: "project must be an object.", errorCode: ERROR_CODES.REQUEST_INVALID };
  }

  if (!Array.isArray(objectives) || objectives.length === 0) {
    return { ok: false, error: "objectives are required.", errorCode: ERROR_CODES.REQUEST_INVALID };
  }

  if (!Array.isArray(intents) || intents.length === 0) {
    return { ok: false, error: "intents are required.", errorCode: ERROR_CODES.REQUEST_INVALID };
  }

  if (intents.length > ASYNC_GENERATION_MAX_ITEM_COUNT) {
    return {
      ok: false,
      error: `requested item count exceeds ${ASYNC_GENERATION_MAX_ITEM_COUNT}.`,
      errorCode: ERROR_CODES.REQUEST_INVALID,
    };
  }

  const batches = createBatches(intents);
  return {
    ok: true,
    request: {
      project,
      materialText: String(materialText || ""),
      objectives,
      intents,
      checkedChineseSubcategories: Array.isArray(checkedChineseSubcategories) ? checkedChineseSubcategories : [],
    },
    progress: {
      status: JOB_STATUS.QUEUED,
      requestedItemCount: intents.length,
      batchSize: ASYNC_GENERATION_BATCH_SIZE,
      batchCount: batches.length,
      completedBatchCount: 0,
      completedItemCount: 0,
      currentBatch: null,
    },
    batches,
  };
}

function safeProgress(progress = {}) {
  const requestedItemCount = toSafeCount(progress.requestedItemCount);
  const batchCount = toSafeCount(progress.batchCount);
  return {
    requestedItemCount,
    batchSize: toSafeCount(progress.batchSize, ASYNC_GENERATION_BATCH_SIZE),
    batchCount,
    completedBatchCount: Math.min(toSafeCount(progress.completedBatchCount), batchCount),
    completedItemCount: Math.min(toSafeCount(progress.completedItemCount), requestedItemCount),
    currentBatch: progress.currentBatch === null || progress.currentBatch === undefined
      ? null
      : Math.min(toSafeCount(progress.currentBatch), Math.max(batchCount, 1)),
  };
}

function safeJobPayload({ jobId, status, progress }) {
  return {
    ok: true,
    jobId,
    status,
    ...safeProgress(progress),
  };
}

function normalizeWorkflowStatus(jobId, statusResult) {
  if (!isPlainObject(statusResult)) {
    return { ok: false, error: "workflow status payload is invalid.", errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  const rawStatus = String(statusResult.status || statusResult.state || "").toLowerCase();
  const status = WORKFLOW_STATUS_MAP[rawStatus] || null;
  if (!status) {
    return { ok: false, error: "workflow status is unknown.", errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  const output = isPlainObject(statusResult.output) ? statusResult.output : {};
  const progress = isPlainObject(output.progress)
    ? output.progress
    : {
        requestedItemCount: output.requestedItemCount,
        batchSize: output.batchSize,
        batchCount: output.batchCount,
        completedBatchCount: output.completedBatchCount,
        completedItemCount: output.completedItemCount,
        currentBatch: output.currentBatch,
      };

  return {
    ok: true,
    payload: safeJobPayload({ jobId, status, progress }),
  };
}

function getWorkflow(env) {
  return env && env.GENERATION_WORKFLOW;
}

function getJobsDb(env) {
  return env && env.GENERATION_JOBS_DB;
}

function hasD1Interface(db) {
  return !!db && typeof db.prepare === "function";
}

function createExpiresAt(now = Date.now()) {
  return new Date(now + JOB_EXPIRES_AFTER_HOURS * 60 * 60 * 1000).toISOString();
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCleanupLimit(value = DEFAULT_CLEANUP_LIMIT) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return DEFAULT_CLEANUP_LIMIT;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_CLEANUP_LIMIT);
}

function createJobInsertStatements(db, jobId, plan) {
  const { progress, batches } = plan;
  const statements = [
    db.prepare(`
      INSERT INTO generation_jobs (
        job_id,
        status,
        requested_item_count,
        batch_size,
        batch_count,
        completed_batch_count,
        completed_item_count,
        current_batch,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobId,
      JOB_STATUS.QUEUED,
      progress.requestedItemCount,
      progress.batchSize,
      progress.batchCount,
      0,
      0,
      null,
      createExpiresAt(),
    ),
  ];

  for (const batch of batches) {
    statements.push(
      db.prepare(`
        INSERT INTO generation_job_batches (
          job_id,
          batch_number,
          status,
          expected_item_count,
          completed_item_count,
          retry_count
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        jobId,
        batch.batchNumber,
        "queued",
        batch.expectedItemCount,
        0,
        0,
      ),
    );
  }

  return statements;
}

async function persistGenerationJob(db, jobId, plan) {
  if (!hasD1Interface(db)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const statements = createJobInsertStatements(db, jobId, plan);
  try {
    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const statement of statements) {
        await statement.run();
      }
    }
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  return { ok: true };
}

async function startGenerationWorkflow(workflow, jobId, plan) {
  if (!workflow || typeof workflow.create !== "function") {
    return { ok: true, skipped: true };
  }

  try {
    await workflow.create({
      id: jobId,
      params: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    });
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  return { ok: true };
}

async function readGenerationJob(db, jobId) {
  if (!hasD1Interface(db)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE, status: 501 };
  }

  let row;
  try {
    row = await db.prepare(`
      SELECT
        job_id,
        status,
        requested_item_count,
        batch_size,
        batch_count,
        completed_batch_count,
        completed_item_count,
        current_batch
      FROM generation_jobs
      WHERE job_id = ?
      LIMIT 1
    `).bind(jobId).first();
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID, status: 502 };
  }

  if (!row) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_NOT_FOUND, status: 404 };
  }

  return {
    ok: true,
    payload: safeJobPayload({
      jobId: row.job_id,
      status: row.status,
      progress: {
        requestedItemCount: row.requested_item_count,
        batchSize: row.batch_size,
        batchCount: row.batch_count,
        completedBatchCount: row.completed_batch_count,
        completedItemCount: row.completed_item_count,
        currentBatch: row.current_batch,
      },
    }),
  };
}

export async function markGenerationJobRunning(db, jobId) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  try {
    await db.prepare(`
      UPDATE generation_jobs
      SET
        status = ?,
        current_batch = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(JOB_STATUS.RUNNING, 1, jobId).run();
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return { ok: true };
}

export async function markGenerationJobFailed(db, jobId, errorCode) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  try {
    await db.prepare(`
      UPDATE generation_jobs
      SET
        status = ?,
        error_code = ?,
        failed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(JOB_STATUS.FAILED, errorCode, jobId).run();
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return { ok: true };
}

export async function markGenerationBatchRunning(db, jobId, batchNumber) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  try {
    const statements = [
      db.prepare(`
        UPDATE generation_jobs
        SET
          status = ?,
          current_batch = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(JOB_STATUS.RUNNING, batchNumber, jobId),
      db.prepare(`
        UPDATE generation_job_batches
        SET
          status = ?,
          started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND batch_number = ?
      `).bind(JOB_STATUS.RUNNING, jobId, batchNumber),
    ];

    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const statement of statements) {
        await statement.run();
      }
    }
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return { ok: true };
}

export async function markGenerationBatchFailed(db, jobId, batchNumber, errorCode) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  try {
    const statements = [
      db.prepare(`
        UPDATE generation_job_batches
        SET
          status = ?,
          error_code = ?,
          failed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND batch_number = ?
      `).bind("failed_terminal", errorCode, jobId, batchNumber),
      db.prepare(`
        UPDATE generation_jobs
        SET
          status = ?,
          error_code = ?,
          failed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(JOB_STATUS.FAILED, errorCode, jobId),
    ];

    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const statement of statements) {
        await statement.run();
      }
    }
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return { ok: true };
}

export async function markGenerationBatchCompleted(db, jobId, batchNumber, itemCount, latencyMs, progress = {}) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const safeItemCount = toSafeCount(itemCount);
  const safeLatencyMs = toSafeCount(latencyMs);
  const batchCount = toSafeCount(progress.batchCount);
  const completedBatchCount = Math.min(toSafeCount(progress.completedBatchCount), batchCount || toSafeCount(batchNumber));
  const completedItemCount = Math.min(toSafeCount(progress.completedItemCount), toSafeCount(progress.requestedItemCount, safeItemCount));
  const nextBatch = completedBatchCount >= batchCount ? null : completedBatchCount + 1;

  try {
    const statements = [
      db.prepare(`
        UPDATE generation_job_batches
        SET
          status = ?,
          completed_item_count = ?,
          latency_ms = ?,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND batch_number = ?
      `).bind("completed", safeItemCount, safeLatencyMs, jobId, batchNumber),
      db.prepare(`
        UPDATE generation_jobs
        SET
          status = ?,
          completed_batch_count = ?,
          completed_item_count = ?,
          current_batch = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(JOB_STATUS.RUNNING, completedBatchCount, completedItemCount, nextBatch, jobId),
    ];

    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const statement of statements) {
        await statement.run();
      }
    }
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return { ok: true };
}

export async function completeGenerationJob(db, jobId, items, progress = {}) {
  if (!hasD1Interface(db) || !isValidJobId(jobId) || !Array.isArray(items)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const itemCount = items.length;
  const batchCount = toSafeCount(progress.batchCount, 1);
  const resultJson = JSON.stringify({
    items,
    batchCount,
    completedBatchCount: batchCount,
    partial: false,
  });

  try {
    await db.prepare(`
      UPDATE generation_jobs
      SET
        status = ?,
        completed_batch_count = ?,
        completed_item_count = ?,
        current_batch = ?,
        error_code = NULL,
        result_item_count = ?,
        result_json = ?,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(JOB_STATUS.COMPLETED, batchCount, itemCount, null, itemCount, resultJson, jobId).run();
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return {
    ok: true,
    jobId,
    status: JOB_STATUS.COMPLETED,
    requestedItemCount: toSafeCount(progress.requestedItemCount, itemCount),
    batchSize: toSafeCount(progress.batchSize, ASYNC_GENERATION_BATCH_SIZE),
    batchCount,
    completedBatchCount: batchCount,
    completedItemCount: itemCount,
    currentBatch: null,
  };
}

export async function completeSingleBatchGenerationJob(db, jobId, batchNumber, items, latencyMs) {
  if (!hasD1Interface(db) || !isValidJobId(jobId) || !Array.isArray(items)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const itemCount = items.length;
  const progress = {
    requestedItemCount: itemCount,
    batchSize: ASYNC_GENERATION_BATCH_SIZE,
    batchCount: 1,
    completedBatchCount: 1,
    completedItemCount: itemCount,
  };
  const batchCompleted = await markGenerationBatchCompleted(db, jobId, batchNumber, itemCount, latencyMs, progress);
  if (!batchCompleted.ok) return batchCompleted;

  return completeGenerationJob(db, jobId, items, progress);
}

export async function cleanupExpiredGenerationJobs(db, options = {}) {
  if (!hasD1Interface(db)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const nowIso = toIsoTimestamp(options.now || Date.now());
  if (!nowIso) {
    return { ok: false, error: "cleanup timestamp is invalid.", errorCode: ERROR_CODES.REQUEST_INVALID };
  }

  const limit = normalizeCleanupLimit(options.limit);
  let rows;
  try {
    const result = await db.prepare(`
      SELECT job_id
      FROM generation_jobs
      WHERE expires_at IS NOT NULL
        AND expires_at <= ?
      ORDER BY expires_at, created_at
      LIMIT ?
    `).bind(nowIso, limit).all();
    rows = Array.isArray(result?.results) ? result.results : [];
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  const jobIds = rows
    .map((row) => row?.job_id)
    .filter((jobId) => isValidJobId(jobId));

  if (jobIds.length === 0) {
    return { ok: true, deletedJobCount: 0 };
  }

  const statements = [];
  for (const jobId of jobIds) {
    statements.push(db.prepare("DELETE FROM generation_job_batches WHERE job_id = ?").bind(jobId));
    statements.push(db.prepare("DELETE FROM generation_jobs WHERE job_id = ?").bind(jobId));
  }

  try {
    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const statement of statements) {
        await statement.run();
      }
    }
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return { ok: true, deletedJobCount: jobIds.length };
}

export async function handleCreateGenerationJob(request, env) {
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") {
    return errorResponse(request, env, { error: "Not Found", errorCode: ERROR_CODES.NOT_FOUND }, 404);
  }

  const body = await readJson(request);
  if (!body.ok) return errorResponse(request, env, body, 400);

  const plan = createGenerationJobPlan(body.data);
  if (!plan.ok) return errorResponse(request, env, plan, 400);

  const jobId = createJobId();
  const db = getJobsDb(env);
  if (hasD1Interface(db)) {
    const saved = await persistGenerationJob(db, jobId, plan);
    if (!saved.ok) return errorResponse(request, env, saved, 502);

    const workflowStarted = await startGenerationWorkflow(getWorkflow(env), jobId, plan);
    if (!workflowStarted.ok) {
      await markGenerationJobFailed(db, jobId, workflowStarted.errorCode);
      return errorResponse(request, env, workflowStarted, 502);
    }

    return jsonResponse(request, env, safeJobPayload({ jobId, status: JOB_STATUS.QUEUED, progress: plan.progress }), 202);
  }

  const workflow = getWorkflow(env);
  if (!workflow || typeof workflow.create !== "function") {
    return errorResponse(request, env, { errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE }, 501);
  }

  try {
    await workflow.create({
      id: jobId,
      params: {
        jobId,
        request: plan.request,
        batches: plan.batches,
        progress: plan.progress,
      },
    });
  } catch {
    return errorResponse(request, env, { errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE }, 502);
  }

  return jsonResponse(request, env, safeJobPayload({ jobId, status: JOB_STATUS.QUEUED, progress: plan.progress }), 202);
}

export async function handleGetGenerationJobStatus(request, env, jobId) {
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "GET") {
    return errorResponse(request, env, { error: "Not Found", errorCode: ERROR_CODES.NOT_FOUND }, 404);
  }

  if (!isValidJobId(jobId)) {
    return errorResponse(request, env, { error: "jobId is invalid.", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const db = getJobsDb(env);
  if (hasD1Interface(db)) {
    const job = await readGenerationJob(db, jobId);
    if (!job.ok) return errorResponse(request, env, job, job.status || 502);

    return jsonResponse(request, env, job.payload);
  }

  const workflow = getWorkflow(env);
  if (!workflow || typeof workflow.get !== "function") {
    return errorResponse(request, env, { errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE }, 501);
  }

  let instance;
  try {
    instance = await workflow.get(jobId);
  } catch {
    return errorResponse(request, env, { errorCode: ERROR_CODES.ASYNC_JOB_NOT_FOUND }, 404);
  }
  if (!instance || typeof instance.status !== "function") {
    return errorResponse(request, env, { errorCode: ERROR_CODES.ASYNC_JOB_NOT_FOUND }, 404);
  }

  let statusResult;
  try {
    statusResult = await instance.status();
  } catch {
    return errorResponse(request, env, { errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID }, 502);
  }
  const normalized = normalizeWorkflowStatus(jobId, statusResult);
  if (!normalized.ok) return errorResponse(request, env, normalized, 502);

  return jsonResponse(request, env, normalized.payload);
}

export function routeGenerationJobRequest(request, env, url) {
  if (url.pathname === "/generation-jobs") {
    return handleCreateGenerationJob(request, env);
  }

  const match = url.pathname.match(/^\/generation-jobs\/([^/]+)$/);
  if (match) {
    return handleGetGenerationJobStatus(request, env, decodeURIComponent(match[1]));
  }

  return null;
}
