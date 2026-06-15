export async function readJson(request) {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, error: "請求內容不是合法 JSON。" };
  }
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const withoutFence = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return { ok: true, data: JSON.parse(withoutFence) };
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return { ok: false, error: "AI 回應中找不到 JSON 物件。" };
    }

    try {
      return { ok: true, data: JSON.parse(withoutFence.slice(start, end + 1)) };
    } catch {
      return { ok: false, error: "AI 回應不是合法 JSON。" };
    }
  }
}

export function assertObjectivesPayload(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.objectives)) {
    return { ok: false, error: "AI 回應缺少 objectives 陣列。" };
  }

  if (payload.objectives.length === 0) {
    return { ok: false, error: "AI 未萃取到任何學習目標。" };
  }

  return { ok: true, objectives: payload.objectives };
}

export function assertItemsPayload(payload, expectedCount = null) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.items)) {
    return { ok: false, error: "AI 回應缺少 items 陣列。" };
  }

  if (expectedCount !== null && payload.items.length !== expectedCount) {
    return { ok: false, error: `AI 回應題數 ${payload.items.length} 不等於預期 ${expectedCount}。` };
  }

  return { ok: true, items: payload.items };
}
