const RETRYABLE_ERROR_CODES = new Set([
  "GEMINI_UPSTREAM_ERROR",
  "AI_EMPTY_RESPONSE",
]);

const NON_RETRYABLE_ERROR_CODES = new Set([
  "CLIENT_TIMEOUT",
  "GEMINI_TIMEOUT",
  "AI_JSON_PARSE_FAILED",
  "AI_ITEMS_PAYLOAD_INVALID",
  "AI_QUALITY_META_MISSING",
  "AI_OUTPUT_CONTRACT_INVALID",
  "REQUEST_INVALID",
]);

function normalizeText(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value || "");
}

export function isRetryableGenerationFailure(result) {
  if (!result || result.ok) return false;

  const errorCode = String(result.errorCode || "").trim();
  if (RETRYABLE_ERROR_CODES.has(errorCode)) return true;
  if (NON_RETRYABLE_ERROR_CODES.has(errorCode)) return false;

  const text = normalizeText(result.error).toLowerCase();
  if (/\b(502|503)\b/.test(text)) return true;
  if (/\bnetwork\b|\bfetch\b|暫時無法連線/.test(text)) return true;
  return false;
}

export function shouldRetryGeneration({ result, attempt, maxAttempts = 2 } = {}) {
  const currentAttempt = Math.max(1, Number(attempt) || 1);
  const allowedAttempts = Math.max(1, Number(maxAttempts) || 1);
  return currentAttempt < allowedAttempts && isRetryableGenerationFailure(result);
}
