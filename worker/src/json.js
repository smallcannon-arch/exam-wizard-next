export const ERROR_CODES = Object.freeze({
  REQUEST_INVALID: "REQUEST_INVALID",
  NOT_FOUND: "NOT_FOUND",
  GEMINI_UPSTREAM_ERROR: "GEMINI_UPSTREAM_ERROR",
  GEMINI_RATE_LIMIT: "GEMINI_RATE_LIMIT",
  GEMINI_UPSTREAM_SERVER_ERROR: "GEMINI_UPSTREAM_SERVER_ERROR",
  GEMINI_NETWORK_ERROR: "GEMINI_NETWORK_ERROR",
  GEMINI_UPSTREAM_REQUEST_ERROR: "GEMINI_UPSTREAM_REQUEST_ERROR",
  GEMINI_TIMEOUT: "GEMINI_TIMEOUT",
  AI_EMPTY_RESPONSE: "AI_EMPTY_RESPONSE",
  AI_JSON_NO_OBJECT: "AI_JSON_NO_OBJECT",
  AI_JSON_PARSE_FAILED: "AI_JSON_PARSE_FAILED",
  AI_JSON_TRUNCATED: "AI_JSON_TRUNCATED",
  AI_ITEMS_PAYLOAD_INVALID: "AI_ITEMS_PAYLOAD_INVALID",
  AI_QUALITY_META_MISSING: "AI_QUALITY_META_MISSING",
  AI_ITEM_TEXT_MISSING: "AI_ITEM_TEXT_MISSING",
  AI_STIMULUS_MISSING: "AI_STIMULUS_MISSING",
  AI_OUTPUT_CONTRACT_INVALID: "AI_OUTPUT_CONTRACT_INVALID",
  ASYNC_JOB_UNAVAILABLE: "ASYNC_JOB_UNAVAILABLE",
  ASYNC_JOB_NOT_FOUND: "ASYNC_JOB_NOT_FOUND",
  ASYNC_JOB_STATUS_INVALID: "ASYNC_JOB_STATUS_INVALID",
  ASYNC_JOB_RESULT_UNAVAILABLE: "ASYNC_JOB_RESULT_UNAVAILABLE",
  ASYNC_JOB_RESULT_INVALID: "ASYNC_JOB_RESULT_INVALID",
  ASYNC_BATCH_UNSUPPORTED: "ASYNC_BATCH_UNSUPPORTED",
});

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.REQUEST_INVALID]: "請確認輸入內容後再試一次。",
  [ERROR_CODES.NOT_FOUND]: "找不到指定的服務端點。",
  [ERROR_CODES.GEMINI_UPSTREAM_ERROR]: "AI 服務暫時無法完成請求，請稍後再試。",
  [ERROR_CODES.GEMINI_RATE_LIMIT]: "AI 服務目前流量較高，請稍後再試。",
  [ERROR_CODES.GEMINI_UPSTREAM_SERVER_ERROR]: "AI 服務暫時無法完成請求，請稍後再試。",
  [ERROR_CODES.GEMINI_NETWORK_ERROR]: "AI 服務連線暫時失敗，請稍後再試。",
  [ERROR_CODES.GEMINI_UPSTREAM_REQUEST_ERROR]: "AI 服務拒絕本次請求，請調整命題設定後再試。",
  [ERROR_CODES.GEMINI_TIMEOUT]: "AI 生成逾時，請稍後再試或減少題數。",
  [ERROR_CODES.AI_EMPTY_RESPONSE]: "AI 回應為空，請稍後再試。",
  [ERROR_CODES.AI_JSON_PARSE_FAILED]: "AI 回應不是可解析的題目 JSON。",
  [ERROR_CODES.AI_ITEMS_PAYLOAD_INVALID]: "AI 回應缺少有效的題目陣列。",
  [ERROR_CODES.AI_QUALITY_META_MISSING]: "AI 回應缺少必要的 qualityMeta 欄位。",
  [ERROR_CODES.AI_ITEM_TEXT_MISSING]: "AI response item is missing question text.",
  [ERROR_CODES.AI_STIMULUS_MISSING]: "AI response item references reading text but is missing stimulus.",
  [ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID]: "AI 回應不符合必要輸出契約。",
  [ERROR_CODES.AI_JSON_NO_OBJECT]: "AI response did not contain a JSON object.",
  [ERROR_CODES.AI_JSON_TRUNCATED]: "AI response appears to be truncated before valid JSON was completed.",
  [ERROR_CODES.ASYNC_JOB_UNAVAILABLE]: "Async generation job service is not available.",
  [ERROR_CODES.ASYNC_JOB_NOT_FOUND]: "Async generation job was not found.",
  [ERROR_CODES.ASYNC_JOB_STATUS_INVALID]: "Async generation job status is invalid.",
  [ERROR_CODES.ASYNC_JOB_RESULT_UNAVAILABLE]: "Async generation job result is not ready.",
  [ERROR_CODES.ASYNC_JOB_RESULT_INVALID]: "Async generation job result is invalid.",
  [ERROR_CODES.ASYNC_BATCH_UNSUPPORTED]: "Async generation currently supports one batch only.",
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

const ITEM_TEXT_FIELDS = ["question", "stem", "prompt", "problem", "questionText", "itemText", "text"];
const OPTION_CODES = ["A", "B", "C", "D"];
export const CONTRACT_VIOLATION_TYPES = Object.freeze({
  OPTIONS_COUNT_INVALID: "OPTIONS_COUNT_INVALID",
  OPTIONS_TEXT_INVALID: "OPTIONS_TEXT_INVALID",
  ANSWER_CODE_INVALID: "ANSWER_CODE_INVALID",
  DISTRACTOR_KEY_INVALID: "DISTRACTOR_KEY_INVALID",
  DISTRACTOR_CORRECT_ANSWER_INCLUDED: "DISTRACTOR_CORRECT_ANSWER_INCLUDED",
  DISTRACTOR_MISSING_WRONG_OPTION: "DISTRACTOR_MISSING_WRONG_OPTION",
  DISTRACTOR_REQUIRED_FIELD_MISSING: "DISTRACTOR_REQUIRED_FIELD_MISSING",
});

const QUALITY_META_DISTRACTOR_REQUIRED_FIELDS = [
  "misconceptionTag",
  "misconceptionDescription",
  "whyStudentsMayChooseIt",
  "whyItIsWrong",
  "revisionNote",
];
const STIMULUS_REFERENCE_TERMS = [
  "根據這段文字",
  "根據本文",
  "根據上文",
  "依據本文",
  "依據上文",
  "閱讀本文",
  "讀完本文",
  "這段文字",
  "上文中",
  "本文",
  "上文",
];

function normalizeAnswerKey(value) {
  const text = String(value || "").trim().toUpperCase().replace(/[()\s.]/g, "");
  return OPTION_CODES.includes(text) ? text : "";
}

function safeOptionCode(value) {
  const text = String(value || "").trim().toUpperCase().replace(/[()\s.]/g, "");
  if (OPTION_CODES.includes(text)) return text;
  return /^[A-Z]$/.test(text) ? text : "OTHER";
}

function optionCodeForCountDrift(optionCount) {
  const count = Number(optionCount);
  if (!Number.isInteger(count) || count < 0) return null;
  const index = count > OPTION_CODES.length ? OPTION_CODES.length : count;
  if (index < 0 || index >= 26) return "OTHER";
  return String.fromCharCode(65 + index);
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

function normalizeFinishReason(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{1,64}$/.test(text) ? text : "";
}

function buildJsonDiagnostics(raw, candidate, metadata = {}) {
  const finishReason = normalizeFinishReason(metadata.finishReason);
  return {
    finishReason: finishReason || null,
    outputLength: raw.length,
    jsonCandidateLength: candidate.length,
    startsWithBrace: candidate.startsWith("{"),
    endsWithBrace: candidate.endsWith("}"),
    hasOpeningBrace: candidate.includes("{"),
    hasClosingBrace: candidate.includes("}"),
  };
}

function jsonError({ error, errorCode, diagnostics, classificationSource = "parser" }) {
  return {
    ok: false,
    error,
    errorCode,
    diagnostics: {
      ...diagnostics,
      classificationSource,
    },
  };
}

export function extractJsonObject(text, metadata = {}) {
  const raw = String(text || "").trim();
  const withoutFence = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const diagnostics = buildJsonDiagnostics(raw, withoutFence, metadata);
  const isHardTruncated = diagnostics.finishReason === "MAX_TOKENS";

  try {
    return {
      ok: true,
      data: JSON.parse(withoutFence),
      diagnostics: {
        ...diagnostics,
        classificationSource: "none",
      },
    };
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) {
      if (isHardTruncated) {
        return jsonError({
          error: "AI response ended before JSON was complete.",
          errorCode: ERROR_CODES.AI_JSON_TRUNCATED,
          diagnostics,
          classificationSource: "finish_reason",
        });
      }

      return jsonError({
        error: "AI response did not contain a JSON object.",
        errorCode: ERROR_CODES.AI_JSON_NO_OBJECT,
        diagnostics,
      });
    }

    try {
      return {
        ok: true,
        data: JSON.parse(withoutFence.slice(start, end + 1)),
        diagnostics: {
          ...diagnostics,
          classificationSource: "none",
        },
      };
    } catch {
      if (isHardTruncated) {
        return jsonError({
          error: "AI response ended before JSON was complete.",
          errorCode: ERROR_CODES.AI_JSON_TRUNCATED,
          diagnostics,
          classificationSource: "finish_reason",
        });
      }

      return jsonError({
        error: "AI response was not valid JSON.",
        errorCode: ERROR_CODES.AI_JSON_PARSE_FAILED,
        diagnostics,
      });
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

function contractViolation(type, index, details = {}) {
  return {
    type,
    types: [type],
    itemIndex: index + 1,
    ...details,
  };
}

function outputContractError(index, reason, violation) {
  return {
    ok: false,
    error: `AI response item ${index + 1} has invalid option contract: ${reason}.`,
    errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    contractViolation: violation || contractViolation(CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID, index, {
      field: "options",
    }),
  };
}

function assertChoiceOptionContract(item, index) {
  if (!Array.isArray(item?.options)) return { ok: true };

  if (item.options.length !== OPTION_CODES.length) {
    return outputContractError(index, "options must contain exactly A/B/C/D", contractViolation(
      CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID,
      index,
      { field: "options", optionCode: optionCodeForCountDrift(item.options.length) },
    ));
  }

  if (item.options.some((option) => !hasText(option))) {
    return outputContractError(index, "options must be non-empty text", contractViolation(
      CONTRACT_VIOLATION_TYPES.OPTIONS_TEXT_INVALID,
      index,
      { field: "options" },
    ));
  }

  const answerKey = normalizeAnswerKey(item.answer);
  if (!answerKey) {
    return outputContractError(index, "answer must be A/B/C/D", contractViolation(
      CONTRACT_VIOLATION_TYPES.ANSWER_CODE_INVALID,
      index,
      { field: "answer", optionCode: safeOptionCode(item.answer) },
    ));
  }

  const qualityMeta = item.qualityMeta;
  const distractorDesign = isPlainObject(qualityMeta?.distractorDesign)
    ? qualityMeta.distractorDesign
    : {};
  const normalizedDistractorDesign = new Map();

  for (const key of Object.keys(distractorDesign)) {
    const normalizedKey = normalizeAnswerKey(key);
    if (!normalizedKey) {
      return outputContractError(index, "distractorDesign keys must be A/B/C/D option codes", contractViolation(
        CONTRACT_VIOLATION_TYPES.DISTRACTOR_KEY_INVALID,
        index,
        { field: "qualityMeta.distractorDesign", optionCode: safeOptionCode(key) },
      ));
    }
    if (normalizedKey === answerKey) {
      return outputContractError(index, "distractorDesign must not include the correct answer", contractViolation(
        CONTRACT_VIOLATION_TYPES.DISTRACTOR_CORRECT_ANSWER_INCLUDED,
        index,
        { field: "qualityMeta.distractorDesign", optionCode: normalizedKey },
      ));
    }
    normalizedDistractorDesign.set(normalizedKey, distractorDesign[key]);
  }

  for (const key of OPTION_CODES) {
    if (key === answerKey) continue;
    const design = normalizedDistractorDesign.get(key);
    if (!isPlainObject(design)) {
      return outputContractError(index, `distractorDesign is missing wrong option ${key}`, contractViolation(
        CONTRACT_VIOLATION_TYPES.DISTRACTOR_MISSING_WRONG_OPTION,
        index,
        { field: "qualityMeta.distractorDesign", optionCode: key },
      ));
    }
    for (const field of QUALITY_META_DISTRACTOR_REQUIRED_FIELDS) {
      if (!hasText(design[field])) {
        return outputContractError(index, `distractorDesign ${key} is missing ${field}`, contractViolation(
          CONTRACT_VIOLATION_TYPES.DISTRACTOR_REQUIRED_FIELD_MISSING,
          index,
          { field, optionCode: key },
        ));
      }
    }
  }

  return { ok: true };
}

function assertItemText(item, index) {
  if (!isPlainObject(item)) {
    return {
      ok: false,
      error: `AI response item ${index + 1} is not an object.`,
      errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    };
  }

  const hasQuestionText = ITEM_TEXT_FIELDS.some((field) => hasText(item[field]));
  if (!hasQuestionText) {
    return {
      ok: false,
      error: `AI response item ${index + 1} is missing question text.`,
      errorCode: ERROR_CODES.AI_ITEM_TEXT_MISSING,
    };
  }

  return { ok: true };
}

function referencesStimulusText(value) {
  const text = String(value || "");
  return STIMULUS_REFERENCE_TERMS.some((term) => text.includes(term));
}

function assertStimulusContract(item, index) {
  if (!isPlainObject(item)) {
    return {
      ok: false,
      error: `AI response item ${index + 1} is not an object.`,
      errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    };
  }

  const questionType = String(item.questionType || "").trim();
  const needsStimulus = questionType === "閱讀測驗"
    || ITEM_TEXT_FIELDS.some((field) => referencesStimulusText(item[field]));

  if (needsStimulus && !hasText(item.stimulus)) {
    return {
      ok: false,
      error: `AI response item ${index + 1} references reading text but is missing stimulus.`,
      errorCode: ERROR_CODES.AI_STIMULUS_MISSING,
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
    const itemText = assertItemText(payload.items[index], index);
    if (!itemText.ok) return itemText;

    const stimulus = assertStimulusContract(payload.items[index], index);
    if (!stimulus.ok) return stimulus;

    const qualityMeta = assertQualityMeta(payload.items[index], index);
    if (!qualityMeta.ok) return qualityMeta;

    const choiceOptionContract = assertChoiceOptionContract(payload.items[index], index);
    if (!choiceOptionContract.ok) return choiceOptionContract;
  }

  return { ok: true, items: payload.items };
}
