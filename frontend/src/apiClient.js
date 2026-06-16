import { getApiBaseUrl } from "./config.js";
import { normalizeGeneratedItems } from "./core/normalizeItem.js";

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

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || `HTTP ${response.status}`,
      };
    }

    if (Array.isArray(data?.items)) {
      return {
        ...data,
        items: normalizeGeneratedItems(data.items),
      };
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return {
        ok: false,
        error: `連線超時：AI 伺服器超過 ${Math.round(timeout / 1000)} 秒仍未回應，請稍後再試。`,
      };
    }
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
