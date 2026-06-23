export const ERROR_CODES = Object.freeze({
  REQUEST_INVALID: "REQUEST_INVALID",
  NOT_FOUND: "NOT_FOUND",
  GEMINI_UPSTREAM_ERROR: "GEMINI_UPSTREAM_ERROR",
  GEMINI_TIMEOUT: "GEMINI_TIMEOUT",
  AI_EMPTY_RESPONSE: "AI_EMPTY_RESPONSE",
  AI_JSON_PARSE_FAILED: "AI_JSON_PARSE_FAILED",
  AI_ITEMS_PAYLOAD_INVALID: "AI_ITEMS_PAYLOAD_INVALID",
  AI_QUALITY_META_MISSING: "AI_QUALITY_META_MISSING",
  AI_OUTPUT_CONTRACT_INVALID: "AI_OUTPUT_CONTRACT_INVALID",
});

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.REQUEST_INVALID]: "請確認輸入內容後再試一次。",
  [ERROR_CODES.NOT_FOUND]: "找不到指定的服務端點。",
  [ERROR_CODES.GEMINI_UPSTREAM_ERROR]: "AI 服務暫時無法完成請求，請稍後再試。",
  [ERROR_CODES.GEMINI_TIMEOUT]: "AI 生成逾時，請稍後再試或減少題數。",
  [ERROR_CODES.AI_EMPTY_RESPONSE]: "AI 回應為空，請稍後再試。",
  [ERROR_CODES.AI_JSON_PARSE_FAILED]: "AI 回應不是可解析的題目 JSON。",
  [ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID]: "AI 回應缺少有效的題目陣列。",
  [ERROR_CODES.AI_QUALITY_META_MISSING]: "AI 回應缺少必要的 qualityMeta 欄位。",
  [ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID]: "AI 回應不符合必要輸出契約。",
});

const SENSITIVE_ERROR_PATTERN = /raw\s*(prompt|output)|api[_\s-]*key|x-goog-api-key|token|headers?|authorization|bearer|cookie|stack\s*trace|traceback/i;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwnField(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeMessage(error, errorCode) {
  const fallback = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID];
  const text = String(error || "").trim();
  if (!text || text.length > 240 || SENSITIVE_ERROR_PATTERN.test(text)) return fallback;
  return text;
}

export function safeErrorPayload({ error, errorCode }) {
  const code = ERROR_MESSAGES[errorCode] ? errorCode : ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID;
  return { ok: false, error: safeMessage(error, code), errorCode: code };
}

export async function readJson(request) {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, error: "請求內容不是合法 JSON。", errorCode: ERROR_CODES.REQUEST_INVALID };
  }
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const withoutFence = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return { ok: true, data: JSON.parse(withoutFence) };
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return { ok: false, error: "AI 回應中找不到 JSON 物件。", errorCode: ERROR_CODES.AI_JSON_PARSE_FAILED };
    }

    try {
      return { ok: true, data: JSON.parse(withoutFence.slice(start, end + 1)) };
    } catch {
      return { ok: false, error: "AI 回應不是合法 JSON。", errorCode: ERROR_CODES.AI_JSON_PARSE_FAILED };
    }
  }
}

export function assertObjectivesPayload(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.objectives)) {
    return { ok: false, error: "AI 回應缺少 objectives 陣列。", errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID };
  }

  if (payload.objectives.length === 0) {
    return { ok: false, error: "AI 未萃取到任何學習目標。", errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID };
  }

  return { ok: true, objectives: payload.objectives };
}

function assertQualityMeta(item, index) {
  if (!isPlainObject(item)) {
    return {
      ok: false,
      error: `AI 回應第 ${index + 1} 題不是有效物件。`,
      errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    };
  }

  const qualityMeta = item.qualityMeta;
  if (!isPlainObject(qualityMeta)) {
    return {
      ok: false,
      error: `AI 回應第 ${index + 1} 題缺少 qualityMeta。`,
      errorCode: ERROR_CODES.AI_QUALITY_META_MISSING,
    };
  }

  if (!hasOwnField(qualityMeta, "teacherExplanation") || !hasText(qualityMeta.teacherExplanation)) {
    return {
      ok: false,
      error: `AI 回應第 ${index + 1} 題缺少 qualityMeta.teacherExplanation。`,
      errorCode: ERROR_CODES.AI_QUALITY_META_MISSING,
    };
  }

  if (!hasOwnField(qualityMeta, "correctReason") || !hasText(qualityMeta.correctReason)) {
    return {
      ok: false,
      error: `AI 回應第 ${index + 1} 題缺少 qualityMeta.correctReason。`,
      errorCode: ERROR_CODES.AI_QUALITY_META_MISSING,
    };
  }

  if (!isPlainObject(qualityMeta.distractorDesign)) {
    return {
      ok: false,
      error: `AI 回應第 ${index + 1} 題缺少 qualityMeta.distractorDesign。`,
      errorCode: ERROR_CODES.AI_QUALITY_META_MISSING,
    };
  }

  if (!isPlainObject(qualityMeta.selfCheck)) {
    return {
      ok: false,
      error: `AI 回應第 ${index + 1} 題缺少 qualityMeta.selfCheck。`,
      errorCode: ERROR_CODES.AI_QUALITY_META_MISSING,
    };
  }

  return { ok: true };
}

export function assertItemsPayload(payload, expectedCount = null) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.items)) {
    return { ok: false, error: "AI 回應缺少 items 陣列。", errorCode: ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID };
  }

  if (expectedCount !== null && payload.items.length !== expectedCount) {
    return {
      ok: false,
      error: `AI 回應題數 ${payload.items.length} 不等於預期 ${expectedCount}。`,
      errorCode: ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID,
    };
  }

  for (let index = 0; index < payload.items.length; index += 1) {
    const qualityMeta = assertQualityMeta(payload.items[index], index);
    if (!qualityMeta.ok) return qualityMeta;
  }

  return { ok: true, items: payload.items };
}
