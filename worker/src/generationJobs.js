import { handleOptions, jsonResponse } from "./cors.js";
import { CONTRACT_VIOLATION_TYPES, ERROR_CODES, assertItemsPayload, readJson, safeErrorPayload } from "./json.js";
import { expandExpectedGenerationSlots } from "./groupSlots.js";

export const ASYNC_GENERATION_MAX_ITEM_COUNT = 50;
export const ASYNC_GENERATION_BATCH_SIZE = 4;
export const ASYNC_GENERATION_DEFAULT_MAX_CONCURRENT_BATCHES = 1;
export const ASYNC_GENERATION_MAX_CONCURRENT_BATCHES_LIMIT = 3;
export const PARTIAL_RESULT_MIN_COMPLETION_RATIO = 0.8;

const JOB_STATUS = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  VALIDATING: "validating",
  COMPLETED: "completed",
  PARTIAL: "partial",
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
  partial: JOB_STATUS.PARTIAL,
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
const SAFE_ERROR_CODES = new Set(Object.values(ERROR_CODES));
const SAFE_BATCH_STATUSES = new Set(["queued", "running", "validating", "completed", "failed_retryable", "failed_terminal"]);
const SAFE_JSON_CLASSIFICATION_SOURCES = new Set(["none", "parser", "finish_reason"]);
const SAFE_CONTRACT_VIOLATION_TYPES = new Set(Object.values(CONTRACT_VIOLATION_TYPES));
const SAFE_CONTRACT_VIOLATION_FIELDS = new Set([
  "questionType",
  "options",
  "answer",
  "correctAnswer",
  "acceptedAnswers",
  "groupId",
  "stimulus",
  "qualityMeta.distractorDesign",
  "misconceptionTag",
  "misconceptionDescription",
  "whyStudentsMayChooseIt",
  "whyItIsWrong",
  "revisionNote",
]);

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

function toNullableSafeCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

function normalizeUpstreamStatus(value) {
  if (value === null || value === undefined || value === "") return null;
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function normalizeFinishReason(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{1,64}$/.test(text) ? text : null;
}

function normalizeJsonClassificationSource(value) {
  const text = String(value || "").trim();
  return SAFE_JSON_CLASSIFICATION_SOURCES.has(text) ? text : null;
}

function normalizeContractViolationType(value) {
  const text = String(value || "").trim().toUpperCase();
  return SAFE_CONTRACT_VIOLATION_TYPES.has(text) ? text : null;
}

function normalizeContractViolationTypes(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(normalizeContractViolationType).filter(Boolean)));
  }
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return normalizeContractViolationTypes(parsed);
  } catch {
    // Fall back to pipe/comma separated text below.
  }

  return Array.from(new Set(value.split(/[|,]/).map(normalizeContractViolationType).filter(Boolean)));
}

function normalizeContractViolationField(value) {
  const text = String(value || "").trim();
  return SAFE_CONTRACT_VIOLATION_FIELDS.has(text) ? text : null;
}

function normalizeContractViolationOptionCode(value) {
  const text = String(value || "").trim().toUpperCase();
  if (/^[A-Z]$/.test(text)) return text;
  return text === "OTHER" ? "OTHER" : null;
}

function normalizeContractViolationItemIndex(value) {
  if (value === null || value === undefined || value === "") return null;
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function normalizeSafeSlotIdentifier(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : null;
}

function safeContractViolation(value = {}) {
  const detail = isPlainObject(value) ? value : {};
  const types = normalizeContractViolationTypes(detail.types);
  const primaryType = normalizeContractViolationType(detail.type) || types[0] || null;
  const safeTypes = primaryType && !types.includes(primaryType) ? [primaryType, ...types] : types;

  return {
    type: primaryType,
    types: safeTypes,
    itemIndex: normalizeContractViolationItemIndex(detail.itemIndex),
    field: normalizeContractViolationField(detail.field),
    optionCode: normalizeContractViolationOptionCode(detail.optionCode),
  };
}

function serializeContractViolationTypes(types = []) {
  const safeTypes = normalizeContractViolationTypes(types);
  return safeTypes.length > 0 ? JSON.stringify(safeTypes) : null;
}

function safeBatchDiagnostics(value = {}) {
  const diagnostics = isPlainObject(value) ? value : {};
  return {
    finishReason: normalizeFinishReason(diagnostics.finishReason),
    outputLength: toNullableSafeCount(diagnostics.outputLength),
    jsonCandidateLength: toNullableSafeCount(diagnostics.jsonCandidateLength),
    jsonClassificationSource: normalizeJsonClassificationSource(diagnostics.classificationSource),
    upstreamStatus: normalizeUpstreamStatus(diagnostics.upstreamStatus),
  };
}

function compactBatchDiagnostics(value = {}) {
  const diagnostics = safeBatchDiagnostics(value);
  const compact = {};
  if (diagnostics.finishReason) compact.finishReason = diagnostics.finishReason;
  if (diagnostics.outputLength !== null) compact.outputLength = diagnostics.outputLength;
  if (diagnostics.jsonCandidateLength !== null) compact.jsonCandidateLength = diagnostics.jsonCandidateLength;
  if (diagnostics.jsonClassificationSource) compact.jsonClassificationSource = diagnostics.jsonClassificationSource;
  if (diagnostics.upstreamStatus !== null) compact.upstreamStatus = diagnostics.upstreamStatus;
  return compact;
}

function safeErrorCode(value) {
  return SAFE_ERROR_CODES.has(value) ? value : ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID;
}

function safeBatchPayload(row = {}) {
  const status = SAFE_BATCH_STATUSES.has(row.status) ? row.status : "queued";
  const batch = {
    batchNumber: toSafeCount(row.batch_number),
    status,
    expectedItemCount: toSafeCount(row.expected_item_count),
    completedItemCount: toSafeCount(row.completed_item_count),
    retryCount: toSafeCount(row.retry_count),
  };
  const latencyMs = toNullableSafeCount(row.latency_ms);
  if (latencyMs !== null) batch.latencyMs = latencyMs;
  if (SAFE_ERROR_CODES.has(row.error_code)) batch.errorCode = row.error_code;

  const diagnostics = compactBatchDiagnostics({
    finishReason: row.finish_reason,
    outputLength: row.output_length,
    jsonCandidateLength: row.json_candidate_length,
    classificationSource: row.json_classification_source,
    upstreamStatus: row.upstream_status,
  });
  if (Object.keys(diagnostics).length > 0) batch.diagnostics = diagnostics;

  const contractViolation = safeContractViolation({
    type: row.contract_violation_type,
    types: row.contract_violation_types,
    itemIndex: row.contract_violation_item_index,
    field: row.contract_violation_field,
    optionCode: row.contract_violation_option_code,
  });
  if (contractViolation.type || contractViolation.types.length > 0) {
    batch.contractViolation = {
      ...(contractViolation.type ? { type: contractViolation.type } : {}),
      ...(contractViolation.types.length > 0 ? { types: contractViolation.types } : {}),
      ...(contractViolation.itemIndex !== null ? { itemIndex: contractViolation.itemIndex } : {}),
      ...(contractViolation.field ? { field: contractViolation.field } : {}),
      ...(contractViolation.optionCode ? { optionCode: contractViolation.optionCode } : {}),
    };
  }
  return batch;
}

function createBatchSlotPlan(batches = []) {
  const safeBatches = Array.isArray(batches) ? batches : [];
  let nextItemIndex = 1;
  return safeBatches.map((batch, index) => {
    const batchNumber = toSafeCount(batch?.batchNumber, index + 1);
    const expectedItemCount = toSafeCount(batch?.expectedItemCount);
    const expectedSlots = Array.isArray(batch?.expectedSlots) ? batch.expectedSlots : [];
    const itemIndexes = expectedSlots.length === expectedItemCount
      ? expectedSlots.map((slot, offset) => toSafeCount(slot?.expectedItemIndex, nextItemIndex + offset))
      : Array.from({ length: expectedItemCount }, (_, offset) => nextItemIndex + offset);
    nextItemIndex += expectedItemCount;
    return {
      batchNumber,
      expectedItemCount,
      itemIndexes,
      startItemIndex: itemIndexes[0] || null,
      expectedSlots,
    };
  });
}

function createMissingItemsFromFailedBatches(batches = [], failedBatches = []) {
  const slotPlan = createBatchSlotPlan(batches);
  const failedByBatch = new Map(
    (Array.isArray(failedBatches) ? failedBatches : [])
      .map((failed) => [toSafeCount(failed?.batchNumber), failed])
      .filter(([batchNumber]) => batchNumber > 0)
  );
  const missingItems = [];

  for (const batch of slotPlan) {
    const failed = failedByBatch.get(batch.batchNumber);
    if (!failed) continue;

    const errorCode = safeErrorCode(failed.errorCode);
    const violation = safeContractViolation(failed.contractViolation);
    const localFailureIndex = violation.itemIndex;
    const failureItemIndex = localFailureIndex !== null && batch.startItemIndex !== null
      ? batch.startItemIndex + localFailureIndex - 1
      : null;
    const upstreamStatus = normalizeUpstreamStatus(failed?.diagnostics?.upstreamStatus);

    for (let slotIndex = 0; slotIndex < batch.itemIndexes.length; slotIndex += 1) {
      const itemIndex = batch.itemIndexes[slotIndex];
      const expectedSlot = batch.expectedSlots[slotIndex] || {};
      const missing = {
        itemIndex,
        batchNumber: batch.batchNumber,
        errorCode,
      };
      if (expectedSlot.isGroupChild) {
        const itemId = normalizeSafeSlotIdentifier(expectedSlot.itemId);
        const parentItemId = normalizeSafeSlotIdentifier(expectedSlot.parentItemId);
        const childIndex = normalizeContractViolationItemIndex(expectedSlot.childIndex);
        const groupId = normalizeSafeSlotIdentifier(expectedSlot.groupId);
        if (itemId) missing.itemId = itemId;
        if (parentItemId) missing.parentItemId = parentItemId;
        if (childIndex !== null) missing.childIndex = childIndex;
        if (groupId) missing.groupId = groupId;
      }
      if (failureItemIndex !== null) missing.failureItemIndex = failureItemIndex;
      if (violation.types.length > 0) missing.contractViolationTypes = violation.types;
      if (violation.field) missing.contractViolationField = violation.field;
      if (violation.optionCode) missing.contractViolationOptionCode = violation.optionCode;
      if (upstreamStatus !== null) missing.upstreamStatus = upstreamStatus;
      missingItems.push(missing);
    }
  }

  return missingItems.sort((a, b) => a.itemIndex - b.itemIndex);
}

function safeMissingItemPayload(value = {}) {
  const item = isPlainObject(value) ? value : {};
  const itemIndex = normalizeContractViolationItemIndex(item.itemIndex);
  const batchNumber = normalizeContractViolationItemIndex(item.batchNumber);
  const errorCode = safeErrorCode(item.errorCode);
  if (itemIndex === null || batchNumber === null) return null;

  const missing = { itemIndex, batchNumber, errorCode };
  const itemId = normalizeSafeSlotIdentifier(item.itemId);
  if (itemId) missing.itemId = itemId;
  const parentItemId = normalizeSafeSlotIdentifier(item.parentItemId);
  if (parentItemId) missing.parentItemId = parentItemId;
  const childIndex = normalizeContractViolationItemIndex(item.childIndex);
  if (childIndex !== null) missing.childIndex = childIndex;
  const groupId = normalizeSafeSlotIdentifier(item.groupId);
  if (groupId) missing.groupId = groupId;
  const failureItemIndex = normalizeContractViolationItemIndex(item.failureItemIndex);
  if (failureItemIndex !== null) missing.failureItemIndex = failureItemIndex;
  const contractViolationTypes = normalizeContractViolationTypes(item.contractViolationTypes);
  if (contractViolationTypes.length > 0) missing.contractViolationTypes = contractViolationTypes;
  const contractViolationField = normalizeContractViolationField(item.contractViolationField);
  if (contractViolationField) missing.contractViolationField = contractViolationField;
  const contractViolationOptionCode = normalizeContractViolationOptionCode(item.contractViolationOptionCode);
  if (contractViolationOptionCode) missing.contractViolationOptionCode = contractViolationOptionCode;
  const upstreamStatus = normalizeUpstreamStatus(item.upstreamStatus);
  if (upstreamStatus !== null) missing.upstreamStatus = upstreamStatus;
  return missing;
}

function normalizeMissingItemsPayload(value = []) {
  if (!Array.isArray(value)) return { ok: false, missingItems: [] };
  const missingItems = value.map(safeMissingItemPayload);
  if (missingItems.some((item) => !item)) {
    return { ok: false, missingItems: [] };
  }
  return { ok: true, missingItems };
}

function validatePartialItemSlots(items = [], missingItems = [], requestedItemCount = 0) {
  const requested = toSafeCount(requestedItemCount);
  if (requested <= 0) return false;
  const seen = new Set();

  for (const item of items) {
    const itemIndex = normalizeContractViolationItemIndex(item?.itemIndex);
    if (itemIndex === null || itemIndex > requested || seen.has(itemIndex)) return false;
    seen.add(itemIndex);
  }

  for (const missing of missingItems) {
    const itemIndex = normalizeContractViolationItemIndex(missing?.itemIndex);
    if (itemIndex === null || itemIndex > requested || seen.has(itemIndex)) return false;
    seen.add(itemIndex);
  }

  return seen.size === requested;
}

function partialResultMinimumItemCount(requestedItemCount) {
  return Math.ceil(toSafeCount(requestedItemCount) * PARTIAL_RESULT_MIN_COMPLETION_RATIO);
}

export function resolveAsyncGenerationMaxConcurrentBatches(env = {}) {
  const configured = Number(env?.ASYNC_GENERATION_MAX_CONCURRENT_BATCHES);
  const value = Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : ASYNC_GENERATION_DEFAULT_MAX_CONCURRENT_BATCHES;
  return Math.min(Math.max(value, 1), ASYNC_GENERATION_MAX_CONCURRENT_BATCHES_LIMIT);
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
  let nextExpectedItemIndex = 1;
  let groupChildCount = 0;
  for (let index = 0; index < intents.length; index += batchSize) {
    const entries = intents.slice(index, index + batchSize);
    const expanded = expandExpectedGenerationSlots(entries, { startItemIndex: nextExpectedItemIndex });
    if (!expanded.ok) {
      return {
        ok: false,
        error: expanded.error,
        errorCode: ERROR_CODES.REQUEST_INVALID,
      };
    }
    nextExpectedItemIndex += expanded.expectedItemCount;
    groupChildCount += expanded.groupChildCount;
    batches.push({
      batchNumber: batches.length + 1,
      status: "queued",
      parentSlotCount: entries.length,
      expectedItemCount: expanded.expectedItemCount,
      groupChildCount: expanded.groupChildCount,
      expectedItemIds: expanded.expectedSlots.map((slot) => String(slot.itemId)),
      expectedSlots: expanded.expectedSlots,
      intents: entries,
    });
  }
  return {
    ok: true,
    batches,
    parentSlotCount: intents.length,
    expectedItemCount: nextExpectedItemIndex - 1,
    groupChildCount,
  };
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

  const batchPlan = createBatches(intents);
  if (!batchPlan.ok) return batchPlan;
  const { batches } = batchPlan;
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
      requestedItemCount: batchPlan.expectedItemCount,
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
  const safe = {
    requestedItemCount,
    batchSize: toSafeCount(progress.batchSize, ASYNC_GENERATION_BATCH_SIZE),
    batchCount,
    completedBatchCount: Math.min(toSafeCount(progress.completedBatchCount), batchCount),
    completedItemCount: Math.min(toSafeCount(progress.completedItemCount), requestedItemCount),
    currentBatch: progress.currentBatch === null || progress.currentBatch === undefined
      ? null
      : Math.min(toSafeCount(progress.currentBatch), Math.max(batchCount, 1)),
  };
  if (SAFE_ERROR_CODES.has(progress.errorCode)) {
    safe.errorCode = progress.errorCode;
  }
  return safe;
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
        current_batch,
        error_code
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

  const batches = await readGenerationJobBatches(db, jobId);
  if (!batches.ok) return batches;

  return {
    ok: true,
    payload: {
      ...safeJobPayload({
        jobId: row.job_id,
        status: row.status,
        progress: {
          requestedItemCount: row.requested_item_count,
          batchSize: row.batch_size,
          batchCount: row.batch_count,
          completedBatchCount: row.completed_batch_count,
          completedItemCount: row.completed_item_count,
          currentBatch: row.current_batch,
          errorCode: row.error_code,
        },
      }),
      batches: batches.batches,
    },
  };
}

async function readGenerationJobBatches(db, jobId) {
  let rows;
  try {
    const result = await db.prepare(`
      SELECT
        batch_number,
        status,
        expected_item_count,
        completed_item_count,
        retry_count,
        error_code,
        latency_ms,
        finish_reason,
        output_length,
        json_candidate_length,
        json_classification_source,
        upstream_status,
        contract_violation_type,
        contract_violation_types,
        contract_violation_item_index,
        contract_violation_field,
        contract_violation_option_code
      FROM generation_job_batches
      WHERE job_id = ?
      ORDER BY batch_number ASC
    `).bind(jobId).all();
    rows = Array.isArray(result?.results) ? result.results : [];
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID, status: 502 };
  }

  return { ok: true, batches: rows.map((row) => safeBatchPayload(row)) };
}

async function readGenerationJobResult(db, jobId) {
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
        current_batch,
        result_item_count,
        result_json
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

  const isPartial = row.status === JOB_STATUS.PARTIAL;
  if (row.status !== JOB_STATUS.COMPLETED && !isPartial) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_RESULT_UNAVAILABLE, status: 409 };
  }

  let data;
  try {
    data = JSON.parse(row.result_json || "");
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_RESULT_INVALID, status: 502 };
  }

  if (!isPlainObject(data) || Boolean(data.partial) !== isPartial) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_RESULT_INVALID, status: 502 };
  }

  const expectedCount = Number.isFinite(Number(row.result_item_count))
    ? Number(row.result_item_count)
    : Number.isFinite(Number(row.requested_item_count))
      ? Number(row.requested_item_count)
      : null;
  const payload = assertItemsPayload(data, expectedCount);
  if (!payload.ok) {
    return {
      ok: false,
      errorCode: payload.errorCode || ERROR_CODES.ASYNC_JOB_RESULT_INVALID,
      status: 502,
    };
  }
  const missingResult = isPartial
    ? normalizeMissingItemsPayload(data.missingItems)
    : { ok: true, missingItems: [] };
  if (!missingResult.ok || (isPartial && missingResult.missingItems.length === 0)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_RESULT_INVALID, status: 502 };
  }
  if (isPartial && !validatePartialItemSlots(payload.items, missingResult.missingItems, row.requested_item_count)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_RESULT_INVALID, status: 502 };
  }

  return {
    ok: true,
    payload: {
      ...safeJobPayload({
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
      items: payload.items,
      partial: isPartial,
      missingItems: missingResult.missingItems,
    },
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
  return markGenerationBatchesRunning(db, jobId, [batchNumber]);
}

export async function markGenerationBatchesRunning(db, jobId, batchNumbers = []) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const safeBatchNumbers = Array.from(new Set(
    (Array.isArray(batchNumbers) ? batchNumbers : [])
      .map((batchNumber) => toSafeCount(batchNumber))
      .filter((batchNumber) => batchNumber > 0)
  )).sort((a, b) => a - b);
  if (safeBatchNumbers.length === 0) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  const currentBatch = safeBatchNumbers[0];

  try {
    const statements = [
      db.prepare(`
        UPDATE generation_jobs
        SET
          status = ?,
          current_batch = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(JOB_STATUS.RUNNING, currentBatch, jobId),
      ...safeBatchNumbers.map((batchNumber) => db.prepare(`
        UPDATE generation_job_batches
        SET
          status = ?,
          started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND batch_number = ?
      `).bind(JOB_STATUS.RUNNING, jobId, batchNumber)),
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

  return { ok: true, currentBatch, runningBatchCount: safeBatchNumbers.length };
}

export async function markGenerationBatchFailed(db, jobId, batchNumber, errorCode, options = {}) {
  if (!hasD1Interface(db) || !isValidJobId(jobId)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const safeLatencyMs = toSafeCount(options.latencyMs);
  const safeRetryCount = toSafeCount(options.retryCount);
  const safeDiagnostics = safeBatchDiagnostics(options.diagnostics);
  const safeViolation = safeContractViolation(options.contractViolation);

  try {
    const statements = [
      db.prepare(`
        UPDATE generation_job_batches
        SET
          status = ?,
          error_code = ?,
          latency_ms = ?,
          retry_count = ?,
          finish_reason = ?,
          output_length = ?,
          json_candidate_length = ?,
          json_classification_source = ?,
          upstream_status = ?,
          contract_violation_type = ?,
          contract_violation_types = ?,
          contract_violation_item_index = ?,
          contract_violation_field = ?,
          contract_violation_option_code = ?,
          failed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND batch_number = ?
      `).bind(
        "failed_terminal",
        errorCode,
        safeLatencyMs,
        safeRetryCount,
        safeDiagnostics.finishReason,
        safeDiagnostics.outputLength,
        safeDiagnostics.jsonCandidateLength,
        safeDiagnostics.jsonClassificationSource,
        safeDiagnostics.upstreamStatus,
        safeViolation.type,
        serializeContractViolationTypes(safeViolation.types),
        safeViolation.itemIndex,
        safeViolation.field,
        safeViolation.optionCode,
        jobId,
        batchNumber
      ),
    ];

    if (options.markJobFailed !== false) {
      statements.push(db.prepare(`
        UPDATE generation_jobs
        SET
          status = ?,
          error_code = ?,
          failed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(JOB_STATUS.FAILED, errorCode, jobId));
    }

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
  const safeRetryCount = toSafeCount(progress.retryCount);
  const safeDiagnostics = safeBatchDiagnostics(progress.diagnostics);
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
          retry_count = ?,
          finish_reason = ?,
          output_length = ?,
          json_candidate_length = ?,
          json_classification_source = ?,
          upstream_status = ?,
          error_code = NULL,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND batch_number = ?
      `).bind(
        "completed",
        safeItemCount,
        safeLatencyMs,
        safeRetryCount,
        safeDiagnostics.finishReason,
        safeDiagnostics.outputLength,
        safeDiagnostics.jsonCandidateLength,
        safeDiagnostics.jsonClassificationSource,
        safeDiagnostics.upstreamStatus,
        jobId,
        batchNumber
      ),
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
  const requestedItemCount = toSafeCount(progress.requestedItemCount, itemCount);
  const resultJson = JSON.stringify({
    items,
    batchCount,
    completedBatchCount: batchCount,
    completedItemCount: itemCount,
    requestedItemCount,
    partial: false,
    missingItems: [],
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
    requestedItemCount,
    batchSize: toSafeCount(progress.batchSize, ASYNC_GENERATION_BATCH_SIZE),
    batchCount,
    completedBatchCount: batchCount,
    completedItemCount: itemCount,
    currentBatch: null,
  };
}

export async function completePartialGenerationJob(db, jobId, items, batches, failedBatches, progress = {}) {
  if (!hasD1Interface(db) || !isValidJobId(jobId) || !Array.isArray(items)) {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_UNAVAILABLE };
  }

  const itemCount = items.length;
  const batchCount = toSafeCount(progress.batchCount, Array.isArray(batches) ? batches.length : 0);
  const requestedItemCount = toSafeCount(progress.requestedItemCount, itemCount);
  const minimumItemCount = partialResultMinimumItemCount(requestedItemCount);
  const firstErrorCode = safeErrorCode(Array.isArray(failedBatches) && failedBatches[0]?.errorCode);

  if (itemCount < minimumItemCount) {
    const failed = await markGenerationJobFailed(db, jobId, firstErrorCode);
    if (!failed.ok) return failed;
    return {
      ok: false,
      jobId,
      status: JOB_STATUS.FAILED,
      errorCode: firstErrorCode,
      requestedItemCount,
      batchSize: toSafeCount(progress.batchSize, ASYNC_GENERATION_BATCH_SIZE),
      batchCount,
      completedBatchCount: toSafeCount(progress.completedBatchCount),
      completedItemCount: itemCount,
      currentBatch: null,
    };
  }

  const missingItems = createMissingItemsFromFailedBatches(batches, failedBatches);
  const resultJson = JSON.stringify({
    items,
    batchCount,
    completedBatchCount: toSafeCount(progress.completedBatchCount),
    completedItemCount: itemCount,
    requestedItemCount,
    partial: true,
    missingItems,
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
    `).bind(
      JOB_STATUS.PARTIAL,
      toSafeCount(progress.completedBatchCount),
      itemCount,
      null,
      itemCount,
      resultJson,
      jobId
    ).run();
  } catch {
    return { ok: false, errorCode: ERROR_CODES.ASYNC_JOB_STATUS_INVALID };
  }

  return {
    ok: true,
    jobId,
    status: JOB_STATUS.PARTIAL,
    requestedItemCount,
    batchSize: toSafeCount(progress.batchSize, ASYNC_GENERATION_BATCH_SIZE),
    batchCount,
    completedBatchCount: toSafeCount(progress.completedBatchCount),
    completedItemCount: itemCount,
    currentBatch: null,
    partial: true,
    missingItemCount: missingItems.length,
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

export async function handleGetGenerationJobResult(request, env, jobId) {
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "GET") {
    return errorResponse(request, env, { error: "Not Found", errorCode: ERROR_CODES.NOT_FOUND }, 404);
  }

  if (!isValidJobId(jobId)) {
    return errorResponse(request, env, { error: "jobId is invalid.", errorCode: ERROR_CODES.REQUEST_INVALID }, 400);
  }

  const result = await readGenerationJobResult(getJobsDb(env), jobId);
  if (!result.ok) return errorResponse(request, env, result, result.status || 502);

  return jsonResponse(request, env, result.payload);
}

export function routeGenerationJobRequest(request, env, url) {
  if (url.pathname === "/generation-jobs") {
    return handleCreateGenerationJob(request, env);
  }

  const resultMatch = url.pathname.match(/^\/generation-jobs\/([^/]+)\/result$/);
  if (resultMatch) {
    return handleGetGenerationJobResult(request, env, decodeURIComponent(resultMatch[1]));
  }

  const match = url.pathname.match(/^\/generation-jobs\/([^/]+)$/);
  if (match) {
    return handleGetGenerationJobStatus(request, env, decodeURIComponent(match[1]));
  }

  return null;
}
