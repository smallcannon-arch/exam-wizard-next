import { createInitialState } from "./state.js";
import { makeObjectiveId } from "./core/ids.js";
import { summarizeScoreByObjective } from "./core/scoring.js";
import { buildItemSlots, buildSectionsByQuestionType } from "./core/blueprint.js";
import { buildPlanSequences, getPlanTotals, validatePlan } from "./core/plan.js";
import { getQuestionTypeOptions, SUBJECT_OPTIONS } from "./core/questionTypes.js";
import { validateExam } from "./core/validation.js";
import { replaceItemById } from "./core/replaceItem.js";
import { renderStudentPaper, renderTeacherPaper } from "./core/renderPaper.js";
import { extractObjectivesViaApi, generateItemsViaApi, regenerateItemViaApi } from "./apiClient.js";
import { normalizeExtractedObjectives, objectivesToInputText, parseObjectiveInput } from "./core/objectives.js";
import { computeObjectiveShares, formatPercent } from "./core/periods.js";
import { largestRemainder } from "./core/distribute.js";
import { getApiBaseUrl } from "./config.js";
import { validateGeneratedPaper } from "./core/validateGeneratedPaper.js";
import { buildAuditRows } from "./core/auditRows.js";

// 目標提取 Gem（沿用現有連結）；教材提取 Gem 建立後，把網址填到 GEM_MATERIAL_URL。
const GEM_OBJECTIVES_URL = "https://gemini.google.com/gem/1Xd6a-3N4dZvvzC7TdgP1yBjAa2IXDUFb?usp=sharing";
const GEM_MATERIAL_URL = "";

function gemLink(url, label) {
  return url
    ? `<a href="${url}" target="_blank" rel="noopener">${label} ↗</a>`
    : `<span title="建立教材提取 Gem 後補上連結">${label}（連結待設定）</span>`;
}

const app = document.querySelector("#app");
let state = createInitialState();
let busy = false;
let busyItemId = null;
let busyLabel = "";

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

function examTitle() {
  return `${state.project.grade || ""}${state.project.subject || ""}評量` || "未命名評量";
}

// 依各目標節數，以最大餘數法把總分配成整數目標配分（總和等於總分）。
function objectiveScoresByPeriod(objectives, totalScore) {
  const rows = largestRemainder(totalScore, objectives.map((objective) => ({ key: objective.objectiveId, weight: objective.periodCount })));
  return new Map(rows.map((row) => [row.key, row.count]));
}

function renderObjectivePreview() {
  const objectives = parseObjectives(state.objectiveInput);
  if (objectives.length === 0) return "";

  const totalScore = getPlanTotals(state.planRows).totalScore;
  const totalPeriods = objectives.reduce((sum, objective) => sum + (Number(objective.periodCount) || 0), 0);
  const scoreById = objectiveScoresByPeriod(objectives, totalScore);

  const rows = objectives.map((objective, index) => `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(objective.text)}</td>
      <td class="num">${escapeHtml(objective.periodCount)} 節</td>
      <td class="num">${escapeHtml(scoreById.get(objective.objectiveId) || 0)} 分</td>
    </tr>`).join("");

  return `
    <h3>目標配分預覽（依節數比例）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>№</th><th>單元／學習目標</th><th class="num">授課節數</th><th class="num">目標配分</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td><strong>合計</strong></td><td class="num"><strong>${totalPeriods} 節</strong></td><td class="num"><strong>${totalScore} 分</strong></td></tr></tfoot>
    </table></div>
  `;
}

function parseObjectives(input) {
  return parseObjectiveInput(input).map((objective, index) => ({
    objectiveId: makeObjectiveId(index + 1),
    unitName: objective.unitName || (index < 2 ? "觀察與推論" : "生活應用"),
    text: objective.text,
    periodCount: objective.periodCount,
  }));
}

function buildBlueprint() {
  const objectives = parseObjectives(state.objectiveInput);
  if (objectives.length === 0) {
    setState({ objectives: [], objectiveTargets: [], objectivePlans: [], intents: [], sections: [], errors: ["請先貼上學習目標（可用上方的 Gem 取得，每行：目標文字｜節數）。"], messages: [] });
    return;
  }

  const planCheck = validatePlan(state.planRows);
  if (!planCheck.ok) {
    setState({ objectives, objectiveTargets: [], objectivePlans: [], intents: [], sections: [], errors: [planCheck.error], messages: [] });
    return;
  }

  const { questionTypeSequence, scoreSequence } = buildPlanSequences(state.planRows);
  const slotResult = buildItemSlots({ questionTypeSequence, scoreSequence });
  if (!slotResult.ok) {
    setState({ objectives, objectiveTargets: [], objectivePlans: [], intents: [], sections: [], errors: [slotResult.error], messages: [] });
    return;
  }

  const totalScore = planCheck.totalScore;
  const scoreById = objectiveScoresByPeriod(objectives, totalScore);
  const objectiveTargets = computeObjectiveShares(objectives).map((row) => {
    const objective = objectives.find((entry) => entry.objectiveId === row.objectiveId);
    return {
      objectiveId: row.objectiveId,
      text: objective?.text || "",
      periodCount: row.periodCount,
      share: row.share,
      targetScore: scoreById.get(row.objectiveId) || 0,
    };
  });

  setState({
    objectives,
    objectiveTargets,
    objectivePlans: [],
    intents: slotResult.slots,
    sections: [],
    items: [],
    errors: [],
    messages: [`已建立藍圖：${slotResult.slots.length} 題、總分 ${totalScore} 分。各題對應的學習目標與出題順序，將在生成時由 AI 依節數比例與整卷整體性編排。`],
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
  busyLabel = "AI 正在生成試題草稿，請稍候……";
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

const generatedCheck = validateGeneratedPaper({
  slots: state.intents,
  objectives: state.objectives,
  items: result.items,
});

if (!generatedCheck.ok) {
  setState({
    errors: generatedCheck.errors,
    messages: ["AI 回傳的試卷不符合題位或目標覆蓋要求，尚未匯入。請重新生成。"],
  });
  return;
}

const sectionResult = buildSectionsByQuestionType({
  items: result.items,
  typeOrder: state.planRows.map((row) => row.questionType),
});
const sections = sectionResult.ok
  ? sectionResult.sections
  : [{ sectionId: "S-01", order: 1, title: "試題", layoutMode: "sequential", itemIds: result.items.map((item) => item.itemId) }];

setState({
  items: result.items,
  sections,
  errors: [],
  messages: [`已產生 ${result.items.length} 題正式草稿（AI 已依節數比例與整卷整體性編排）。`],
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
    busyLabel = "";
    render();
  }
}

async function extractObjectives() {
  if (!state.materialText || !state.materialText.trim()) {
    setState({ errors: ["請先在第①步填入教材內容或摘要，再用 AI 提取目標。"], messages: [] });
    return;
  }

  busy = true;
  busyItemId = null;
  busyLabel = "AI 正在從教材提取學習目標，請稍候……";
  setState({ errors: [], messages: [busyLabel] });

  try {
    const result = await extractObjectivesViaApi({
      apiBaseUrl: getApiBaseUrl(),
      project: state.project,
      materialText: state.materialText,
    });

    if (!result?.ok || !Array.isArray(result.objectives)) {
      setState({ errors: [result?.error || "AI 提取目標回傳格式錯誤。"], messages: [] });
      return;
    }

    const objectives = normalizeExtractedObjectives(result.objectives);
    if (objectives.length === 0) {
      setState({ errors: ["AI 未提取到可用目標，請補充教材內容。"], messages: [] });
      return;
    }

    state.objectiveInput = objectivesToInputText(objectives);
    setState({
      errors: [],
      messages: [`AI 已提取 ${objectives.length} 個學習目標並填入下方欄位，請確認或修改後再建立藍圖。`],
    });
  } catch (error) {
    setState({
      errors: [
        `AI 提取目標失敗：${error?.message || String(error)}`,
        `請確認 Worker 是否仍在 ${getApiBaseUrl()} 執行。`,
      ],
      messages: [],
    });
  } finally {
    busy = false;
    busyItemId = null;
    busyLabel = "";
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
  busyLabel = `AI 正在重新設計 ${itemId}，請稍候……`;
  setState({ errors: [], messages: [busyLabel] });

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
    busyLabel = "";
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
      <label>科目<input data-project="subject" value="${escapeHtml(state.project.subject)}"></label>
      <label>年級<input data-project="grade" value="${escapeHtml(state.project.grade)}"></label>
    </div>
    ${renderPlanTable()}
    <div class="actions"><button data-next-step="2">下一步</button></div>
  </section>`;
}

function renderPlanTable() {
  const subject = state.planSubject || state.project.subject;
  const baseOptions = getQuestionTypeOptions(subject);
  const totals = getPlanTotals(state.planRows);

  const subjectSelect = ["", ...SUBJECT_OPTIONS]
    .map((option) => `<option value="${escapeHtml(option)}" ${option === (state.planSubject || "") ? "selected" : ""}>${option === "" ? "請選擇科目" : escapeHtml(option)}</option>`)
    .join("");

  const rowsHtml = state.planRows.map((row, index) => {
    const options = baseOptions.includes(row.questionType) ? baseOptions : [...baseOptions, row.questionType];
    const optionHtml = options
      .map((type) => `<option value="${escapeHtml(type)}" ${type === row.questionType ? "selected" : ""}>${escapeHtml(type)}</option>`)
      .join("");
    const subtotal = (Number(row.count) || 0) * (Number(row.score) || 0);
    return `<tr>
      <td><select data-plan-field="questionType" data-plan-index="${index}">${optionHtml}</select></td>
      <td><input type="number" min="1" data-plan-field="count" data-plan-index="${index}" value="${escapeHtml(row.count)}"></td>
      <td><input type="number" min="1" data-plan-field="score" data-plan-index="${index}" value="${escapeHtml(row.score)}"></td>
      <td>${escapeHtml(subtotal)}分</td>
      <td><button class="secondary" data-action="remove-plan-row" data-plan-index="${index}">刪除</button></td>
    </tr>`;
  }).join("");

  return `
    <h3>配題表（題型／題數／配分）</h3>
    <p class="notice">題型清單依：<select data-field="planSubject">${subjectSelect}</select>　含「學力檢測題」＝情境素養題組（題幹含生活情境與子題）。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>題型</th><th>題數</th><th>每題(答)配分</th><th>小計</th><th></th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
    <div class="actions"><button class="secondary" data-action="add-plan-row">＋ 新增一列</button></div>
    <p class="notice ${totals.totalItems > 0 ? "success" : ""}">合計：${totals.totalItems} 題、${totals.totalScore} 分（即本卷總分）</p>
  `;
}

function renderStep2() {
  return `<section class="panel">
    <h2>② 學習目標</h2>
    <div class="notice">
      <strong>用兩個 Gem 分別抓「學習目標」與「教材重點」（建議；也可自己填）</strong>
      <ol class="gem-steps">
        <li><strong>學習目標：</strong>${gemLink(GEM_OBJECTIVES_URL, "開啟「目標提取」Gem")}，上傳該課的課本／單元活動架構，把它輸出的每行（<code>目標文字｜節數</code>）整段貼到下方「<strong>學習目標</strong>」欄。</li>
        <li><strong>教材重點：</strong>${gemLink(GEM_MATERIAL_URL, "開啟「教材提取」Gem")}，上傳該課的課本／習作，把它輸出的各單元重點整段貼到下方「<strong>教材摘要</strong>」欄。</li>
        <li>兩個 Gem 都<strong>不必</strong>上傳目次、解答或純教學 PPT。</li>
        <li>確認或修改後按「建立配題與藍圖」，系統會依各目標<strong>節數比例</strong>配分出題。</li>
      </ol>
      不想用 Gem 也可以：直接在下方「學習目標」欄輸入，每行 <code>目標文字｜節數</code>（例：<code>1-2 動物適應環境的策略｜2</code>）。
    </div>
    <label>學習目標（每行：目標文字｜節數）<textarea data-field="objectiveInput">${escapeHtml(state.objectiveInput)}</textarea></label>
    ${renderObjectivePreview()}
    <label>教材摘要（選填，建議貼上 Gem 摘出的課本／習作重點：國語的生字、語詞、句型、課文重點；其他科的核心概念與重要詞彙，供 AI 依課本實際內容出題）<textarea data-field="materialText">${escapeHtml(state.materialText)}</textarea></label>
    <div class="actions">
      <button class="secondary" data-action="extract-objectives" ${busy ? "disabled" : ""}>${busy ? "AI 提取中……" : "或：用上方教材摘要快速擷取"}</button>
      <button data-action="build-blueprint">建立配題與藍圖</button>
    </div>
  </section>`;
}

function renderStep3Or4() {
  const targets = state.objectiveTargets || [];
  const intents = state.intents;
  const planRows = state.planRows;
  return `<section class="panel">
    <h2>${state.step === 3 ? "③ 目標配題" : "④ 題目藍圖"}</h2>
    <p class="notice">藍圖只鎖定每題的題型與配分；各題對應哪個學習目標、認知層次與出題順序，交由 AI 依下列節數比例與整卷整體性編排。</p>

    <h3>學習目標與配分占比（依節數）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th>文字</th><th>節數</th><th>占總時數</th><th>目標配分(約)</th></tr></thead>
      <tbody>${targets.map((row) => `<tr><td>${escapeHtml(row.objectiveId)}</td><td>${escapeHtml(row.text)}</td><td>${escapeHtml(row.periodCount)}</td><td>${escapeHtml(formatPercent(row.share))}</td><td>${escapeHtml(row.targetScore)}</td></tr>`).join("")}</tbody>
    </table></div>

    <h3>配題分布（題型與配分固定）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題型</th><th>題數</th><th>每題(答)配分</th><th>小計</th></tr></thead>
      <tbody>${planRows.map((row) => `<tr><td>${escapeHtml(row.questionType)}</td><td>${escapeHtml(row.count)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml((Number(row.count) || 0) * (Number(row.score) || 0))}分</td></tr>`).join("")}</tbody>
    </table></div>

    <h3>題位（共 ${intents.length} 題）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>題型</th><th>配分</th></tr></thead>
      <tbody>${intents.slice(0, 80).map((slot) => `<tr><td>${escapeHtml(slot.itemId)}</td><td>${escapeHtml(slot.questionType)}</td><td>${escapeHtml(slot.score)}</td></tr>`).join("")}</tbody>
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
      <div class="item-meta">${escapeHtml(item.itemId)}｜${escapeHtml(item.questionType)}｜${escapeHtml(item.score)}分｜對應目標 ${escapeHtml(item.objectiveIds?.join("、") || item.primaryObjectiveId || "未標示")}｜層次 ${escapeHtml(item.cognitiveLevel || "未標示")}</div>
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
  const examTotal = state.items.reduce((sum, item) => sum + (Number(item?.score) || 0), 0);
  const result = validateExam({
  objectives: state.objectives,
  objectivePlans: state.objectivePlans,
  items: state.items,
  totalScore: examTotal,
  });

  return `<section class="panel">
    <h2>⑥ 檢核</h2>
    <div class="notice ${result.ok ? "success" : "error"}">${result.ok ? "基本檢核通過。仍請人工確認題意、答案與解析。" : "發現錯誤，請先修正。"}</div>
    ${result.errors.length ? `<h3>錯誤</h3><ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : ""}
    ${result.warnings.length ? `<h3>提醒</h3><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
    <h3>目標配分統計</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th>計分單位數</th><th>分數</th></tr></thead>
      <tbody>${result.summary.map((row) => `<tr><td>${row.objectiveId}</td><td>${row.unitCount}</td><td>${row.score}</td></tr>`).join("")}</tbody>
    </table></div>
    <h3>逐題審核表</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>題型</th><th>配分</th><th>對應目標</th><th>認知層次</th></tr></thead>
      <tbody>${buildAuditRows(state.items).map((row) => `<tr><td>${escapeHtml(row.itemId)}</td><td>${escapeHtml(row.questionType)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml(row.objectiveIds)}</td><td>${escapeHtml(row.cognitiveLevel)}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="actions"><button data-next-step="7">前往輸出</button></div>
  </section>`;
}

function renderOutput() {
  const project = { ...state.project, examName: examTitle() };
  const studentPaper = renderStudentPaper({ project, sections: state.sections, items: state.items });
  const teacherPaper = renderTeacherPaper({ project, sections: state.sections, items: state.items });
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
  const label = busyLabel || "AI 處理中，請稍候……";
  return `<div class="notice loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>${escapeHtml(label)}</div>`;
}

function render() {
  app.innerHTML = `${renderSteps()}${renderBusyBanner()}${renderMessages()}${renderCurrentStep()}`;
}

app.addEventListener("input", (event) => {
  const projectField = event.target.dataset.project;
  const field = event.target.dataset.field;
  const itemField = event.target.dataset.itemField;
  const itemId = event.target.dataset.itemId;
  const planField = event.target.dataset.planField;
  const planIndex = event.target.dataset.planIndex;

  if (planField && planIndex !== undefined) {
    const index = Number(planIndex);
    if (state.planRows[index]) {
      const value = planField === "questionType" ? event.target.value : Number(event.target.value);
      state.planRows[index] = { ...state.planRows[index], [planField]: value };
    }
    return;
  }

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
  if (action === "extract-objectives") extractObjectives();
  if (action === "build-blueprint") buildBlueprint();
  if (action === "generate-items") generateItems();
  if (action === "regenerate-item") regenerateItem(actionButton.dataset.itemId);
  if (action === "add-plan-row") {
    const subject = state.planSubject || state.project.subject;
    const options = getQuestionTypeOptions(subject);
    setState({ planRows: [...state.planRows, { questionType: options[0], count: 5, score: 2 }] });
  }
  if (action === "remove-plan-row") {
    const index = Number(actionButton.dataset.planIndex);
    setState({ planRows: state.planRows.filter((_, currentIndex) => currentIndex !== index) });
  }
});

// 配題表的題型/題數/配分或科目改變時（blur 觸發），重繪以更新小計與合計。
app.addEventListener("change", (event) => {
  if (event.target.dataset.planField || event.target.dataset.field === "planSubject" || event.target.dataset.field === "objectiveInput") {
    render();
  }
});

render();
