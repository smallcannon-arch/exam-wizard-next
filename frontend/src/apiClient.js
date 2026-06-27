import { getApiBaseUrl } from "./config.js";
import {
  extractHttpErrorDetails,
  normalizeGenerationError,
} from "./core/generationDiagnostics.js";
import { normalizeGeneratedItems } from "./core/normalizeItem.js";

function timeoutError(timeout, diagnostics) {
  return {
    ok: false,
    error: `Request timed out after ${Math.round(timeout / 1000)} seconds.`,
    errorCode: "CLIENT_TIMEOUT",
    diagnostics,
  };
}

async function readResponseBody(response) {
  const text = await response.text().catch(() => "");
  if (!text) return { json: null, text: "" };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
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

async function postJson({
  apiBaseUrl = getApiBaseUrl(),
  path,
  body,
  timeoutMs = 180000,
  phase = "request",
  jobId = "",
}) {
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

    const responseBody = await readResponseBody(response);
    const data = responseBody.json;

    if (!response.ok) {
      const httpDetails = extractHttpErrorDetails(response, responseBody);
      const diagnostics = normalizeGenerationError(null, {
        phase,
        endpointPath: path,
        ...httpDetails,
        jobId: httpDetails.jobId || jobId,
      });
      return {
        ok: false,
        error: diagnostics.errorMessage || `HTTP ${response.status}`,
        errorCode: diagnostics.errorCode,
        diagnostics,
      };
    }

    return normalizeItemsIfPresent(data);
  } catch (error) {
    clearTimeout(timeoutId);
    const diagnostics = normalizeGenerationError(error, {
      phase,
      endpointPath: path,
      jobId,
      errorCode: error.name === "AbortError" ? "CLIENT_TIMEOUT" : "",
      isAbort: error.name === "AbortError",
      isNetworkError: error.name !== "AbortError",
    });
    if (error.name === "AbortError") return timeoutError(timeout, diagnostics);
    return {
      ok: false,
      error: error.message || String(error),
      diagnostics,
    };
  }
}

async function getJson({
  apiBaseUrl = getApiBaseUrl(),
  path,
  timeoutMs = 60000,
  phase = "request",
  jobId = "",
}) {
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(timeoutMs) || 60000);
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await readResponseBody(response);
    const data = responseBody.json;

    if (!response.ok) {
      const httpDetails = extractHttpErrorDetails(response, responseBody);
      const diagnostics = normalizeGenerationError(null, {
        phase,
        endpointPath: path,
        ...httpDetails,
        jobId: httpDetails.jobId || jobId,
      });
      return {
        ok: false,
        error: diagnostics.errorMessage || `HTTP ${response.status}`,
        errorCode: diagnostics.errorCode,
        diagnostics,
      };
    }

    return normalizeItemsIfPresent(data);
  } catch (error) {
    clearTimeout(timeoutId);
    const diagnostics = normalizeGenerationError(error, {
      phase,
      endpointPath: path,
      jobId,
      errorCode: error.name === "AbortError" ? "CLIENT_TIMEOUT" : "",
      isAbort: error.name === "AbortError",
      isNetworkError: error.name !== "AbortError",
    });
    if (error.name === "AbortError") return timeoutError(timeout, diagnostics);
    return {
      ok: false,
      error: error.message || String(error),
      diagnostics,
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
    phase: "generate",
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
    phase: "create",
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
    phase: "poll",
    jobId,
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
    phase: "result",
    jobId,
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
