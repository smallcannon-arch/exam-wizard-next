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
  QUESTION_TYPE_MISSING: "QUESTION_TYPE_MISSING",
  QUESTION_TYPE_MISMATCH: "QUESTION_TYPE_MISMATCH",
  OPTIONS_COUNT_INVALID: "OPTIONS_COUNT_INVALID",
  OPTIONS_TEXT_INVALID: "OPTIONS_TEXT_INVALID",
  ANSWER_CODE_INVALID: "ANSWER_CODE_INVALID",
  TRUE_FALSE_OPTIONS_INVALID: "TRUE_FALSE_OPTIONS_INVALID",
  TRUE_FALSE_ANSWER_INVALID: "TRUE_FALSE_ANSWER_INVALID",
  FILL_IN_OPTIONS_INVALID: "FILL_IN_OPTIONS_INVALID",
  FILL_IN_ANSWER_INVALID: "FILL_IN_ANSWER_INVALID",
  ACCEPTED_ANSWERS_INVALID: "ACCEPTED_ANSWERS_INVALID",
  DISTRACTOR_KEY_INVALID: "DISTRACTOR_KEY_INVALID",
  DISTRACTOR_CORRECT_ANSWER_INCLUDED: "DISTRACTOR_CORRECT_ANSWER_INCLUDED",
  DISTRACTOR_MISSING_WRONG_OPTION: "DISTRACTOR_MISSING_WRONG_OPTION",
  DISTRACTOR_REQUIRED_FIELD_MISSING: "DISTRACTOR_REQUIRED_FIELD_MISSING",
  GROUP_STIMULUS_INVALID: "GROUP_STIMULUS_INVALID",
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
const CHOICE_LIKE_QUESTION_TYPE_TERMS = ["選擇", "choice", "圖表", "判讀", "實驗", "探究"];
const GROUP_QUESTION_TYPE_TERMS = ["學力", "題組", "情境", "scenario", "group", "tasa", "proficiency", "閱讀測驗"];

function normalizeAnswerKey(value) {
  const text = String(value || "").trim().toUpperCase().replace(/[()\s.]/g, "");
  return OPTION_CODES.includes(text) ? text : "";
}

function normalizeTrueFalseAnswer(value) {
  const text = String(value || "").trim().toUpperCase().replace(/[()\s.]/g, "");
  if (["O", "X"].includes(text)) return text;
  return "";
}

function normalizeQuestionTypeContract(value = "") {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "";
  if (GROUP_QUESTION_TYPE_TERMS.some((term) => source.includes(term))) return "group";
  if (source.includes("是非") || source.includes("true_false") || source.includes("truefalse")) return "trueFalse";
  if (source.includes("填充") || source.includes("fill")) return "fill";
  if (CHOICE_LIKE_QUESTION_TYPE_TERMS.some((term) => source.includes(term))) return "choiceLike";
  return "";
}

function isExpectedGroupSlot(slot) {
  return normalizeQuestionTypeContract(slot?.questionType || slot?.itemType) === "group" || !!slot?.isGroup;
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
    error: `AI response item ${index + 1} has invalid output contract: ${reason}.`,
    errorCode: ERROR_CODES.AI_OUTPUT_CONTRACT_INVALID,
    contractViolation: violation || contractViolation(CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID, index, {
      field: "options",
    }),
  };
}

function assertRequestedQuestionType(item, slot, index) {
  const expected = normalizeQuestionTypeContract(slot.questionType || slot.itemType);
  if (!expected) {
    return outputContractError(index, "requested slot questionType is required for typed validation", contractViolation(
      CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISSING,
      index,
      { field: "questionType" },
    ));
  }
  const actual = normalizeQuestionTypeContract(item?.questionType);
  if (!actual || actual !== expected) {
    return outputContractError(index, "questionType must match the requested slot", contractViolation(
      CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH,
      index,
      { field: "questionType" },
    ));
  }
  return { ok: true };
}

function assertChoiceOptionContract(item, index, { requireOptions = false } = {}) {
  if (!Array.isArray(item?.options)) {
    if (!requireOptions) return { ok: true };
    return outputContractError(index, "choice-like items must include options", contractViolation(
      CONTRACT_VIOLATION_TYPES.OPTIONS_COUNT_INVALID,
      index,
      { field: "options", optionCode: null },
    ));
  }

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

function assertTrueFalseContract(item, index) {
  if (hasOwnField(item, "options")) {
    return outputContractError(index, "true/false items must omit options", contractViolation(
      CONTRACT_VIOLATION_TYPES.TRUE_FALSE_OPTIONS_INVALID,
      index,
      { field: "options" },
    ));
  }

  const answerKey = normalizeTrueFalseAnswer(item.answer);
  if (!answerKey) {
    return outputContractError(index, "true/false answer must be O or X", contractViolation(
      CONTRACT_VIOLATION_TYPES.TRUE_FALSE_ANSWER_INVALID,
      index,
      { field: "answer", optionCode: safeOptionCode(item.answer) },
    ));
  }

  if (hasOwnField(item, "correctAnswer")) {
    const correctAnswerKey = normalizeTrueFalseAnswer(item.correctAnswer);
    if (!correctAnswerKey || correctAnswerKey !== answerKey) {
      return outputContractError(index, "true/false correctAnswer must match answer", contractViolation(
        CONTRACT_VIOLATION_TYPES.TRUE_FALSE_ANSWER_INVALID,
        index,
        { field: "correctAnswer", optionCode: safeOptionCode(item.correctAnswer) },
      ));
    }
  }

  const distractorDesign = isPlainObject(item?.qualityMeta?.distractorDesign)
    ? item.qualityMeta.distractorDesign
    : {};
  for (const key of Object.keys(distractorDesign)) {
    const normalizedKey = normalizeTrueFalseAnswer(key);
    if (!normalizedKey || normalizedKey === answerKey) {
      return outputContractError(index, "true/false distractorDesign keys must only use the wrong O/X answer", contractViolation(
        normalizedKey === answerKey
          ? CONTRACT_VIOLATION_TYPES.DISTRACTOR_CORRECT_ANSWER_INCLUDED
          : CONTRACT_VIOLATION_TYPES.DISTRACTOR_KEY_INVALID,
        index,
        { field: "qualityMeta.distractorDesign", optionCode: safeOptionCode(key) },
      ));
    }
  }

  return { ok: true };
}

function assertFillInContract(item, index) {
  if (hasOwnField(item, "options")) {
    return outputContractError(index, "fill-in items must omit options", contractViolation(
      CONTRACT_VIOLATION_TYPES.FILL_IN_OPTIONS_INVALID,
      index,
      { field: "options" },
    ));
  }

  const answerText = typeof item?.answer === "string" ? item.answer.trim() : "";
  if (!answerText || normalizeAnswerKey(answerText) || normalizeTrueFalseAnswer(answerText)) {
    return outputContractError(index, "fill-in answer must be non-empty text", contractViolation(
      CONTRACT_VIOLATION_TYPES.FILL_IN_ANSWER_INVALID,
      index,
      { field: "answer", optionCode: safeOptionCode(answerText) },
    ));
  }

  if (hasOwnField(item, "acceptedAnswers")) {
    if (!Array.isArray(item.acceptedAnswers) || item.acceptedAnswers.some((entry) => !hasText(entry))) {
      return outputContractError(index, "acceptedAnswers must be non-empty text array", contractViolation(
        CONTRACT_VIOLATION_TYPES.ACCEPTED_ANSWERS_INVALID,
        index,
        { field: "acceptedAnswers" },
      ));
    }
  }

  return { ok: true };
}

function assertGroupContract(item, index) {
  const choice = assertChoiceOptionContract(item, index, { requireOptions: true });
  if (!choice.ok) return choice;

  if (!hasText(item.groupId)) {
    return outputContractError(index, "group items must include groupId", contractViolation(
      CONTRACT_VIOLATION_TYPES.GROUP_STIMULUS_INVALID,
      index,
      { field: "groupId" },
    ));
  }

  return { ok: true };
}

function assertTypedOutputContract(item, slot, index) {
  if (!slot) return assertChoiceOptionContract(item, index);

  const questionType = assertRequestedQuestionType(item, slot, index);
  if (!questionType.ok) return questionType;

  const contractType = normalizeQuestionTypeContract(slot.questionType || slot.itemType);
  if (contractType === "trueFalse") return assertTrueFalseContract(item, index);
  if (contractType === "fill") return assertFillInContract(item, index);
  if (isExpectedGroupSlot(slot)) return assertGroupContract(item, index);
  if (contractType === "choiceLike") return assertChoiceOptionContract(item, index, { requireOptions: true });

  return { ok: true };
}

function assertGroupStimulusContract(items, expectedSlots) {
  if (!Array.isArray(expectedSlots)) return { ok: true };
  const groups = new Map();
  for (let index = 0; index < items.length; index += 1) {
    const slot = expectedSlots[index];
    if (!isExpectedGroupSlot(slot)) continue;

    const item = items[index];
    const groupId = hasText(item?.groupId) ? String(item.groupId).trim() : `slot-${index + 1}`;
    const group = groups.get(groupId) || { firstIndex: index, hasStimulus: false };
    group.hasStimulus = group.hasStimulus || hasText(item?.stimulus);
    groups.set(groupId, group);
  }

  for (const group of groups.values()) {
    if (!group.hasStimulus) {
      return outputContractError(group.firstIndex, "group items must include at least one stimulus", contractViolation(
        CONTRACT_VIOLATION_TYPES.GROUP_STIMULUS_INVALID,
        group.firstIndex,
        { field: "stimulus" },
      ));
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

export function assertItemsPayload(payload, expectedCount = null, options = {}) {
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
    const expectedSlot = Array.isArray(options.expectedSlots) ? options.expectedSlots[index] : null;
    const itemText = assertItemText(payload.items[index], index);
    if (!itemText.ok) return itemText;

    const qualityMeta = assertQualityMeta(payload.items[index], index);
    if (!qualityMeta.ok) return qualityMeta;

    const outputContract = assertTypedOutputContract(
      payload.items[index],
      expectedSlot,
      index,
    );
    if (!outputContract.ok) return outputContract;

    if (!isExpectedGroupSlot(expectedSlot)) {
      const stimulus = assertStimulusContract(payload.items[index], index);
      if (!stimulus.ok) return stimulus;
    }
  }

  const groupStimulus = assertGroupStimulusContract(payload.items, options.expectedSlots);
  if (!groupStimulus.ok) return groupStimulus;

  return { ok: true, items: payload.items };
}
