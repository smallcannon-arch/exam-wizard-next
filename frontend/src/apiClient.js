async function postJson({ apiBaseUrl, path, body }) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error || `API 錯誤：HTTP ${response.status}`,
    };
  }

  return data;
}

export function generateItemsViaApi({ apiBaseUrl, project, materialText, objectives, intents }) {
  return postJson({
    apiBaseUrl,
    path: "/generate-items",
    body: { project, materialText, objectives, intents },
  });
}

export function regenerateItemViaApi({ apiBaseUrl, project, materialText, objectives, originalItem, reason }) {
  return postJson({
    apiBaseUrl,
    path: "/regenerate-item",
    body: { project, materialText, objectives, originalItem, reason },
  });
}
