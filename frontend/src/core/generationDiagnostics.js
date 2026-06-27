const MAX_SAFE_TEXT_LENGTH = 200;
const MAX_SAFE_CODE_LENGTH = 80;

const SAFE_JSON_FIELDS = ["error", "message", "errorCode", "requestId", "jobId"];
const CODE_SAFE_SERIALIZED_FIELDS = new Set([
  "phase",
  "phaseLabel",
  "endpointPath",
  "errorCode",
  "requestId",
  "jobId",
  "timestamp",
  "advice",
]);
const SENSITIVE_TEXT_PATTERN = /prompt|payload|materialText|objectives|intents|items|question|answer|generated|subject|grade|schoolName|teacherName|range|題幹|答案|教材|學習目標/i;

export const GENERATION_FAILURE_PHASE_LABELS = {
  create: "建立工作",
  poll: "查詢進度",
  result: "取得結果",
  generate: "直接生成",
  request: "請求",
  unknown: "未知階段",
};

function safeString(value, maxLength = MAX_SAFE_CODE_LENGTH) {
  if (value === undefined || value === null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function safeBodyText(value) {
  const text = safeString(value, MAX_SAFE_TEXT_LENGTH);
  if (!text) return "";
  if (SENSITIVE_TEXT_PATTERN.test(text)) {
    return "[response text omitted: may contain request or generated content]";
  }
  return text;
}

export function sanitizeEndpointPath(value) {
  const text = safeString(value, 400);
  if (!text) return "";
  try {
    const url = new URL(text, "https://example.invalid");
    return url.pathname || "/";
  } catch {
    const path = text.split("?")[0].split("#")[0];
    return path.startsWith("/") ? path : `/${path}`;
  }
}

function pickSafeJsonField(body, field) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  if (!Object.prototype.hasOwnProperty.call(body, field)) return "";
  if (!["string", "number", "boolean"].includes(typeof body[field])) return "";
  return field === "error" || field === "message"
    ? safeBodyText(body[field])
    : safeString(body[field]);
}

export function extractHttpErrorDetails(response, responseBody = {}) {
  const json = responseBody?.json && typeof responseBody.json === "object" ? responseBody.json : null;
  const text = responseBody?.text || "";
  const requestId = pickSafeJsonField(json, "requestId")
    || safeString(response?.headers?.get?.("x-request-id"))
    || safeString(response?.headers?.get?.("cf-ray"));
  const errorMessage = pickSafeJsonField(json, "message")
    || pickSafeJsonField(json, "error")
    || safeBodyText(text);

  return {
    httpStatus: Number.isFinite(Number(response?.status)) ? Number(response.status) : undefined,
    errorCode: pickSafeJsonField(json, "errorCode"),
    errorMessage,
    requestId,
    jobId: pickSafeJsonField(json, "jobId"),
  };
}

function inferRetryable(details) {
  if (details.isAbort || details.isNetworkError || details.isCorsLike) return true;
  const status = Number(details.httpStatus);
  if (!Number.isFinite(status)) return false;
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function inferAdvice(details) {
  if (details.isAbort) return "逾時或請求中止，請稍後查詢結果或重試。";
  if (details.isNetworkError || details.isCorsLike) return "請確認網路連線，或稍後再試。";
  const status = Number(details.httpStatus);
  if (status >= 400 && status < 500) return "請檢查輸入條件後再試。";
  if (status >= 500) return "請回報管理者並附上診斷資訊。";
  return "請稍後再試；若持續發生，請回報管理者。";
}

export function buildSafeGenerationFailureDetails({
  phase = "unknown",
  endpointPath = "",
  httpStatus,
  errorCode = "",
  errorMessage = "",
  requestId = "",
  jobId = "",
  timestamp,
  isNetworkError = false,
  isAbort = false,
  isCorsLike = false,
  retryable,
} = {}) {
  const details = {
    phase: safeString(phase) || "unknown",
    phaseLabel: GENERATION_FAILURE_PHASE_LABELS[phase] || GENERATION_FAILURE_PHASE_LABELS.unknown,
    endpointPath: sanitizeEndpointPath(endpointPath),
    httpStatus: Number.isFinite(Number(httpStatus)) ? Number(httpStatus) : undefined,
    errorCode: safeString(errorCode),
    errorMessage: safeBodyText(errorMessage),
    requestId: safeString(requestId),
    jobId: safeString(jobId),
    timestamp: timestamp || new Date().toISOString(),
    isNetworkError: Boolean(isNetworkError),
    isAbort: Boolean(isAbort),
    isCorsLike: Boolean(isCorsLike),
  };
  details.retryable = retryable === undefined ? inferRetryable(details) : Boolean(retryable);
  details.advice = inferAdvice(details);
  return details;
}

export function normalizeGenerationError(error, context = {}) {
  const message = error?.message || error?.error || error?.errorMessage || String(error || "");
  const isAbort = Boolean(context.isAbort || error?.name === "AbortError" || error?.errorCode === "CLIENT_TIMEOUT");
  const isNetworkError = Boolean(context.isNetworkError || (!isAbort && message));
  const isCorsLike = Boolean(context.isCorsLike || (isNetworkError && /failed to fetch|networkerror|load failed|cors/i.test(message)));

  return buildSafeGenerationFailureDetails({
    ...context,
    errorCode: context.errorCode || error?.errorCode || (isAbort ? "CLIENT_TIMEOUT" : ""),
    errorMessage: context.errorMessage || message,
    isAbort,
    isNetworkError,
    isCorsLike,
  });
}

export function getGenerationFailureDisplayRows(details = {}) {
  return [
    ["階段", details.phaseLabel || GENERATION_FAILURE_PHASE_LABELS.unknown],
    ["Phase", details.phase || "unknown"],
    ["HTTP 狀態", details.httpStatus ?? ""],
    ["錯誤代碼", details.errorCode || ""],
    ["錯誤訊息", details.errorMessage || ""],
    ["Request ID", details.requestId || ""],
    ["Job ID", details.jobId || ""],
    ["時間", details.timestamp || ""],
    ["Endpoint", details.endpointPath || ""],
    ["Network error", details.isNetworkError ? "yes" : "no"],
    ["Abort / timeout", details.isAbort ? "yes" : "no"],
    ["CORS-like", details.isCorsLike ? "yes" : "no"],
    ["Retryable", details.retryable ? "yes" : "no"],
    ["建議處理", details.advice || ""],
  ].filter(([, value]) => value !== "" && value !== undefined && value !== null);
}

export function serializeGenerationFailureDetails(details = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string" && key === "endpointPath") safe[key] = sanitizeEndpointPath(value);
    else if (typeof value === "string" && CODE_SAFE_SERIALIZED_FIELDS.has(key)) safe[key] = safeString(value, MAX_SAFE_TEXT_LENGTH);
    else if (typeof value === "string") safe[key] = safeBodyText(value);
    else if (typeof value === "number" || typeof value === "boolean") safe[key] = value;
  }
  return JSON.stringify(safe, null, 2);
}
