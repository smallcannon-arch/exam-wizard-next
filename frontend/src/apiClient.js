import { getApiBaseUrl } from "./config.js";
import { normalizeGeneratedItems } from "./core/normalizeItem.js";

async function postJson({ apiBaseUrl = getApiBaseUrl(), path, body }) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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