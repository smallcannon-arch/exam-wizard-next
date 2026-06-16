import { createInitialState } from "./state.js";
import { makeObjectiveId } from "./core/ids.js";
import { summarizeScoreByObjective } from "./core/scoring.js";
import { buildItemSlots, buildSectionsByQuestionType } from "./core/blueprint.js";
import { buildPlanSequences, getPlanTotals, validatePlan } from "./core/plan.js";
import { getQuestionTypeOptions, SUBJECT_OPTIONS } from "./core/questionTypes.js";
import { validateExam } from "./core/validation.js";
import { replaceItemById } from "./core/replaceItem.js";
import { renderStudentPaper, renderTeacherPaper } from "./core/renderPaper.js";
import { generateItemsViaApi, regenerateItemViaApi, extractObjectivesViaApi } from "./apiClient.js";
import { parseObjectiveInput, normalizeExtractedObjectives, objectivesToInputText } from "./core/objectives.js";
import { computeObjectiveShares, formatPercent } from "./core/periods.js";
import { largestRemainder } from "./core/distribute.js";
import { getApiBaseUrl } from "./config.js";
import { validateGeneratedPaper } from "./core/validateGeneratedPaper.js";
import { buildAuditRows } from "./core/auditRows.js";
import { renderAuditTable } from "./core/renderAuditTable.js";

// 目標提取 Gem（沿用現有連結）；教材提取 Gem 建立後，把網址填到 GEM_MATERIAL_URL。
const GEM_OBJECTIVES_URL = "https://gemini.google.com/gem/1Xd6a-3N4dZvvzC7TdgP1yBjAa2IXDUFb?usp=sharing";
const GEM_MATERIAL_URL = "https://gemini.google.com/gem/17PYExL91vSTPiO90za0kEuEjZyG6LxcF?usp=sharing";

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

// 從目標文字最前面抽出學習指標編號（如 3-1、3-1-1）；沒有就回傳空字串。
function splitObjectiveCode(text) {
  const match = String(text || "").match(/^\s*([0-9]+(?:[-－.][0-9]+)+)[\s、.:：]*(.*)$/);
  if (match) return { code: match[1].replace(/[－.]/g, "-"), label: match[2].trim() || match[1] };
  return { code: "", label: String(text || "").trim() };
}

function renderObjectivePreview() {
  const objectives = parseObjectives(state.objectiveInput);
  if (objectives.length === 0) return "";

  const totalScore = getPlanTotals(state.planRows).totalScore;
  const totalPeriods = objectives.reduce((sum, objective) => sum + (Number(objective.periodCount) || 0), 0);
  const scoreById = objectiveScoresByPeriod(objectives, totalScore);

  const rows = objectives.map((objective, index) => {
    const { code, label } = splitObjectiveCode(objective.text);
    return `<tr>
      <td>${escapeHtml(code || index + 1)}</td>
      <td>${escapeHtml(label)}</td>
      <td class="num">${escapeHtml(objective.periodCount)} 節</td>
      <td class="num">${escapeHtml(scoreById.get(objective.objectiveId) || 0)} 分</td>
    </tr>`;
  }).join("");

  return `
    <h3>目標配分預覽（依節數比例）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>指標編號</th><th>學習指標／單元</th><th class="num">授課節數</th><th class="num">目標配分</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td><strong>合計</strong></td><td class="num"><strong>${totalPeriods} 節</strong></td><td class="num"><strong>${totalScore} 分</strong></td></tr></tfoot>
    </table></div>
  `;
}

function parseObjectives(input) {
  return parseObjectiveInput(input).map((objective, index) => ({
    objectiveId: makeObjectiveId(index + 1),
    unitName: objective.unitName || "未分單元",
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
    step: 3,
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
  busyLabel = "AI 正在生成整卷試題，題目較多時可能要 30 秒以上，請耐心等候，不要關閉或重整……";
  setState({ errors: [], messages: [] });

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
    messages: ["AI 回傳的試卷題型或配分被更動、或有缺漏，尚未匯入。請重新生成。"],
  });
  return;
}

// 補齊 objectiveIds（AI 有時只回 primaryObjectiveId），避免後續檢核誤判缺漏。
const importedItems = result.items.map((item) => ({
  ...item,
  objectiveIds: (Array.isArray(item.objectiveIds) && item.objectiveIds.length > 0)
    ? item.objectiveIds
    : (item.primaryObjectiveId ? [item.primaryObjectiveId] : []),
}));

const sectionResult = buildSectionsByQuestionType({
  items: importedItems,
  typeOrder: state.planRows.map((row) => row.questionType),
});
const sections = sectionResult.ok
  ? sectionResult.sections
  : [{ sectionId: "S-01", order: 1, title: "試題", layoutMode: "sequential", itemIds: importedItems.map((item) => item.itemId) }];

setState({
  items: importedItems,
  sections,
  errors: [],
  messages: [
    `已產生 ${importedItems.length} 題正式草稿（AI 已依節數比例與整卷整體性編排）。`,
    ...(generatedCheck.warnings || []),
  ],
  step: 4,
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

// 一鍵整理：用本機智慧解析，把貼上的雜亂指標轉成標準格式（含編號與節數）填回欄位。
function organizeObjectives() {
  const parsed = parseObjectiveInput(state.objectiveInput);
  if (parsed.length === 0) {
    setState({ errors: ["沒有可整理的內容，請先把 LLM／Gem 抓回的指標貼進「學習目標」欄。"], messages: [] });
    return;
  }
  state.objectiveInput = parsed
    .map((objective) => `${objective.text}｜${toPositiveIntegerSafe(objective.periodCount)}`)
    .join("\n");
  setState({ errors: [], messages: [`已整理出 ${parsed.length} 個學習指標，請確認下方預覽，沒問題就往下建立藍圖。`] });
}

function toPositiveIntegerSafe(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 1;
}

async function regenerateItem(itemId) {
  const originalItem = state.items.find((item) => item.itemId === itemId);
  if (!originalItem) return;

  const reason = window.prompt(`請輸入 ${itemId} 重出理由`, "題意不夠清楚，請換一個生活情境。");
  if (reason === null) return;

  busy = true;
  busyItemId = itemId;
  busyLabel = `AI 正在重新設計 ${itemId}，請稍候……`;
  setState({ errors: [], messages: [] });

  try {
    const objectiveIds = new Set(originalItem.objectiveIds || []);
    const relatedObjectives = state.objectives.filter((objective) => objectiveIds.has(objective.objectiveId));
    const result = await regenerateItemViaApi({
      apiBaseUrl: getApiBaseUrl(),
      project: state.project,
      materialText: state.materialText,
      objectives: relatedObjectives.length > 0 ? relatedObjectives : state.objectives,
      originalItem,
      reason: reason.trim() || "請重新設計此題，避免只是改寫原題。",
    });

    if (!result?.ok || !Array.isArray(result.items) || result.items.length !== 1) {
      setState({ errors: [result?.error || "AI 重出回傳格式錯誤。"], messages: [] });
      return;
    }

    const newItem = result.items[0];
    const hasText = (value) => typeof value === "string" && value.trim() !== "";
    if (!hasText(newItem.question) || !hasText(newItem.answer)) {
      setState({ errors: [`${itemId}：AI 重出的題幹或答案是空的，未替換。請再試一次。`], messages: [] });
      return;
    }

    const replacement = replaceItemById({
      items: state.items,
      itemId,
      regeneratedItem: newItem,
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
  // 直接就地更新，不重繪整頁，避免修題時 textarea/input 失焦。
  const target = state.items.find((item) => item.itemId === itemId);
  if (target) target[field] = value;
}

function updateItemOption(itemId, optionIndex, value) {
  const target = state.items.find((item) => item.itemId === itemId);
  if (target && Array.isArray(target.options) && optionIndex >= 0 && optionIndex < target.options.length) {
    target.options[optionIndex] = value;
  }
}

async function scanFilesFromEntry(entry) {
  const files = [];
  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve));
    files.push(file);
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const readAllEntries = async () => {
      const all = [];
      while (true) {
        const batch = await new Promise((resolve) => reader.readEntries(resolve));
        if (batch.length === 0) break;
        all.push(...batch);
      }
      return all;
    };
    const entries = await readAllEntries();
    for (const subEntry of entries) {
      const subFiles = await scanFilesFromEntry(subEntry);
      files.push(...subFiles);
    }
  }
  return files;
}

function handleSelectedFiles(files) {
  const allowedExtensions = [".pdf", ".docx"];
  const filtered = files.filter((file) => {
    const name = file.name.toLowerCase();
    if (name.includes("~$")) return false; // exclude word temp files
    return allowedExtensions.some(ext => name.endsWith(ext));
  });

  if (filtered.length === 0) {
    setState({ errors: ["未偵測到符合格式的檔案（支援 .pdf 與 .docx）。"], messages: [] });
    return;
  }

  // 自動勾選比較有可能是教材的檔案（如含有形音、句型、課文等關鍵字）
  const relevantKeywords = ["形音", "句型", "課文", "大意", "目標", "閱讀"];
  state.scannedFiles = filtered.map((file) => {
    const isRelevant = relevantKeywords.some(keyword => file.name.includes(keyword));
    return { file, checked: isRelevant || filtered.length <= 4 };
  });

  setState({ errors: [], messages: [`已成功讀取 ${filtered.length} 個備課檔案，請於下方勾選並開始提取。`] });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

async function extractObjectives() {
  const selected = (state.scannedFiles || []).filter(sf => sf.checked);
  if (selected.length === 0) {
    setState({ errors: ["請先選取至少一個要提取的教材檔案。"], messages: [] });
    return;
  }

  if (selected.length > 5) {
    setState({ errors: ["因 AI Token 限制，一次最多只能勾選 5 個檔案提取。"], messages: [] });
    return;
  }

  busy = true;
  busyItemId = null;
  busyLabel = "AI 正在從教材中提取學習目標與教材摘要，大約需要 15~20 秒，請稍候……";
  setState({ errors: [], messages: [] });

  try {
    const filesData = await Promise.all(selected.map(async (sf) => {
      const base64 = await fileToBase64(sf.file);
      return {
        name: sf.file.name,
        mimeType: sf.file.type || "application/pdf",
        data: base64,
      };
    }));

    const result = await extractObjectivesViaApi({
      apiBaseUrl: getApiBaseUrl(),
      project: state.project,
      materialText: state.materialText,
      files: filesData,
    });

    if (!result?.ok || !Array.isArray(result.objectives)) {
      setState({ errors: [result?.error || "AI 提取目標回傳錯誤。"], messages: [] });
      return;
    }

    const objectives = normalizeExtractedObjectives(result.objectives);
    if (objectives.length === 0) {
      setState({ errors: ["AI 未能從上傳檔案中提取到任何學習目標。"], messages: [] });
      return;
    }

    state.objectiveInput = objectivesToInputText(objectives);
    
    // 將教材重點彙整成文字存放在教材摘要中
    const summary = `已從以下檔案自動提取要素：\n${selected.map(sf => `・${sf.file.name}`).join("\n")}`;
    
    setState({
      errors: [],
      messages: [`成功！AI 已自動提取出 ${objectives.length} 個學習目標，並自動產生教材大意。`],
      materialText: summary,
    });
  } catch (error) {
    setState({
      errors: [
        `AI 提取教材目標失敗：${error?.message || String(error)}`,
        `請確認後端 Worker 是否仍在 ${getApiBaseUrl()} 執行。`,
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

function renderMessages() {
  return [
    ...state.messages.map((message) => `<div class="notice success">${escapeHtml(message)}</div>`),
    ...state.errors.map((error) => `<div class="notice error">${escapeHtml(error)}</div>`),
  ].join("");
}

function renderSteps() {
  const labels = ["建卷", "目標", "藍圖", "修題", "檢核", "輸出"];
  return `<nav class="step-list">${labels.map((label, index) => `
    <button class="step-button ${state.step === index + 1 ? "active" : ""}" data-step="${index + 1}">${index + 1}. ${label}</button>
  `).join("")}</nav>`;
}

function renderStep1() {
  return `<section class="panel">
    <div class="grid">
      <label class="field-lg">學校名稱<input data-project="schoolName" value="${escapeHtml(state.project.schoolName)}"></label>
      <label class="field-lg">學年度<input data-project="schoolYear" placeholder="請輸入學年度" value="${escapeHtml(state.project.schoolYear)}"></label>
      <label class="field-lg">學期
        <select data-project="semester">
          <option value="" ${!state.project.semester ? "selected" : ""}>請選擇</option>
          ${["第1學期", "第2學期"].map((option) => `<option value="${option}" ${option === state.project.semester ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
      <label class="field-lg">評量次數
        <select data-project="examType">
          <option value="" ${!state.project.examType ? "selected" : ""}>請選擇</option>
          ${["期中考", "期末考"].map((option) => `<option value="${option}" ${option === state.project.examType ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
      <label class="field-lg">科目
        <select data-project="subject">
          <option value="" ${!state.project.subject ? "selected" : ""}>請選擇</option>
          ${["國語", "數學", "社會", "自然", "英文"].map((option) => `<option value="${option}" ${option === state.project.subject ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
      <label class="field-lg">年級
        <select data-project="grade">
          <option value="" ${!state.project.grade ? "selected" : ""}>請選擇</option>
          ${["一年級", "二年級", "三年級", "四年級", "五年級", "六年級"].map((option) => `<option value="${option}" ${option === state.project.grade ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
      <label class="field-lg">命題教師<input data-project="teacherName" value="${escapeHtml(state.project.teacherName)}"></label>
      <label class="field-lg">版本<input data-project="version" value="${escapeHtml(state.project.version)}"></label>
      <label class="field-lg" style="grid-column: span 2;">評量範圍<input data-project="range" placeholder="請輸入單元範圍（例如：第3單元、第4單元）" value="${escapeHtml(state.project.range)}"></label>
    </div>
    ${renderPlanTable()}
    <div class="actions"><button data-next-step="2">下一步</button></div>
  </section>`;
}

function renderPlanTable() {
  const subject = state.project.subject;
  const baseOptions = getQuestionTypeOptions(subject);
  const totals = getPlanTotals(state.planRows);

  const rowsHtml = state.planRows.map((row, index) => {
    const options = baseOptions.includes(row.questionType) ? baseOptions : [...baseOptions, row.questionType];
    const optionHtml = options
      .map((type) => `<option value="${escapeHtml(type)}" ${type === row.questionType ? "selected" : ""}>${escapeHtml(type)}</option>`)
      .join("");
    const subtotal = (Number(row.count) || 0) * (Number(row.score) || 0);
    const isGroup = row.questionType === "學力檢測題";
    const groupHint = isGroup 
      ? `<div style="font-size:11.5px; color:var(--primary); margin-top:4px; font-weight:600; line-height:1.3;">💡 題組形式：將自動拆解為 2~4 個子題均分此分數</div>`
      : "";
    return `<tr>
      <td><select data-plan-field="questionType" data-plan-index="${index}">${optionHtml}</select>${groupHint}</td>
      <td><input type="number" min="1" data-plan-field="count" data-plan-index="${index}" value="${escapeHtml(row.count)}"></td>
      <td><input type="number" min="1" data-plan-field="score" data-plan-index="${index}" value="${escapeHtml(row.score)}"></td>
      <td>${escapeHtml(subtotal)}分</td>
      <td><button class="secondary" data-action="remove-plan-row" data-plan-index="${index}">刪除</button></td>
    </tr>`;
  }).join("");

  return `
    <h3>配題表（題型／題數／配分）</h3>
    <p class="notice">
      題型清單已依您的學科「${escapeHtml(subject || "預設")}」自動篩選。<br>
      <strong>💡 溫馨提示</strong>：含「學力檢測題」項目為情境素養題組。AI 會自動將其拆解為 2 ~ 4 個子題，並將配分（如 5 分）由子題均分（如 2 分與 3 分），因此您在此階段可以放心為其配置較高的每題分數！
    </p>
    <div class="table-wrap"><table>
      <thead><tr><th>題型</th><th>題數</th><th>每題(答)配分</th><th>小計</th><th></th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
    <div class="actions"><button class="secondary" data-action="add-plan-row">＋ 新增一列</button></div>
    <p class="notice ${totals.totalItems > 0 ? "success" : ""}">合計：${totals.totalItems} 題、${totals.totalScore} 分（即本卷總分）</p>
  `;
}

function renderStep2() {
  const isChinese = (state.project.subject === "國語");

  let topGuideHtml = "";
  if (isChinese) {
    const filesListHtml = (state.scannedFiles || []).length > 0
      ? `<h3>已偵測到的教材檔案（請勾選本次要命題的課次）：</h3>
         <div class="file-checkbox-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--line); padding: 10px; border-radius: 12px; margin-bottom: 12px; background: #fafafa;">
           ${(state.scannedFiles || []).map((sf, index) => `
             <label class="file-checkbox-row" style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:14px; cursor:pointer; color:var(--muted);">
               <input type="checkbox" data-file-index="${index}" ${sf.checked ? "checked" : ""} style="width:auto; margin:0;">
               <span>${escapeHtml(sf.file.name)} (${Math.round(sf.file.size / 1024)} KB)</span>
             </label>
           `).join("")}
         </div>
         <div class="actions" style="margin-bottom:16px;">
           <button data-action="extract-objectives" ${busy ? "disabled" : ""}>🚀 開始 AI 一鍵提取目標與教材</button>
         </div>`
      : "";

    topGuideHtml = `
      <div class="notice">
        <strong>💡 智慧匯入大補帖（推薦）：</strong>
        <p style="margin:6px 0 0;">拖曳或選取整份廠商備課資料夾（如 <code>1.備課資料</code> ➔ <code>05形音輕鬆學</code> 或 <code>08各課短語句型</code> 的 PDF 資料夾），系統會自動過濾篩選並用 AI 一鍵填入下方的目標與摘要。</p>
        <p style="margin:6px 0 0; font-size:13px; color:var(--muted);">您也可以使用手動方式，透過 ${gemLink(GEM_OBJECTIVES_URL, "「目標提取」Gem")} 提取文字貼入下方。</p>
      </div>
      <div class="drop-zone" id="dropZone" style="border: 2px dashed var(--line); border-radius: 18px; padding: 24px; text-align: center; cursor: pointer; color: var(--muted); background: var(--blue-soft); transition: all 0.2s; margin-bottom: 16px;">
        <span class="drop-zone-prompt" style="font-weight:600; display:block; margin-bottom:6px;">📂 拖曳備課資料夾或 PDF 檔案至此，或點擊此處選取</span>
        <span style="font-size:13px;">（建議優先選擇廠商提供的「形音輕鬆學」或「短語型練習」PDF）</span>
        <input type="file" id="fileInput" webkitdirectory directory multiple style="display: none;">
        <input type="file" id="fileInputFiles" multiple accept=".pdf,.docx" style="display: none;">
      </div>
      ${filesListHtml}
      ${loadingLine()}
      <hr style="border:0; border-top:1px solid var(--line); margin:24px 0;">
    `;
  } else {
    topGuideHtml = `
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
    `;
  }

  return `<section class="panel">
    <h2>② 學習目標</h2>
    ${topGuideHtml}
    <label>學習目標（把 LLM／Gem 抓回 the 指標整段貼進來即可）<textarea data-field="objectiveInput">${escapeHtml(state.objectiveInput)}</textarea></label>
    <p class="notice">貼好後按「整理學習目標」，系統會把它整理成帶編號與節數的標準格式（見下方預覽），可再手動微調。</p>
    <div class="actions">
      <button data-action="organize-objectives">整理學習目標</button>
    </div>
    ${renderObjectivePreview()}
    <label>教材摘要（選填）<textarea data-field="materialText">${escapeHtml(state.materialText)}</textarea></label>
    <p class="notice">用途：作為 AI 出題的依據。建議貼上課本／習作重點（國語：生字、語詞、句型、課文重點；其他科：核心概念與重要詞彙）。留空也可以，AI 會只依學習目標出題。</p>
    <div class="actions">
      <button data-action="build-blueprint">確認目標，建立配題與藍圖</button>
    </div>
  </section>`;
}

function renderStep3Or4() {
  const targets = state.objectiveTargets || [];
  const intents = state.intents;
  const planRows = state.planRows;
  return `<section class="panel">
    <h2>③ 配題與藍圖</h2>
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
    <p class="notice" style="margin-bottom:12px;">您可以自由勾選特定題號為「題組」，並設定其子題數量。非選擇題型亦可設定為題組。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>題型</th><th>配分</th><th>題組與子題設定</th></tr></thead>
      <tbody>${intents.slice(0, 80).map((slot, index) => {
        const isGroup = !!slot.isGroup;
        const rowStyle = isGroup ? `style="background: #f0f7ff; border-left: 4px solid var(--blue);"` : "";
        const typeLabel = slot.questionType === "學力檢測題"
          ? `${escapeHtml(slot.questionType)} <span style="background:var(--blue); color:#fff; font-size:11px; padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:600; display:inline-block; vertical-align:middle;">情境題組</span>`
          : escapeHtml(slot.questionType);
        return `<tr ${rowStyle}>
          <td style="font-weight:${isGroup ? "bold" : "normal"};">${escapeHtml(slot.itemId)}</td>
          <td>${typeLabel}</td>
          <td>${escapeHtml(slot.score)}分</td>
          <td>
            <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; margin:0; font-size:14px; color:var(--ink);">
              <input type="checkbox" data-slot-index="${index}" data-slot-field="isGroup" ${isGroup ? "checked" : ""} style="width:auto; margin:0;">
              <span>合併為題組</span>
            </label>
            <select data-slot-index="${index}" data-slot-field="subCount" style="width:auto; display:inline-block; padding:2px 6px; font-size:13px; margin-left:12px; height:28px; border-radius:6px;" ${!isGroup ? "disabled" : ""}>
              <option value="2" ${slot.subCount === 2 ? "selected" : ""}>2 個子題</option>
              <option value="3" ${slot.subCount === 3 || !slot.subCount ? "selected" : ""}>3 個子題</option>
              <option value="4" ${slot.subCount === 4 ? "selected" : ""}>4 個子題</option>
            </select>
          </td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    <div class="actions">
      <button data-action="generate-items" ${busy ? "disabled" : ""}>${busy ? "AI 生成中……" : "連線 AI 生成正式草稿"}</button>
    </div>
    ${loadingLine()}
  </section>`;
}

function renderItems() {
  const summary = summarizeScoreByObjective(state.items);
  const cardsHtml = [];
  const renderedGroups = new Set();

  for (let i = 0; i < state.items.length; i++) {
    const item = state.items[i];
    const groupId = item.groupId;

    const getChineseDimSelect = (subItem) => {
      if (state.project.subject !== "國語") return "";
      return `<label style="display:block; margin-top:8px;">評量向度
        <select data-item-field="chineseDimension" data-item-id="${escapeHtml(subItem.itemId)}">
          <option value="字詞短語" ${subItem.chineseDimension === "字詞短語" ? "selected" : ""}>字詞短語</option>
          <option value="句式語法" ${subItem.chineseDimension === "句式語法" ? "selected" : ""}>句式語法</option>
          <option value="段篇讀寫" ${subItem.chineseDimension === "段篇讀寫" ? "selected" : ""}>段篇讀寫</option>
        </select>
      </label>`;
    };

    if (groupId) {
      if (renderedGroups.has(groupId)) continue;
      renderedGroups.add(groupId);

      const groupItems = state.items.filter((x) => x.groupId === groupId);
      const firstItem = groupItems[0];
      const subCardsHtml = groupItems.map((subItem) => {
        const subId = subItem.itemId;
        return `<div class="sub-item-edit" style="border-top:1px dashed var(--line); padding-top:16px; margin-top:16px;">
          <div class="item-meta" style="font-weight:600; color:var(--primary); margin-bottom:8px;">
            子題號：${escapeHtml(subId)} ｜ 配分：${escapeHtml(subItem.score)}分 ｜ 對應目標：${escapeHtml(subItem.objectiveIds?.join("、") || subItem.primaryObjectiveId || "未標示")} ｜ 層次：${escapeHtml(subItem.cognitiveLevel || "未標示")}
          </div>
          <label>子題幹<textarea data-item-field="question" data-item-id="${escapeHtml(subId)}">${escapeHtml(subItem.question)}</textarea></label>
          ${Array.isArray(subItem.options) && subItem.options.length > 0 ? `<div class="options-edit"><span class="options-label">選項</span>${subItem.options.map((option, optionIndex) => `<label class="option-row">(${String.fromCharCode(65 + optionIndex)})<input data-item-field="option" data-item-id="${escapeHtml(subId)}" data-option-index="${optionIndex}" value="${escapeHtml(option)}"></label>`).join("")}</div>` : ""}
          <label>答案<input data-item-field="answer" data-item-id="${escapeHtml(subId)}" value="${escapeHtml(subItem.answer)}"></label>
          <label>解析<textarea data-item-field="explanation" data-item-id="${escapeHtml(subId)}">${escapeHtml(subItem.explanation)}</textarea></label>
          ${getChineseDimSelect(subItem)}
          <div class="actions" style="margin-top:8px;">
            <button data-action="regenerate-item" data-item-id="${escapeHtml(subId)}" ${busy ? "disabled" : ""}>${busy && busyItemId === subId ? "AI 重出中……" : "AI 重出子題"}</button>
          </div>
        </div>`;
      }).join("");

      cardsHtml.push(`<article class="item-card group-card" style="border: 2px solid var(--primary); background: #fcfdfe; border-radius:16px; padding:20px; margin-bottom:20px;">
        <div class="item-meta" style="font-size:15px; font-weight:bold; color:var(--dark); margin-bottom:12px; border-bottom: 2px solid var(--line); padding-bottom:6px;">
          📦 題組：${escapeHtml(groupId)} ｜ 總配分：${groupItems.reduce((s, x) => s + Number(x.score || 0), 0)}分
        </div>
        <label><strong>情境引言 (Stimulus)</strong><textarea data-group-stimulus="${escapeHtml(groupId)}" style="background:var(--blue-soft); font-weight:500; min-height:100px;">${escapeHtml(firstItem.stimulus || "")}</textarea></label>
        ${subCardsHtml}
      </article>`);
    } else {
      cardsHtml.push(`<article class="item-card" style="border-radius:16px; padding:20px; margin-bottom:20px;">
        <div class="item-meta">${escapeHtml(item.itemId)}｜${escapeHtml(item.questionType)}｜${escapeHtml(item.score)}分｜對應目標 ${escapeHtml(item.objectiveIds?.join("、") || item.primaryObjectiveId || "未標示")}｜層次 ${escapeHtml(item.cognitiveLevel || "未標示")}</div>
        <label>題幹<textarea data-item-field="question" data-item-id="${escapeHtml(item.itemId)}">${escapeHtml(item.question)}</textarea></label>
        ${Array.isArray(item.options) && item.options.length > 0 ? `<div class="options-edit"><span class="options-label">選項</span>${item.options.map((option, optionIndex) => `<label class="option-row">(${String.fromCharCode(65 + optionIndex)})<input data-item-field="option" data-item-id="${escapeHtml(item.itemId)}" data-option-index="${optionIndex}" value="${escapeHtml(option)}"></label>`).join("")}</div>` : ""}
        <label>答案<input data-item-field="answer" data-item-id="${escapeHtml(item.itemId)}" value="${escapeHtml(item.answer)}"></label>
        <label>解析<textarea data-item-field="explanation" data-item-id="${escapeHtml(item.itemId)}">${escapeHtml(item.explanation)}</textarea></label>
        ${getChineseDimSelect(item)}
        <div class="actions">
          <button data-action="regenerate-item" data-item-id="${escapeHtml(item.itemId)}" ${busy ? "disabled" : ""}>${busy && busyItemId === item.itemId ? "AI 重出中……" : "AI 重出此題"}</button>
        </div>
      </article>`);
    }
  }

  return `<section class="panel">
    <h2>④ 修題定稿</h2>
    <p class="notice">這裡沒有備選池。題目就是正式草稿；不滿意的題目，直接重出該題。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th>計分單位數</th><th>分數</th></tr></thead>
      <tbody>${summary.map((row) => `<tr><td>${row.objectiveId}</td><td>${row.unitCount}</td><td>${row.score}</td></tr>`).join("")}</tbody>
    </table></div>
    ${cardsHtml.join("")}
    ${loadingLine()}
    <div class="actions"><button data-next-step="5">前往檢核</button></div>
  </section>`;
}

function renderAudit() {
  // 以配題表的總分作為預期總分，才能真的檢查「題目總分是否符合預期」。
  const examTotal = getPlanTotals(state.planRows).totalScore || state.items.reduce((sum, item) => sum + (Number(item?.score) || 0), 0);
  const result = validateExam({
    objectives: state.objectives,
    objectivePlans: state.objectivePlans,
    items: state.items,
    totalScore: examTotal,
  });

  return `<section class="panel">
    <h2>⑤ 檢核</h2>
    <div class="notice ${result.ok ? "success" : "error"}">${result.ok ? "基本檢核通過。仍請人工確認題意、答案與解析。" : "發現錯誤，請先修正。"}</div>
    ${result.errors.length ? `<h3>錯誤</h3><ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : ""}
    ${result.warnings.length ? `<h3>提醒</h3><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
    <h3>目標配分統計（實際 vs 預估）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>目標</th><th class="num">題數</th><th class="num">實際配分</th><th class="num">預估配分</th></tr></thead>
      <tbody>${(() => {
        const targets = state.objectiveTargets || [];
        const actualById = new Map(result.summary.map((row) => [row.objectiveId, row]));
        const rows = targets.length > 0
          ? targets.map((target) => {
              const actual = actualById.get(target.objectiveId);
              return { objectiveId: target.objectiveId, unitCount: actual?.unitCount || 0, score: actual?.score || 0, target: target.targetScore };
            })
          : result.summary.map((row) => ({ ...row, target: null }));
        return rows.map((row) => {
          const off = row.target != null && row.score !== row.target;
          return `<tr><td>${escapeHtml(row.objectiveId)}</td><td class="num">${escapeHtml(row.unitCount)}</td><td class="num"${off ? ' style="color:var(--danger)"' : ""}>${escapeHtml(row.score)}</td><td class="num">${row.target != null ? escapeHtml(row.target) : "—"}</td></tr>`;
        }).join("");
      })()}</tbody>
    </table></div>
    <h3>逐題審核表</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>題型</th><th>配分</th><th>對應目標</th><th>認知層次</th></tr></thead>
      <tbody>${buildAuditRows(state.items).map((row) => `<tr><td>${escapeHtml(row.itemId)}</td><td>${escapeHtml(row.questionType)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml(row.objectiveIds)}</td><td>${escapeHtml(row.cognitiveLevel)}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="actions"><button data-next-step="6">前往輸出</button></div>
  </section>`;
}

function renderOutput() {
  const project = { ...state.project, examName: examTitle() };
  const studentPaper = renderStudentPaper({ project, sections: state.sections, items: state.items });
  const teacherPaper = renderTeacherPaper({ project, sections: state.sections, items: state.items });
  const auditTableHtml = renderAuditTable({
    project,
    objectives: state.objectives,
    items: state.items,
    planRows: state.planRows,
    sections: state.sections,
  });

  return `<section class="panel">
    <h2>⑥ 輸出</h2>
    
    <div class="actions" style="margin-bottom: 24px;">
      <button onclick="window.print()" style="font-weight:600; padding:12px 24px; font-size:16px;">🖨️ 列印試題審核表 (A4 自動排版)</button>
    </div>

    <div id="auditTablePrintArea" class="audit-table-container" style="background:#fff; border:1px solid var(--line); border-radius:18px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.04); margin-bottom:32px; overflow-x:auto;">
      ${auditTableHtml}
    </div>

    <hr style="border:0; border-top:1px solid var(--line); margin:32px 0;">

    <h3>學生卷</h3>
    <pre>${escapeHtml(studentPaper)}</pre>
    <h3>教師卷</h3>
    <pre>${escapeHtml(teacherPaper)}</pre>
  </section>`;
}

function renderCurrentStep() {
  if (state.step === 1) return renderStep1();
  if (state.step === 2) return renderStep2();
  if (state.step === 3) return renderStep3Or4();
  if (state.step === 4) return renderItems();
  if (state.step === 5) return renderAudit();
  if (state.step === 6) return renderOutput();
  return renderStep1();
}

// 顯示在動作按鈕下方的進行中提示（取代原本最上方的橫幅）。
function loadingLine() {
  if (!busy) return "";
  const label = busyLabel || "AI 處理中，請稍候……";
  return `<div class="notice loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>${escapeHtml(label)}</div>`;
}

function render() {
  app.innerHTML = `${renderSteps()}${renderMessages()}${renderCurrentStep()}`;
}

app.addEventListener("input", (event) => {
  const projectField = event.target.dataset.project;
  const field = event.target.dataset.field;
  const itemField = event.target.dataset.itemField;
  const itemId = event.target.dataset.itemId;
  const planField = event.target.dataset.planField;
  const planIndex = event.target.dataset.planIndex;
  const groupStimulus = event.target.dataset.groupStimulus;

  if (groupStimulus) {
    state.items.forEach((item) => {
      if (item.groupId === groupStimulus) {
        item.stimulus = event.target.value;
      }
    });
    return;
  }

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

  if (itemField === "option" && itemId && event.target.dataset.optionIndex !== undefined) {
    updateItemOption(itemId, Number(event.target.dataset.optionIndex), event.target.value);
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
  const selectFilesBtn = event.target.closest("#btnSelectFiles");
  const selectFolderBtn = event.target.closest("#btnSelectFolder");
  const dropZone = event.target.closest("#dropZone");

  if (selectFilesBtn) {
    event.stopPropagation();
    const fileInputFiles = document.getElementById("fileInputFiles");
    if (fileInputFiles) fileInputFiles.click();
    return;
  }

  if (selectFolderBtn) {
    event.stopPropagation();
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.click();
    return;
  }

  if (dropZone) {
    const fileInputFiles = document.getElementById("fileInputFiles");
    if (fileInputFiles) fileInputFiles.click();
    return;
  }

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
  if (action === "organize-objectives") organizeObjectives();
  if (action === "build-blueprint") buildBlueprint();
  if (action === "generate-items") generateItems();
  if (action === "regenerate-item") regenerateItem(actionButton.dataset.itemId);
  if (action === "extract-objectives") extractObjectives();
  if (action === "add-plan-row") {
    const subject = state.project.subject;
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
  const slotField = event.target.dataset.slotField;
  const slotIndex = event.target.dataset.slotIndex;
  if (slotField && slotIndex !== undefined) {
    const index = Number(slotIndex);
    if (state.intents[index]) {
      let value;
      if (slotField === "isGroup") {
        value = event.target.checked;
      } else {
        value = Number(event.target.value);
      }
      const updatedSlot = { ...state.intents[index], [slotField]: value };
      if (slotField === "isGroup") {
        updatedSlot.subCount = value ? (updatedSlot.subCount || 3) : 0;
      }
      state.intents[index] = updatedSlot;
      render();
    }
    return;
  }

  if (event.target.id === "fileInput" || event.target.id === "fileInputFiles") {
    if (event.target.files && event.target.files.length > 0) {
      handleSelectedFiles(Array.from(event.target.files));
    }
    return;
  }

  if (event.target.dataset.fileIndex !== undefined) {
    const index = Number(event.target.dataset.fileIndex);
    if (state.scannedFiles && state.scannedFiles[index]) {
      state.scannedFiles[index].checked = event.target.checked;
      render();
    }
    return;
  }

  const itemField = event.target.dataset.itemField;
  const itemId = event.target.dataset.itemId;
  if (itemField && itemId) {
    if (itemField === "option" && event.target.dataset.optionIndex !== undefined) {
      updateItemOption(itemId, Number(event.target.dataset.optionIndex), event.target.value);
    } else {
      updateItemField(itemId, itemField, event.target.value);
    }
  }

  if (event.target.dataset.planField || event.target.dataset.field === "objectiveInput" || event.target.dataset.project) {
    render();
  }
});

app.addEventListener("dragover", (event) => {
  const dropZone = event.target.closest("#dropZone");
  if (dropZone) {
    event.preventDefault();
    dropZone.style.borderColor = "var(--primary)";
    dropZone.style.background = "var(--blue-light)";
  }
});

app.addEventListener("dragleave", (event) => {
  const dropZone = event.target.closest("#dropZone");
  if (dropZone) {
    dropZone.style.borderColor = "var(--line)";
    dropZone.style.background = "var(--blue-soft)";
  }
});

app.addEventListener("drop", async (event) => {
  const dropZone = event.target.closest("#dropZone");
  if (dropZone) {
    event.preventDefault();
    dropZone.style.borderColor = "var(--line)";
    dropZone.style.background = "var(--blue-soft)";

    const items = event.dataTransfer.items;
    if (!items) return;

    busy = true;
    busyLabel = "正在掃描檔案……";
    render();

    try {
      const filePromises = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            filePromises.push(scanFilesFromEntry(entry));
          }
        }
      }
      const results = await Promise.all(filePromises);
      const files = results.flat();
      handleSelectedFiles(files);
    } catch (err) {
      setState({ errors: [`掃描檔案失敗: ${err.message}`] });
    } finally {
      busy = false;
      busyLabel = "";
      render();
    }
  }
});

render();
