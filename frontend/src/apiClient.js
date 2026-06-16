import { getApiBaseUrl } from "./config.js";
import { normalizeGeneratedItems } from "./core/normalizeItem.js";

async function postJson({ apiBaseUrl = getApiBaseUrl(), path, body }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
        error: "連線超時：AI 伺服器回應時間過長，請確認網路連線或稍後再試。",
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