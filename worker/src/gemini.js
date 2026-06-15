export async function callGemini({ env, prompt }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: "後端尚未設定 GEMINI_API_KEY。" };
  }

  const apiVersion = env.GEMINI_API_VERSION || "v1beta";
  const model = env.GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: "Gemini API 呼叫失敗。請檢查 API key、模型名稱、版本與額度。",
      detail: data?.error?.message || "",
    };
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";

  if (!text.trim()) {
    return { ok: false, status: 502, error: "Gemini 回應為空。" };
  }

  return { ok: true, text };
}
