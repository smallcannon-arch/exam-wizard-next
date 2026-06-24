import { getApiBaseUrl } from "./config.js";
import { normalizeGeneratedItems } from "./core/normalizeItem.js";

function timeoutError(timeout) {
  return {
    ok: false,
    error: `Request timed out after ${Math.round(timeout / 1000)} seconds.`,
    errorCode: "CLIENT_TIMEOUT",
  };
}

async function readJsonResponse(response) {
  return response.json().catch(() => null);
}

function normalizeItemsIfPresent(data) {
  if (Array.isArray(data?.items)) {
    return {
      ...data,
      items: normalizeGeneratedItems(data.items),
    };
  }
  return data;
}

async function postJson({ apiBaseUrl = getApiBaseUrl(), path, body, timeoutMs = 180000 }) {
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(timeoutMs) || 180000);
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await readJsonResponse(response);

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || `HTTP ${response.status}`,
        errorCode: data?.errorCode,
      };
    }

    return normalizeItemsIfPresent(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") return timeoutError(timeout);
    return {
      ok: false,
      error: error.message || String(error),
    };
  }
}

async function getJson({ apiBaseUrl = getApiBaseUrl(), path, timeoutMs = 60000 }) {
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(timeoutMs) || 60000);
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await readJsonResponse(response);

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || `HTTP ${response.status}`,
        errorCode: data?.errorCode,
      };
    }

    return normalizeItemsIfPresent(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") return timeoutError(timeout);
    return {
      ok: false,
      error: error.message || String(error),
    };
  }
}

export function generateItemsViaApi({
  apiBaseUrl,
  project,
  materialText,
  objectives,
  intents,
  checkedChineseSubcategories,
}) {
  return postJson({
    apiBaseUrl,
    path: "/generate-items",
    body: {
      project,
      materialText,
      objectives,
      intents,
      checkedChineseSubcategories,
    },
    timeoutMs: 300000,
  });
}

export function createGenerationJobViaApi({
  apiBaseUrl,
  project,
  materialText,
  objectives,
  intents,
  checkedChineseSubcategories,
}) {
  return postJson({
    apiBaseUrl,
    path: "/generation-jobs",
    body: {
      project,
      materialText,
      objectives,
      intents,
      checkedChineseSubcategories,
    },
    timeoutMs: 30000,
  });
}

export function getGenerationJobStatusViaApi({
  apiBaseUrl,
  jobId,
}) {
  return getJson({
    apiBaseUrl,
    path: `/generation-jobs/${encodeURIComponent(jobId)}`,
    timeoutMs: 30000,
  });
}

export function getGenerationJobResultViaApi({
  apiBaseUrl,
  jobId,
}) {
  return getJson({
    apiBaseUrl,
    path: `/generation-jobs/${encodeURIComponent(jobId)}/result`,
    timeoutMs: 60000,
  });
}

export function regenerateItemViaApi({
  apiBaseUrl,
  project,
  materialText,
  objectives,
  originalItem,
  reason,
  checkedChineseSubcategories,
}) {
  return postJson({
    apiBaseUrl,
    path: "/regenerate-item",
    body: {
      project,
      materialText,
      objectives,
      originalItem,
      reason,
      checkedChineseSubcategories,
    },
  });
}

export function extractObjectivesViaApi({
  apiBaseUrl,
  project,
  materialText,
  files,
}) {
  return postJson({
    apiBaseUrl,
    path: "/extract-objectives",
    body: {
      project,
      materialText,
      files,
    },
  });
}

export function normalizeObjectivesViaApi({
  apiBaseUrl,
  text,
}) {
  return postJson({
    apiBaseUrl,
    path: "/normalize-objectives",
    body: {
      text,
    },
  });
}
