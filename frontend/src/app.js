import { createInitialState } from "./state.js";
import { makeObjectiveId } from "./core/ids.js";
import { allocateObjectivePlans, summarizeScoreByObjective } from "./core/scoring.js";
import { buildItemIntents, buildPaperSectionsByTheme } from "./core/blueprint.js";
import { validateExam } from "./core/validation.js";
import { replaceItemById } from "./core/replaceItem.js";
import { renderStudentPaper, renderTeacherPaper } from "./core/renderPaper.js";
import { generateItemsViaApi, regenerateItemViaApi } from "./apiClient.js";
import { getApiBaseUrl } from "./config.js";
import { validateGeneratedItemsAgainstIntents } from "./core/validateGeneratedItems.js";

const app = document.querySelector("#app");
let state = createInitialState();
let busy = false;
let busyItemId = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

function setProjectField(field, value) {
  state.project = { ...state.project, [field]: value };
}

function parseObjectives(input) {
  return String(input || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [text, periodCount = "1"] = line.split("｜").map((part) => part.trim());
      return {
        objectiveId: makeObjectiveId(index + 1),
        unitName: index < 2 ? "觀察與推論" : "生活應用",
        text,
        periodCount: Number(periodCount) || 1,
      };
    });
}

function buildBlueprint() {
  const objectives = parseObjectives(state.objectiveInput);
  const plans = allocateObjectivePlans({
  objectives,
  totalScore: Number(state.project.totalScore),
  unitScore: Number(state.project.unitScore),
  });

  if (!plans.ok) {
    setState({ objectives, objectivePlans: [], intents: [], sections: [], errors: [plans.error], messages: [] });
    return;
  }

  const intentResult = buildItemIntents({
  objectives,
  objectivePlans: plans.plans,
  unitScore: Number(state.project.unitScore),
  questionTypeMix: ["選擇題", "填充題", "應用題"],
  });

  if (!intentResult.ok) {
    setState({ objectives, objectivePlans: plans.plans, intents: [], sections: [], errors: [intentResult.error], messages: [] });
    return;
  }

  const sectionResult = buildPaperSectionsByTheme({ intents: intentResult.intents });

  setState({
    objectives,
    objectivePlans: plans.plans,
    intents: intentResult.intents,
    sections: sectionResult.sections,
    errors: [],
    messages: [`已建立藍圖：${intentResult.intents.length} 個計分單位，每個計分單位 ${state.project.unitScore} 分。`],
    step: 4,
  });
}

async function generateItems() {
  if (state.intents.length === 0) {
    setState({
      errors: ["請先建立題目藍圖。"],
      messages: [],
    });
    return;
  }

  busy = true;
  busyItemId = null;
  setState({
    errors: [],
    messages: ["AI 正在生成試題草稿，請稍候……"],
  });

  try {
    const result = await generateItemsViaApi({
      apiBaseUrl: getApiBaseUrl(),
      project: state.project,
      materialText: state.materialText,
      objectives: state.objectives,
      intents: state.intents,
    });

    if (!result?.ok || !Array.isArray(result.items)) {
  setState({
    errors: [result?.error || "AI 回傳格式錯誤。"],
    messages: [],
  });
  return;
}

const generatedCheck = validateGeneratedItemsAgainstIntents({
  intents: state.intents,
  items: result.items,
});

if (!generatedCheck.ok) {
  setState({
    errors: generatedCheck.errors,
    messages: ["AI 回傳題目不完整，尚未匯入正式草稿。請重新生成。"],
  });
  return;
}

setState({
  items: result.items,
  errors: [],
  messages: [`已產生 ${result.items.length} 個正式草稿計分單位。`],
  step: 5,
});
  } catch (error) {
    setState({
      errors: [
        `AI 生成請求失敗：${error?.message || String(error)}`,
        `請確認 Worker 是否仍在 ${getApiBaseUrl()} 執行。`,
      ],
      messages: [],
    });
  } finally {
    busy = false;
    busyItemId = null;
    render();
  }
}

async function regenerateItem(itemId) {
  const originalItem = state.items.find((item) => item.itemId === itemId);
  if (!originalItem) return;

  const reason = window.prompt(`請輸入 ${itemId} 重出理由`, "題意不夠清楚，請換一個生活情境。");
  if (reason === null) return;

  busy = true;
  busyItemId = itemId;
  setState({ errors: [], messages: [`AI 正在重新設計 ${itemId}，請稍候……`] });

  try {
    const objectiveIds = new Set(originalItem.objectiveIds || []);
    const objectives = state.objectives.filter((objective) => objectiveIds.has(objective.objectiveId));
    const result = await regenerateItemViaApi({
      apiBaseUrl: getApiBaseUrl(),
      project: state.project,
      materialText: state.materialText,
      objectives: state.objectives,
      originalItem,
      reason: "請重新設計此題，避免只是改寫原題。",
    });

    if (!result?.ok || !Array.isArray(result.items) || result.items.length !== 1) {
      setState({ errors: [result?.error || "AI 重出回傳格式錯誤。"], messages: [] });
      return;
    }

    const replacement = replaceItemById({
      items: state.items,
      itemId,
      regeneratedItem: result.items[0],
    });

    if (!replacement.ok) {
      setState({ errors: [replacement.error], messages: [] });
      return;
    }

    setState({ items: replacement.items, errors: [], messages: [`${itemId} 已重新出題，結構欄位已保留。`] });
  } catch (error) {
    setState({
      errors: [
        `AI 重出請求失敗：${error?.message || String(error)}`,
        `請確認 Worker 是否仍在 ${getApiBaseUrl()} 執行。`,
      ],
      messages: [],
    });
  } finally {
    busy = false;
    busyItemId = null;
    render();
  }
}

function updateItemField(itemId, field, value) {
  setState({
    items: state.items.map((item) => (item.itemId === itemId ? { ...item, [field]: value } : item)),
  });
}

function renderMessages() {
  return [
    ...state.messages.map((message) => `<div class="notice success">${escapeHtml(message)}</div>`),
    ...state.errors.map((error) => `<div class="notice error">${escapeHtml(error)}</div>`),
  ].join("");
}

function renderSteps() {
  const labels = ["建卷", "目標", "配題", "藍圖", "修題", "檢核", "輸出"];
  return `<nav class="step-list">${labels.map((label, index) => `
    <button class="step-button ${state.step === index + 1 ? "active" : ""}" data-step="${index + 1}">${index + 1}. ${label}</button>
  `).join("")}</nav>`;
}

function renderStep1() {
  return `<section class="panel">
    <h2>① 建卷</h2>
    <div class="grid">
      <label>評量名稱<input data-project="examName" value="${escapeHtml(state.project.examName)}"></label>
      <label>科目<input data-project="subject" value="${escapeHtml(state.project.subject)}"></label>
      <label>年級<input data-project="grade" value="${escapeHtml(state.project.grade)}"></label>
      <label>總分<input type="number" data-project="totalScore" value="${escapeHtml(state.project.totalScore)}"></label>
      <label>每個計分單位分數<input type="number" data-project="unitScore" value="${escapeHtml(state.project.unitScore)}"></label>
    </div>
    <label>教材內容或摘要<textarea data-field="materialText">${escapeHtml(state.materialText)}</textarea></label>
    <div class="actions"><button data-next-step="2">下一步</button></div>
  </section>`;
}

function renderStep2() {
  return `<section class="panel">
    <h2>② 學習目標</h2>
    <p class="notice">每行一個目標，格式：目標文字｜節數。節數會用來分配計分單位數。</p>
    <label>學習目標<textarea data-field="objectiveInput">${escapeHtml(state.objectiveInput)}</textarea></label>
    <div class="actions"><button data-action="build-blueprint">建立配題與藍圖</button></div>
  </section>`;
}

function renderStep3Or4() {
  const plans = state.objectivePlans;
  const intents = state.intents;
  return `<section class="panel">
    <h2>${state.step === 3 ? "③ 目標配題" : "④ 題目藍圖"}</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th>文字</th><th>節數</th><th>計分單位數</th><th>配分</th></tr></thead>
      <tbody>${plans.map((plan) => {
        const objective = state.objectives.find((entry) => entry.objectiveId === plan.objectiveId);
        return `<tr><td>${escapeHtml(plan.targetUnitCount)}</td><td>${escapeHtml(objective?.text)}</td><td>${escapeHtml(objective?.periodCount)}</td><td>${escapeHtml(plan.targetUnitCount)}</td><td>${escapeHtml(plan.targetScore)}</td></tr>`;
      }).join("")}</tbody>
    </table></div>

    <h3>題目意圖</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>目標</th><th>主題</th><th>題型</th><th>分數</th></tr></thead>
      <tbody>${intents.slice(0, 80).map((intent) => `<tr><td>${intent.itemId}</td><td>${intent.primaryObjectiveId}</td><td>${escapeHtml(intent.themeBlockId)}</td><td>${escapeHtml(intent.questionType)}</td><td>${intent.score}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="actions">
      <button data-action="generate-items" ${busy ? "disabled" : ""}>${busy ? "AI 生成中……" : "連線 AI 生成正式草稿"}</button>
    </div>
  </section>`;
}

function renderItems() {
  const summary = summarizeScoreByObjective(state.items);
  return `<section class="panel">
    <h2>⑤ 修題定稿</h2>
    <p class="notice">這裡沒有備選池。題目就是正式草稿；不滿意的題目，直接重出該題。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th>計分單位數</th><th>分數</th></tr></thead>
      <tbody>${summary.map((row) => `<tr><td>${row.objectiveId}</td><td>${row.unitCount}</td><td>${row.score}</td></tr>`).join("")}</tbody>
    </table></div>
    ${state.items.map((item) => `<article class="item-card">
      <div class="item-meta">${escapeHtml(item.itemId)}｜${escapeHtml(item.questionType)}｜${escapeHtml(item.objectiveIds?.join(", "))}｜${escapeHtml(item.score)}分</div>
      <label>題幹<textarea data-item-field="question" data-item-id="${escapeHtml(item.itemId)}">${escapeHtml(item.question)}</textarea></label>
      <label>答案<input data-item-field="answer" data-item-id="${escapeHtml(item.itemId)}" value="${escapeHtml(item.answer)}"></label>
      <label>解析<textarea data-item-field="explanation" data-item-id="${escapeHtml(item.itemId)}">${escapeHtml(item.explanation)}</textarea></label>
      <div class="actions">
        <button data-action="regenerate-item" data-item-id="${escapeHtml(item.itemId)}" ${busy ? "disabled" : ""}>${busy && busyItemId === item.itemId ? "AI 重出中……" : "AI 重出此題"}</button>
      </div>
    </article>`).join("")}
    <div class="actions"><button data-next-step="6">前往檢核</button></div>
  </section>`;
}

function renderAudit() {
  const result = validateExam({
  objectives: state.objectives,
  objectivePlans: state.objectivePlans,
  items: state.items,
  totalScore: Number(state.project.totalScore),
  unitScore: Number(state.project.unitScore),
  });

  return `<section class="panel">
    <h2>⑥ 檢核</h2>
    <div class="notice ${result.ok ? "success" : "error"}">${result.ok ? "基本檢核通過。仍請人工確認題意、答案與解析。" : "發現錯誤，請先修正。"}</div>
    ${result.errors.length ? `<h3>錯誤</h3><ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : ""}
    ${result.warnings.length ? `<h3>提醒</h3><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th>計分單位數</th><th>分數</th></tr></thead>
      <tbody>${result.summary.map((row) => `<tr><td>${row.objectiveId}</td><td>${row.unitCount}</td><td>${row.score}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="actions"><button data-next-step="7">前往輸出</button></div>
  </section>`;
}

function renderOutput() {
  const studentPaper = renderStudentPaper({ project: state.project, sections: state.sections, items: state.items });
  const teacherPaper = renderTeacherPaper({ project: state.project, sections: state.sections, items: state.items });
  return `<section class="panel">
    <h2>⑦ 輸出</h2>
    <h3>學生卷</h3>
    <pre>${escapeHtml(studentPaper)}</pre>
    <h3>教師卷</h3>
    <pre>${escapeHtml(teacherPaper)}</pre>
  </section>`;
}

function renderCurrentStep() {
  if (state.step === 1) return renderStep1();
  if (state.step === 2) return renderStep2();
  if (state.step === 3 || state.step === 4) return renderStep3Or4();
  if (state.step === 5) return renderItems();
  if (state.step === 6) return renderAudit();
  if (state.step === 7) return renderOutput();
  return renderStep1();
}

function renderBusyBanner() {
  if (!busy) return "";
  const label = busyItemId
    ? `AI 正在重新設計 ${escapeHtml(busyItemId)}，請稍候……`
    : "AI 正在生成試題草稿，請稍候……";
  return `<div class="notice loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>${label}</div>`;
}

function render() {
  app.innerHTML = `${renderSteps()}${renderBusyBanner()}${renderMessages()}${renderCurrentStep()}`;
}

app.addEventListener("input", (event) => {
  const projectField = event.target.dataset.project;
  const field = event.target.dataset.field;
  const itemField = event.target.dataset.itemField;
  const itemId = event.target.dataset.itemId;

  if (projectField) {
    setProjectField(projectField, event.target.value);
    return;
  }

  if (field) {
    state[field] = event.target.value;
    return;
  }

  if (itemField && itemId) {
    updateItemField(itemId, itemField, event.target.value);
  }
});

app.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-step]");
  const nextStepButton = event.target.closest("[data-next-step]");
  const actionButton = event.target.closest("[data-action]");

  if (stepButton) {
    setState({ step: Number(stepButton.dataset.step) });
    return;
  }

  if (nextStepButton) {
    setState({ step: Number(nextStepButton.dataset.nextStep) });
    return;
  }

  if (!actionButton) return;

  const action = actionButton.dataset.action;
  if (action === "build-blueprint") buildBlueprint();
  if (action === "generate-items") generateItems();
  if (action === "regenerate-item") regenerateItem(actionButton.dataset.itemId);
});

render();
