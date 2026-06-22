const WAIT_NOTICES = [
  {
    seconds: 90,
    text: "等待時間較長。請先不要重複送出；若稍後失敗，可再重新嘗試。",
  },
  {
    seconds: 60,
    text: "仍在產生試題。若題數較多或品質檢查較完整，等待時間可能會增加。",
  },
  {
    seconds: 30,
    text: "這次生成需要較多時間，系統仍在處理中。",
  },
];

const PHASES = [
  {
    key: "submitted",
    label: "已送出命題需求",
    title: "正在產生試題",
    statusText: "系統已收到命題條件，正在整理學習目標與題型設定。",
  },
  {
    key: "generating",
    label: "正在產生題目",
    title: "正在產生試題",
    statusText: "系統正在依照學習目標與題型設定產生題目，請稍候。",
  },
  {
    key: "validating",
    label: "正在檢查題目格式",
    title: "正在檢查題目格式",
    statusText: "系統正在檢查題目、答案、選項與解析格式。",
  },
  {
    key: "finalizing",
    label: "正在準備顯示結果",
    title: "正在準備結果",
    statusText: "題目已產生，正在整理為修題畫面。",
  },
];

const RETRY_PHASE = {
  key: "retrying",
  title: "正在重新嘗試產生試題",
  statusText: "第一次生成未成功，系統正在自動重試一次。",
};

function clampElapsedSeconds(startedAt, now) {
  const elapsed = Math.floor((Number(now) - Number(startedAt)) / 1000);
  return Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
}

function normalizeErrorText(error) {
  if (Array.isArray(error)) return error.join(" ");
  if (error instanceof Error) return error.message || "";
  return String(error || "");
}

function classifyFailure(error, fallbackType = "") {
  const text = normalizeErrorText(error).toLowerCase();
  if (/timeout|abort|逾時|超時|504/.test(text) || fallbackType === "timeout") {
    return {
      reason: "AI 服務回應逾時。",
      suggestion: "請稍後再試，或減少題數後重試。",
    };
  }
  if (/network|fetch|連線|worker|http|502|503/.test(text) || fallbackType === "network") {
    return {
      reason: "服務暫時無法回應或網路連線中斷。",
      suggestion: "請確認網路與後端服務狀態，稍後再試。",
    };
  }
  if (/validation|檢核|格式|欄位|選項|答案/.test(text) || fallbackType === "validation") {
    return {
      reason: "題目格式或欄位不完整。",
      suggestion: "請重新生成，或減少題數後再試。",
    };
  }
  return {
    reason: "系統未能完成本次生成。",
    suggestion: "請稍後再試；若題數較多，可先減少題數後重試。",
  };
}

export function createGenerationProgress({ totalItems = 0, now = Date.now() } = {}) {
  return {
    phase: "submitted",
    totalItems: Math.max(0, Number(totalItems) || 0),
    startedAt: now,
    updatedAt: now,
  };
}

export function getGenerationProgressView(progress, now = Date.now()) {
  const currentPhase = progress?.phase || "submitted";
  const elapsedSeconds = clampElapsedSeconds(progress?.startedAt ?? now, now);
  const activeIndex = Math.max(0, PHASES.findIndex((phase) => phase.key === currentPhase));
  const phaseMeta = currentPhase === "retrying"
    ? RETRY_PHASE
    : PHASES.find((phase) => phase.key === currentPhase) || PHASES[0];
  const timeoutNotice = WAIT_NOTICES.find((notice) => elapsedSeconds >= notice.seconds)?.text || "";

  return {
    title: phaseMeta.title,
    statusText: phaseMeta.statusText,
    reminder: "題目越多，等待時間可能越長。請先不要關閉頁面。",
    elapsedSeconds,
    elapsedLabel: elapsedSeconds < 60
      ? `已等待 ${elapsedSeconds} 秒`
      : `已等待 ${Math.floor(elapsedSeconds / 60)} 分 ${elapsedSeconds % 60} 秒`,
    timeoutNotice,
    steps: PHASES.map((phase, index) => ({
      key: phase.key,
      label: phase.label,
      state: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
    })),
  };
}

export function buildGenerationFailureMessages(error, { type = "" } = {}) {
  const failure = classifyFailure(error, type);
  return [
    "生成失敗",
    failure.reason,
    failure.suggestion,
  ];
}
