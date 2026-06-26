#!/usr/bin/env node
import { validateGeneratedPaper } from "../frontend/src/core/validateGeneratedPaper.js";
import { normalizeGeneratedItems } from "../frontend/src/core/normalizeItem.js";
import { expandExpectedGenerationSlots } from "../worker/src/groupSlots.js";

const DEFAULT_API_BASE_URL = "https://exam-wizard-next-proxy.smallcannon.workers.dev";
const MAX_ITEM_COUNT = 50;
const TERMINAL_STATUSES = new Set(["completed", "partial", "failed"]);
const SUCCESS_LIKE_TERMINAL_STATUSES = new Set(["completed", "partial"]);

const COMMON_TEXT = {
  choiceQuestion: "\u9078\u64c7\u984c",
  trueFalseQuestion: "\u662f\u975e\u984c",
  fillInQuestion: "\u586b\u5145\u984c",
  literacyQuestion: "\u5b78\u529b\u6aa2\u6e2c\u984c",
  apply: "\u61c9\u7528",
  understand: "\u7406\u89e3",
  remember: "\u8a18\u61b6",
};

const SUBJECT_PRESETS = {
  chinese: {
    aliases: ["chinese", "mandarin", "\u570b\u8a9e", "\u570b\u8a9e\u6587"],
    subject: "\u570b\u8a9e",
    grade: "\u56db\u5e74\u7d1a",
    material:
      "\u56db\u5e74\u7d1a\u570b\u8a9e\u7d9c\u5408\u7df4\u7fd2\uff1a\u8a9e\u8a5e\u7406\u89e3\u3001\u53e5\u610f\u5224\u65b7\u3001\u6a19\u9ede\u7b26\u865f\u3001\u6bb5\u843d\u91cd\u9ede\u8207\u751f\u6d3b\u60c5\u5883\u95b1\u8b80\u3002\u984c\u76ee\u9700\u81ea\u6210\u4e00\u984c\uff1b\u82e5\u984c\u5e79\u8981\u6c42\u4f9d\u64da\u6587\u672c\u4f5c\u7b54\uff0c\u5fc5\u9808\u5728\u540c\u4e00\u984c\u63d0\u4f9b stimulus\u3002",
    objectives: [
      "\u80fd\u7406\u89e3\u56db\u5e74\u7d1a\u570b\u8a9e\u8ab2\u6587\u5e38\u898b\u8a9e\u8a5e\u3001\u53e5\u610f\u3001\u6bb5\u843d\u91cd\u9ede\u8207\u6a19\u9ede\u7528\u6cd5\u3002",
      "\u80fd\u6839\u64da\u77ed\u53e5\u8207\u751f\u6d3b\u60c5\u5883\u5224\u65b7\u8a5e\u8a9e\u4f7f\u7528\u3001\u8a9e\u610f\u95dc\u4fc2\u8207\u57fa\u672c\u95b1\u8b80\u7406\u89e3\u3002",
    ],
    subcategories: [
      "\u63d0\u53d6\u8a0a\u606f",
      "\u8a9e\u8a5e\u7406\u89e3",
      "\u6a19\u9ede\u7b26\u865f",
      "\u53e5\u610f\u5224\u65b7",
    ],
    dimension(index) {
      return index % 4 === 0 ? "\u6bb5\u7bc7\u8b80\u5beb" : "\u5b57\u8a5e\u53e5\u7406\u89e3";
    },
  },
  math: {
    aliases: ["math", "mathematics", "\u6578\u5b78"],
    subject: "\u6578\u5b78",
    grade: "\u56db\u5e74\u7d1a",
    material:
      "\u56db\u5e74\u7d1a\u6578\u5b78\u7d9c\u5408\u7df4\u7fd2\uff1a\u6574\u6578\u56db\u5247\u904b\u7b97\u3001\u5206\u6578\u8207\u5c0f\u6578\u57fa\u790e\u6982\u5ff5\u3001\u5468\u9577\u9762\u7a4d\u3001\u55ae\u4f4d\u63db\u7b97\u8207\u5716\u8868\u5224\u8b80\u3002\u984c\u76ee\u61c9\u81ea\u6210\u4e00\u984c\uff0c\u907f\u514d\u9700\u8981\u984d\u5916\u5716\u7247\u6216\u672a\u63d0\u4f9b\u7684\u8868\u683c\u624d\u80fd\u4f5c\u7b54\u3002",
    objectives: [
      "\u80fd\u6839\u64da\u984c\u610f\u5224\u65b7\u6578\u91cf\u95dc\u4fc2\u4e26\u9078\u64c7\u9069\u7576\u7b97\u5f0f\u89e3\u984c\u3002",
      "\u80fd\u904b\u7528\u5206\u6578\u3001\u5c0f\u6578\u3001\u5e7e\u4f55\u8207\u8cc7\u6599\u5224\u8b80\u6982\u5ff5\u89e3\u6c7a\u751f\u6d3b\u60c5\u5883\u554f\u984c\u3002",
    ],
    subcategories: [],
  },
  natural: {
    aliases: ["natural", "science", "\u81ea\u7136", "\u81ea\u7136\u79d1\u5b78"],
    subject: "\u81ea\u7136",
    grade: "\u4e94\u5e74\u7d1a",
    material:
      "\u4e94\u5e74\u7d1a\u81ea\u7136\u7d9c\u5408\u7df4\u7fd2\uff1a\u751f\u7269\u9069\u61c9\u3001\u6c34\u6eb6\u6db2\u8207\u7269\u8cea\u8b8a\u5316\u3001\u529b\u8207\u904b\u52d5\u3001\u5730\u7403\u8207\u5929\u6c23\u89c0\u5bdf\u3001\u5be6\u9a57\u8b8a\u56e0\u8207\u5716\u8868\u8cc7\u6599\u5224\u8b80\u3002\u984c\u76ee\u9700\u81ea\u6210\u4e00\u984c\uff1b\u82e5\u8981\u6c42\u4f9d\u64da\u89c0\u5bdf\u8cc7\u6599\u4f5c\u7b54\uff0c\u5fc5\u9808\u5728\u984c\u5e79\u4e2d\u63d0\u4f9b\u5fc5\u8981\u8cc7\u6599\u3002",
    objectives: [
      "\u80fd\u7406\u89e3\u81ea\u7136\u73fe\u8c61\u3001\u7269\u8cea\u7279\u6027\u8207\u751f\u7269\u9069\u61c9\u7b49\u57fa\u672c\u6982\u5ff5\u3002",
      "\u80fd\u6839\u64da\u5be6\u9a57\u60c5\u5883\u3001\u89c0\u5bdf\u8cc7\u6599\u8207\u5716\u8868\u5224\u8b80\u7d50\u679c\u4e26\u63a8\u8ad6\u3002",
    ],
    subcategories: [],
  },
};

function getArgValue(name, fallback = "") {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasArgValue(name) {
  const prefix = `${name}=`;
  return process.argv.some((value) => value.startsWith(prefix));
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveSubjectPreset(value = "") {
  const normalized = String(value || "chinese").trim().toLowerCase();
  return Object.values(SUBJECT_PRESETS).find((preset) => (
    preset.aliases.some((alias) => String(alias).trim().toLowerCase() === normalized)
  )) || null;
}

function createIntent(index, preset, type = COMMON_TEXT.choiceQuestion, overrides = {}) {
  return {
    itemId: `Q-${String(index).padStart(3, "0")}`,
    questionType: type,
    score: 1,
    primaryObjectiveId: index < 25 ? "O-001" : "O-002",
    objectiveIds: [index < 25 ? "O-001" : "O-002"],
    cognitiveLevel: index % 5 === 0
      ? COMMON_TEXT.apply
      : index % 3 === 0
        ? COMMON_TEXT.understand
        : COMMON_TEXT.remember,
    ...(preset.dimension ? { chineseDimension: preset.dimension(index) } : {}),
    ...overrides,
  };
}

function buildCaseIntents(itemCount, preset, caseName) {
  if (caseName === "literacy-group4") {
    return Array.from({ length: 4 }, (_, index) => createIntent(index + 1, preset, COMMON_TEXT.literacyQuestion, {
      score: 5,
      isGroup: true,
      subCount: 2,
      subScores: [2, 3],
    }));
  }

  if (caseName === "mixed44-ui") {
    return [
      ...Array.from({ length: 20 }, (_, index) => createIntent(index + 1, preset, COMMON_TEXT.choiceQuestion)),
      ...Array.from({ length: 10 }, (_, index) => createIntent(index + 21, preset, COMMON_TEXT.trueFalseQuestion)),
      ...Array.from({ length: 10 }, (_, index) => createIntent(index + 31, preset, COMMON_TEXT.fillInQuestion)),
      ...Array.from({ length: 4 }, (_, index) => createIntent(index + 41, preset, COMMON_TEXT.literacyQuestion, {
        score: 5,
        isGroup: true,
        subCount: 2,
        subScores: [2, 3],
      })),
    ];
  }

  return Array.from({ length: itemCount }, (_, index) => createIntent(index + 1, preset, COMMON_TEXT.choiceQuestion));
}

function buildPayload(itemCount, preset, grade, caseName = "choice") {
  const objectives = preset.objectives.map((text, index) => ({
    objectiveId: `O-${String(index + 1).padStart(3, "0")}`,
    text,
    periodCount: 2,
  }));
  const intents = buildCaseIntents(itemCount, preset, caseName);

  return {
    project: { subject: preset.subject, grade },
    materialText: preset.material,
    objectives,
    intents,
    checkedChineseSubcategories: preset.subcategories,
  };
}

function summarizeExpectedSlots(intents = []) {
  const expanded = expandExpectedGenerationSlots(intents);
  if (!expanded.ok) {
    return {
      parentSlotCount: Array.isArray(intents) ? intents.length : 0,
      expectedItemCount: null,
      groupChildCount: null,
      expansionError: expanded.error || "unknown",
    };
  }
  return {
    parentSlotCount: expanded.parentSlotCount,
    expectedItemCount: expanded.expectedItemCount,
    groupChildCount: expanded.groupChildCount,
  };
}

function summarizeIntentTypes(intents = []) {
  const counts = {};
  for (const intent of intents) {
    const type = intent?.questionType || "unknown";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function buildObservationPlan({ payload, caseName, itemCount, expectedSlotSummary }) {
  return {
    caseName,
    cases: [caseName],
    plannedJobs: 1,
    requestedParentItemCount: itemCount,
    parentSlotCount: expectedSlotSummary.parentSlotCount,
    expectedItemCount: expectedSlotSummary.expectedItemCount,
    groupChildCount: expectedSlotSummary.groupChildCount,
    questionTypeCounts: summarizeIntentTypes(payload.intents),
  };
}

function isNonInteractiveEnvironment(env = process.env) {
  return Boolean(env.CI) || process.stdin.isTTY !== true;
}

function createPaidApiGuardResult({
  dryRun,
  caseName,
  maxJobsProvided,
  maxJobs,
  plannedJobs,
  env = process.env,
} = {}) {
  if (dryRun) return { ok: true };

  if (!hasFlag("--allow-paid-api")) {
    return {
      ok: false,
      error: "Refusing to call production API without --allow-paid-api.",
      missing: ["--allow-paid-api"],
    };
  }

  if (!maxJobsProvided) {
    return {
      ok: false,
      error: "Refusing to call production API without --max-jobs=<number>.",
      missing: ["--max-jobs"],
    };
  }

  if (!Number.isInteger(maxJobs) || maxJobs < 1) {
    return {
      ok: false,
      error: "--max-jobs must be a positive integer.",
    };
  }

  if (plannedJobs > maxJobs) {
    return {
      ok: false,
      error: `Planned job count ${plannedJobs} exceeds --max-jobs=${maxJobs}.`,
    };
  }

  if (caseName === "mixed44-ui" && !hasFlag("--allow-large-smoke")) {
    return {
      ok: false,
      error: "Refusing to run mixed44-ui without --allow-large-smoke.",
      missing: ["--allow-large-smoke"],
    };
  }

  if (isNonInteractiveEnvironment(env) && env.ALLOW_PAID_API !== "1") {
    return {
      ok: false,
      error: "Refusing paid API call in CI/non-interactive mode without ALLOW_PAID_API=1.",
      missing: ["ALLOW_PAID_API=1"],
    };
  }

  return { ok: true };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response) {
  return response.json().catch(() => null);
}

async function requestJson(apiBaseUrl, path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const data = await readJson(response);
  return { response, data };
}

function hasPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObservationInputSafe(preset, grade, caseName = "choice") {
  const allowedCases = new Set(["choice", "literacy-group4", "mixed44-ui"]);
  const checks = [
    { field: "subject", expected: preset.subject, actual: preset.subject },
    { field: "grade", expected: grade, actual: grade },
    { field: "caseName", expected: caseName, actual: allowedCases.has(caseName) ? caseName : "" },
  ];
  const failures = checks.filter((check) => (
    check.actual !== check.expected || String(check.actual).includes("??")
  ));
  return failures.length
    ? { ok: false, failures }
    : {
        ok: true,
        subject: preset.subject,
        grade,
        questionType: COMMON_TEXT.choiceQuestion,
      };
}

function estimateQualityMetaStats(items) {
  const outputLength = JSON.stringify({ items }).length;
  const qualityMetaLength = items.reduce((sum, item) => (
    sum + (item?.qualityMeta ? JSON.stringify(item.qualityMeta).length : 0)
  ), 0);
  return {
    outputLengthEstimate: outputLength,
    qualityMetaLengthEstimate: qualityMetaLength,
    qualityMetaRatioEstimate: outputLength ? Number((qualityMetaLength / outputLength).toFixed(3)) : 0,
  };
}

function detectLeakage(items) {
  const text = JSON.stringify(items).toLowerCase();
  const tokens = ["api key", "apikey", "token", "authorization", "bearer", "raw prompt", "raw output", "headers", "cookie"];
  return tokens.filter((token) => text.includes(token));
}

function summarizeBatches(batches = []) {
  const statusCounts = {};
  const finishReasonCounts = {};
  const upstreamStatusCounts = {};
  let diagnosticsPresentCount = 0;
  let retryBatchCount = 0;
  let outputLengthTotal = 0;
  let jsonCandidateLengthTotal = 0;
  let maxOutputLength = 0;
  let maxJsonCandidateLength = 0;

  for (const batch of batches) {
    const status = batch?.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (Number(batch?.retryCount || 0) > 0) retryBatchCount += 1;

    const diagnostics = hasPlainObject(batch?.diagnostics) ? batch.diagnostics : {};
    if (Object.keys(diagnostics).length > 0) diagnosticsPresentCount += 1;
    if (diagnostics.finishReason) {
      finishReasonCounts[diagnostics.finishReason] = (finishReasonCounts[diagnostics.finishReason] || 0) + 1;
    }
    if (diagnostics.upstreamStatus !== undefined && diagnostics.upstreamStatus !== null) {
      const upstreamStatus = String(diagnostics.upstreamStatus);
      upstreamStatusCounts[upstreamStatus] = (upstreamStatusCounts[upstreamStatus] || 0) + 1;
    }

    const outputLength = Number(diagnostics.outputLength || 0);
    const jsonCandidateLength = Number(diagnostics.jsonCandidateLength || 0);
    outputLengthTotal += outputLength;
    jsonCandidateLengthTotal += jsonCandidateLength;
    maxOutputLength = Math.max(maxOutputLength, outputLength);
    maxJsonCandidateLength = Math.max(maxJsonCandidateLength, jsonCandidateLength);
  }

  return {
    batchStatusCounts: statusCounts,
    diagnosticsPresentCount,
    retryBatchCount,
    finishReasonCounts,
    upstreamStatusCounts,
    outputLengthTotal,
    jsonCandidateLengthTotal,
    maxOutputLength,
    maxJsonCandidateLength,
  };
}

function summarizePartialResult(resultData = {}, statusData = {}) {
  const missingItems = Array.isArray(resultData?.missingItems) ? resultData.missingItems : [];
  const failedBatches = Array.isArray(statusData?.batches)
    ? statusData.batches.filter((batch) => batch?.status === "failed_terminal")
    : [];
  const missingErrorCodeCounts = {};
  for (const missing of missingItems) {
    const errorCode = missing?.errorCode || "unknown";
    missingErrorCodeCounts[errorCode] = (missingErrorCodeCounts[errorCode] || 0) + 1;
  }

  return {
    partial: Boolean(resultData?.partial || statusData?.status === "partial"),
    missingItemCount: missingItems.length,
    missingItemIndexes: missingItems
      .map((item) => item?.itemIndex)
      .filter((itemIndex) => itemIndex !== undefined && itemIndex !== null),
    failedBatchNumbers: failedBatches.map((batch) => batch.batchNumber),
    missingErrorCodeCounts,
  };
}

function summarizeProgress(data) {
  return {
    status: data?.status || "unknown",
    completedBatchCount: data?.completedBatchCount ?? null,
    batchCount: data?.batchCount ?? null,
    completedItemCount: data?.completedItemCount ?? null,
    requestedItemCount: data?.requestedItemCount ?? null,
    currentBatch: data?.currentBatch ?? null,
    errorCode: data?.errorCode || null,
    batchSummary: summarizeBatches(data?.batches || []),
  };
}

async function main() {
  const itemCount = Math.min(MAX_ITEM_COUNT, Math.max(1, safeNumber(getArgValue("--count", "25"), 25)));
  const pollIntervalMs = Math.max(1000, safeNumber(getArgValue("--poll-ms", "5000"), 5000));
  const timeoutMs = Math.max(60000, safeNumber(getArgValue("--timeout-ms", "900000"), 900000));
  const apiBaseUrl = getArgValue("--api-base-url", DEFAULT_API_BASE_URL);
  const caseName = getArgValue("--case", "choice");
  const dryRun = hasFlag("--dry-run");
  const maxJobsProvided = hasArgValue("--max-jobs");
  const maxJobs = safeNumber(getArgValue("--max-jobs", ""), NaN);
  const preset = resolveSubjectPreset(getArgValue("--subject", "chinese"));
  if (!preset) {
    console.log(JSON.stringify({
      ok: false,
      stage: "input_check",
      error: "Unsupported observation subject. Use chinese, math, or natural.",
    }, null, 2));
    process.exit(2);
  }

  const grade = getArgValue("--grade", preset.grade);
  const inputCheck = assertObservationInputSafe(preset, grade, caseName);
  if (!inputCheck.ok) {
    console.log(JSON.stringify({
      ok: false,
      stage: "input_check",
      error: "Observation input text failed UTF-8 safety check.",
      failures: inputCheck.failures,
    }, null, 2));
    process.exit(2);
  }

  const payload = buildPayload(itemCount, preset, grade, caseName);
  const expectedSlotSummary = summarizeExpectedSlots(payload.intents);
  const observationPlan = buildObservationPlan({
    payload,
    caseName,
    itemCount,
    expectedSlotSummary,
  });

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      paidApiCall: false,
      warning: "Dry run only. No production API or Gemini API call was made.",
      inputCheck,
      ...observationPlan,
      apiBaseUrl,
    }, null, 2));
    return;
  }

  const guard = createPaidApiGuardResult({
    dryRun,
    caseName,
    maxJobsProvided,
    maxJobs,
    plannedJobs: observationPlan.plannedJobs,
  });
  if (!guard.ok) {
    console.error(JSON.stringify({
      ok: false,
      stage: "paid_api_guard",
      error: guard.error,
      missing: guard.missing || [],
      paidApiCall: false,
      warning: "This observation script can create production generation jobs and incur Gemini API costs.",
      inputCheck,
      ...observationPlan,
    }, null, 2));
    process.exit(2);
  }

  console.error(JSON.stringify({
    event: "paid_api_warning",
    warning: "This operation will create production generation job(s) and incur Gemini API costs.",
    requiredFlags: ["--allow-paid-api", "--max-jobs"],
    ...(caseName === "mixed44-ui" ? { largeSmokeConfirmed: true } : {}),
    ...observationPlan,
    apiBaseUrl,
  }, null, 2));

  const reportedRequestedItemCount = expectedSlotSummary.expectedItemCount || itemCount;
  const started = Date.now();

  const create = await requestJson(apiBaseUrl, "/generation-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (create.response.status !== 202 || !create.data?.ok || !create.data?.jobId) {
    console.log(JSON.stringify({
      ok: false,
      stage: "create",
      httpStatus: create.response.status,
      errorCode: create.data?.errorCode || null,
      error: create.data?.error || "create failed",
    }, null, 2));
    return;
  }

  const jobId = create.data.jobId;
  console.log(JSON.stringify({
    event: "created",
    jobId,
    inputCheck,
    caseName,
    requestedItemCount: reportedRequestedItemCount,
    ...expectedSlotSummary,
    batchSize: create.data.batchSize,
    batchCount: create.data.batchCount,
  }));

  const snapshots = [];
  let statusData = null;
  let pollCount = 0;
  while (Date.now() - started < timeoutMs) {
    await sleep(pollIntervalMs);
    pollCount += 1;
    const status = await requestJson(apiBaseUrl, `/generation-jobs/${encodeURIComponent(jobId)}`);
    statusData = status.data;
    const elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(2));
    const snapshot = { elapsedSeconds, ...summarizeProgress(statusData) };
    if (pollCount % 5 === 0 || TERMINAL_STATUSES.has(statusData?.status)) {
      snapshots.push(snapshot);
      console.log(JSON.stringify({ event: "progress", ...snapshot }));
    }
    if (TERMINAL_STATUSES.has(statusData?.status)) break;
  }

  const latencySeconds = Number(((Date.now() - started) / 1000).toFixed(2));
  if (!SUCCESS_LIKE_TERMINAL_STATUSES.has(statusData?.status)) {
    console.log(JSON.stringify({
      ok: false,
      terminalStatus: statusData?.status || "timeout_waiting_status",
      jobId,
      latencySeconds,
      pollCount,
      requestedItemCount: reportedRequestedItemCount,
      ...expectedSlotSummary,
    ...summarizeProgress(statusData),
      snapshots,
    }, null, 2));
    return;
  }

  const result = await requestJson(apiBaseUrl, `/generation-jobs/${encodeURIComponent(jobId)}/result`);
  const resultOk = result.response.status === 200 && result.data?.ok && Array.isArray(result.data?.items);
  const items = normalizeGeneratedItems(resultOk ? result.data.items : []);
  const partialSummary = statusData?.status === "partial"
    ? summarizePartialResult(result.data, statusData)
    : { partial: false };
  const validation = validateGeneratedPaper({
    slots: payload.intents,
    objectives: payload.objectives,
    items,
    qualityMode: "v2",
  });
  const leakage = detectLeakage(items);
  const qualityMetaPresentCount = items.filter((item) => hasPlainObject(item?.qualityMeta)).length;
  const qualityMetaMissingCount = items.length - qualityMetaPresentCount;

  console.log(JSON.stringify({
    ok: true,
    timestampUtc: new Date(started).toISOString(),
    jobId,
    terminalStatus: statusData.status,
    latencySeconds,
    pollCount,
    requestedItemCount: reportedRequestedItemCount,
    ...expectedSlotSummary,
    batchSize: statusData.batchSize ?? create.data.batchSize,
    batchCount: statusData.batchCount ?? create.data.batchCount,
    completedBatchCount: statusData.completedBatchCount,
    completedItemCount: statusData.completedItemCount,
    resultHttpStatus: result.response.status,
    resultOk: Boolean(resultOk),
    generatedItemCount: items.length,
    partial: partialSummary.partial,
    ...(partialSummary.partial ? {
      missingItemCount: partialSummary.missingItemCount,
      missingItemIndexes: partialSummary.missingItemIndexes,
      failedBatchNumbers: partialSummary.failedBatchNumbers,
      missingErrorCodeCounts: partialSummary.missingErrorCodeCounts,
    } : {}),
    parseResult: resultOk ? "success" : "fail",
    v2Validation: validation.ok ? "pass" : "fail",
    validationErrorCount: validation.errors.length,
    validationWarningCount: validation.warnings.length,
    validationErrors: validation.errors.slice(0, 8),
    qualityMetaPresentCount,
    qualityMetaMissingCount,
    leakageFinding: leakage.length ? leakage.join(",") : "none",
    ...estimateQualityMetaStats(items),
    inputCheck,
    finalBatchSummary: summarizeBatches(statusData.batches || []),
    snapshots,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    stage: "script",
    error: error?.message || String(error),
  }, null, 2));
  process.exit(1);
});
