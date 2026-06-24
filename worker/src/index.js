import { buildExtractObjectivesPrompt, buildGenerateItemsPrompt, buildNormalizeObjectivesPrompt, buildRegenerateItemPrompt } from "./prompts.js";
import { callGemini } from "./gemini.js";
import { ERROR_CODES, assertItemsPayload, assertObjectivesPayload, extractJsonObject, readJson, safeErrorPayload } from "./json.js";
import { handleOptions, jsonResponse } from "./cors.js";
import { routeGenerationJobRequest } from "./generationJobs.js";

function errorResponse(request, env, result, status) {
  return jsonResponse(request, env, safeErrorPayload(result), status);
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
