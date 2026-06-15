import { buildExtractObjectivesPrompt, buildGenerateItemsPrompt, buildRegenerateItemPrompt } from "./prompts.js";
import { callGemini } from "./gemini.js";
import { assertItemsPayload, assertObjectivesPayload, extractJsonObject, readJson } from "./json.js";
import { handleOptions, jsonResponse } from "./cors.js";

async function handleExtractObjectives(request, env) {
  const body = await readJson(request);
  if (!body.ok) return jsonResponse(request, env, { ok: false, error: body.error }, 400);

  const { project = {}, materialText = "" } = body.data;

  if (!materialText || !String(materialText).trim()) {
    return jsonResponse(request, env, { ok: false, error: "缺少教材內容 materialText。" }, 400);
  }

  const prompt = buildExtractObjectivesPrompt({ project, materialText });
  const ai = await callGemini({ env, prompt });
  if (!ai.ok) return jsonResponse(request, env, { ok: false, error: ai.error }, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return jsonResponse(request, env, { ok: false, error: parsed.error }, 502);

  const payload = assertObjectivesPayload(parsed.data);
  if (!payload.ok) return jsonResponse(request, env, { ok: false, error: payload.error }, 502);

  return jsonResponse(request, env, { ok: true, objectives: payload.objectives });
}

async function handleGenerateItems(request, env) {
  const body = await readJson(request);
  if (!body.ok) return jsonResponse(request, env, { ok: false, error: body.error }, 400);

  const { project = {}, materialText = "", objectives = [], intents = [] } = body.data;

  if (!Array.isArray(objectives) || objectives.length === 0) {
    return jsonResponse(request, env, { ok: false, error: "缺少 objectives。" }, 400);
  }

  if (!Array.isArray(intents) || intents.length === 0) {
    return jsonResponse(request, env, { ok: false, error: "缺少 intents。" }, 400);
  }

  const prompt = buildGenerateItemsPrompt({ project, materialText, objectives, intents });
  const ai = await callGemini({ env, prompt });
  if (!ai.ok) return jsonResponse(request, env, { ok: false, error: ai.error }, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return jsonResponse(request, env, { ok: false, error: parsed.error }, 502);

  const payload = assertItemsPayload(parsed.data, intents.length);
  if (!payload.ok) return jsonResponse(request, env, { ok: false, error: payload.error }, 502);

  return jsonResponse(request, env, { ok: true, items: payload.items });
}

async function handleRegenerateItem(request, env) {
  const body = await readJson(request);
  if (!body.ok) return jsonResponse(request, env, { ok: false, error: body.error }, 400);

  const { project = {}, materialText = "", objectives = [], originalItem, reason = "" } = body.data;

  if (!originalItem || typeof originalItem !== "object") {
    return jsonResponse(request, env, { ok: false, error: "缺少 originalItem。" }, 400);
  }

  const prompt = buildRegenerateItemPrompt({ project, materialText, objectives, originalItem, reason });
  const ai = await callGemini({ env, prompt });
  if (!ai.ok) return jsonResponse(request, env, { ok: false, error: ai.error }, ai.status || 502);

  const parsed = extractJsonObject(ai.text);
  if (!parsed.ok) return jsonResponse(request, env, { ok: false, error: parsed.error }, 502);

  const payload = assertItemsPayload(parsed.data, 1);
  if (!payload.ok) return jsonResponse(request, env, { ok: false, error: payload.error }, 502);

  return jsonResponse(request, env, { ok: true, items: payload.items });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return handleOptions(request, env);

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse(request, env, { ok: true, service: "exam-wizard-next-proxy" });
    }

    if (url.pathname === "/extract-objectives" && request.method === "POST") {
      return handleExtractObjectives(request, env);
    }

    if (url.pathname === "/generate-items" && request.method === "POST") {
      return handleGenerateItems(request, env);
    }

    if (url.pathname === "/regenerate-item" && request.method === "POST") {
      return handleRegenerateItem(request, env);
    }

    return jsonResponse(request, env, { ok: false, error: "Not Found" }, 404);
  },
};
