import { ERROR_CODES } from "./json.js";

export const DEFAULT_GEMINI_TIMEOUT_MS = 300000;

export function resolveGeminiTimeoutMs(env = {}) {
  const configuredTimeout = Number(env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_GEMINI_TIMEOUT_MS;
}

export async function callGemini({ env, prompt, files = [] }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "後端 AI 服務尚未完成設定。",
      errorCode: ERROR_CODES.GEMINI_UPSTREAM_ERROR,
    };
  }

  const apiVersion = env.GEMINI_API_VERSION || "v1beta";
  const model = env.GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

  const fileParts = (Array.isArray(files) ? files : [])
    .filter((file) => file && typeof file.data === "string" && file.data.trim())
    .map((file) => ({
      inlineData: {
        mimeType: file.mimeType || "application/pdf",
        data: file.data,
      },
    }));

  // 受控逾時：保留上限避免請求卡死，但預設對齊前端 5 分鐘等待，
  // 避免模型仍在生成時被 Worker 90 秒過早中止。
  const timeoutMs = resolveGeminiTimeoutMs(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, ...fileParts],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          // 設足夠大的輸出上限，避免整卷（尤其國語題組長文）被截斷成壞 JSON。
          maxOutputTokens: Number(env.GEMINI_MAX_OUTPUT_TOKENS) || 32768,
        },
      }),
    });
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        error: "AI 生成逾時，題目較多時請稍候再重試一次（或減少題數／分批生成）。",
        errorCode: ERROR_CODES.GEMINI_TIMEOUT,
      };
    }
    return {
      ok: false,
      status: 502,
      error: "AI 服務暫時無法連線，請稍後再試。",
      errorCode: ERROR_CODES.GEMINI_UPSTREAM_ERROR,
    };
  }
  clearTimeout(timer);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: "Gemini API 呼叫失敗。請檢查 API key、模型名稱、版本與額度。",
      errorCode: ERROR_CODES.GEMINI_UPSTREAM_ERROR,
    };
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";

  if (!text.trim()) {
    return {
      ok: false,
      status: 502,
      error: "Gemini 回應為空。",
      errorCode: ERROR_CODES.AI_EMPTY_RESPONSE,
    };
  }

  return { ok: true, text };
}
