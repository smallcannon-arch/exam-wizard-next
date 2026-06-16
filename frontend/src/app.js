import { createInitialState } from "./state.js";
import { makeObjectiveId } from "./core/ids.js";
import { summarizeScoreByObjective } from "./core/scoring.js";
import { buildItemSlots, buildSectionsByQuestionType, distributeObjectivesToSlots } from "./core/blueprint.js";
import { buildPlanSequences, getPlanTotals, validatePlan } from "./core/plan.js";
import { getQuestionTypeOptions, SUBJECT_OPTIONS, CHINESE_AUDIT_STRUCTURE, getChineseDimension, getChineseSubcategory } from "./core/questionTypes.js";
import { generateExcelXml } from "./core/excelGenerator.js";
import { validateExam } from "./core/validation.js";
import { replaceItemById } from "./core/replaceItem.js";
import { renderStudentPaper, renderTeacherPaper } from "./core/renderPaper.js";
import { generateItemsViaApi, regenerateItemViaApi, extractObjectivesViaApi, normalizeObjectivesViaApi } from "./apiClient.js";
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

  const { questionTypeSequence, scoreSequence, configSequence } = buildPlanSequences(state.planRows);
  const slotResult = buildItemSlots({ questionTypeSequence, scoreSequence, configSequence });
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

  const distributedSlots = distributeObjectivesToSlots(slotResult.slots, objectives, scoreById);
  if (state.project.subject === "國語") {
    distributedSlots.forEach((slot) => {
      slot.chineseDimension = getChineseDimension(slot.questionType);
    });
  }

  setState({
    objectives,
    objectiveTargets,
    objectivePlans: [],
    intents: distributedSlots,
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
      checkedChineseSubcategories: state.checkedChineseSubcategories,
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

// 一鍵整理：用 AI 智慧解析整理學習指標（若失敗則使用本機容錯解析）
async function organizeObjectives() {
  if (!state.objectiveInput || !state.objectiveInput.trim()) {
    setState({ errors: ["沒有可整理的內容，請先把指標貼進「學習目標」欄。"], messages: [] });
    return;
  }

  busy = true;
  busyItemId = null;
  busyLabel = "AI 正在整理學習目標，請稍候……";
  render();

  try {
    const result = await normalizeObjectivesViaApi({
      apiBaseUrl: getApiBaseUrl(),
      text: state.objectiveInput,
    });
    if (result.ok && Array.isArray(result.objectives) && result.objectives.length > 0) {
      state.objectiveInput = objectivesToInputText(result.objectives);
      setState({ errors: [], messages: [`已透過 AI 整理並編序了 ${result.objectives.length} 個學習指標，請確認下方預覽。`] });
      return;
    } else {
      throw new Error(result.error || "API returned empty objectives");
    }
  } catch (err) {
    console.warn("AI 整理失敗，改用本機模式解析：", err);
    const parsed = parseObjectiveInput(state.objectiveInput);
    if (parsed.length === 0) {
      setState({ errors: ["整理學習目標失敗。沒有可辨識的指標，請確認輸入內容。"], messages: [] });
      return;
    }
    state.objectiveInput = objectivesToInputText(parsed);
    setState({ errors: [], messages: [`已透過本機模式整理出 ${parsed.length} 個學習指標（AI 整理暫不可用），請確認下方預覽。`] });
  } finally {
    busy = false;
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
      checkedChineseSubcategories: state.checkedChineseSubcategories,
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
    const fileSummary = `已從以下檔案自動提取要素：\n${selected.map(sf => `・${sf.file.name}`).join("\n")}`;
    const materialSummary = result.materialSummary ? `${fileSummary}\n\n【教材重點摘要】\n${result.materialSummary}` : fileSummary;
    
    setState({
      errors: [],
      messages: [`成功！AI 已自動提取出 ${objectives.length} 個學習目標，並自動產生教材大意。`],
      materialText: materialSummary,
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
  const isChinese = (state.project.subject === "國語");
  const subChecklistHtml = isChinese ? renderChineseSubcategoryChecklist() : "";

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
    ${subChecklistHtml}
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
    const isGroup = !!row.isGroup;
    const subScores = Array.isArray(row.subScores) ? row.subScores : [2, 3];
    const groupScore = subScores.reduce((sum, s) => sum + Number(s) || 0, 0);
    const displayGroupCount = row.groupCount || 1;
    const displaySingleCount = Math.max(0, (Number(row.count) || 0) - displayGroupCount);
    const groupCount = isGroup ? Math.min(Number(row.count) || 0, displayGroupCount) : 0;
    const singleCount = isGroup ? Math.max(0, (Number(row.count) || 0) - groupCount) : Number(row.count) || 0;
    const subtotal = isGroup 
      ? (groupCount * groupScore) + (singleCount * (Number(row.score) || 0))
      : (Number(row.count) || 0) * (Number(row.score) || 0);
    const disabledAttr = isGroup ? "" : "disabled";
    const inputBg = isGroup ? "#fff" : "#eaeaea";
    const inputColor = isGroup ? "#000" : "#999";
    const textColor = isGroup ? "var(--muted)" : "#bbb";
    const totalColor = isGroup ? "var(--primary)" : "#bbb";
    const wrapBg = isGroup ? "transparent" : "#f5f5f5";
    const wrapBorder = isGroup ? "none" : "1px solid #e8e8e8";

    const scoreConfigHtml = `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:nowrap; min-height:38px; font-size:16px; white-space:nowrap; background:${wrapBg}; border:${wrapBorder}; border-radius:10px; padding:${isGroup ? '0' : '4px 12px'}; transition: all 0.2s;">
        <span style="color:${textColor}; font-size:15px;">其中</span>
        <input type="number" min="1" max="${row.count}" data-plan-field="groupCount" data-plan-index="${index}" value="${displayGroupCount}" ${disabledAttr} style="width:60px; padding:6px 8px; text-align:center; height:38px; border-radius:8px; border:1px solid var(--line); margin:0; font-size:16px; background:${inputBg}; color:${inputColor};">
        <span style="color:${textColor}; font-size:15px;">組為題組，每組有</span>
        <select data-plan-field="subCount" data-plan-index="${index}" ${disabledAttr} style="width:auto; display:inline-block; height:38px; font-size:15px; padding:6px 28px 6px 10px; border-radius:8px; border:1px solid var(--line); margin:0; line-height:1; background-position: right 8px center; background-color:${inputBg}; color:${inputColor};">
          <option value="2" ${subScores.length === 2 ? "selected" : ""}>2</option>
          <option value="3" ${subScores.length === 3 ? "selected" : ""}>3</option>
          <option value="4" ${subScores.length === 4 ? "selected" : ""}>4</option>
        </select>
        <span style="color:${textColor}; font-size:15px;">子題（配分：</span>
        <div style="display:inline-flex; align-items:center; gap:4px; margin:0; font-size:15px;">
          ${subScores.map((score, sIdx) => `
            <input type="number" min="1" data-plan-field="subScore" data-plan-index="${index}" data-sub-index="${sIdx}" value="${score}" ${disabledAttr} style="width:48px; padding:4px; text-align:center; height:38px; border-radius:8px; border:1px solid var(--line); margin:0; font-size:15px; background:${inputBg}; color:${inputColor};">
            ${sIdx < subScores.length - 1 ? "<span>+</span>" : ""}
          `).join("")}
          <span style="font-weight:bold; color:${totalColor}; margin-left:6px;">= ${groupScore}分</span>
        </div>
        <span style="color:${textColor}; font-size:15px;">)</span>
        <span style="color:var(--line); margin:0 8px; font-weight:300;">|</span>
        <span style="color:${textColor}; font-size:15px;">其餘 ${displaySingleCount} 題為單題，每題</span>
        <input type="number" min="1" data-plan-field="score" data-plan-index="${index}" value="${escapeHtml(row.score)}" style="width:60px; padding:6px 8px; text-align:center; height:38px; border-radius:8px; border:1px solid var(--line); margin:0; font-size:16px; background:#fff; color:#000;">
        <span style="color:${textColor}; font-size:15px;">分</span>
      </div>
    `;

    return `<tr>
      <td style="vertical-align:middle; text-align:center; padding:12px 8px;"><select data-plan-field="questionType" data-plan-index="${index}" style="margin:0; height:38px; padding:6px 28px 6px 10px; border-radius:8px; border:1px solid var(--line); width:auto; font-size:16px;">${optionHtml}</select></td>
      <td style="vertical-align:middle; text-align:center; padding:12px 8px;">
        <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; margin:0; font-size:16px; font-weight:600; color:var(--dark);">
          <input type="checkbox" data-plan-field="isGroup" data-plan-index="${index}" ${isGroup ? "checked" : ""} style="width:auto; margin:0; transform: scale(1.35); cursor:pointer;">
          <span>題組</span>
        </label>
      </td>
      <td style="vertical-align:middle; text-align:center; padding:12px 8px;"><input type="number" min="1" data-plan-field="count" data-plan-index="${index}" value="${escapeHtml(row.count)}" style="margin:0; height:38px; width:100px; padding:6px 10px; border-radius:8px; border:1px solid var(--line); text-align:center; font-size:16px;"></td>
      <td style="vertical-align:middle; text-align:center; padding:12px 8px;">${scoreConfigHtml}</td>
      <td style="vertical-align:middle; text-align:center; padding:12px 8px;"><strong style="font-size:18px;">${escapeHtml(subtotal)}分</strong></td>
      <td style="vertical-align:middle; text-align:center; padding:12px 8px;"><button class="secondary" data-action="remove-plan-row" data-plan-index="${index}" style="padding:6px 14px; margin:0; font-size:15px; height:38px; font-weight:600; white-space:nowrap;">刪除</button></td>
    </tr>`;
  }).join("");

  return `
    <h3 style="font-size:20px; font-weight:bold; margin-top:24px;">配題表（題型／題數／配分）</h3>
    <p class="notice" style="font-size:15px; line-height:1.6;">
      題型清單已依您的學科「${escapeHtml(subject || "預設")}」自動篩選。<br>
      <strong>💡 溫馨提示</strong>：選取「題組」的項目會被 AI 自動拆解為指定數量的子題，並將該題配分由各子題分配，您在此階段可以放心為其配置較高的分數！
    </p>
    <div class="table-wrap"><table style="font-size:16px;">
      <thead>
        <tr>
          <th style="font-size:16px; padding:10px 8px; width:12%; vertical-align:middle; text-align:center;">題型</th>
          <th style="font-size:16px; padding:10px 8px; width:10%; vertical-align:middle; text-align:center;">組成題組</th>
          <th style="font-size:16px; padding:10px 8px; width:8%; vertical-align:middle; text-align:center;">題數</th>
          <th style="font-size:16px; padding:10px 8px; width:58%; min-width:680px; vertical-align:middle; text-align:center;">每題(答)配分</th>
          <th style="font-size:16px; padding:10px 8px; width:6%; vertical-align:middle; text-align:center;">小計</th>
          <th style="font-size:16px; padding:10px 8px; width:6%; min-width:80px; vertical-align:middle; text-align:center;"></th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
    <div class="actions" style="margin-top:12px;"><button class="secondary" data-action="add-plan-row" style="padding:10px 20px; font-size:16px; font-weight: 600; height: auto;">＋ 新增一列</button></div>
    <p class="notice ${totals.totalItems > 0 ? "success" : ""}" style="font-size:18px; font-weight:bold; padding:14px 20px; margin-top:16px;">合計：${totals.totalItems} 題、${totals.totalScore} 分（即本卷總分）</p>
  `;
}

function renderChineseSubcategoryChecklist() {
  if (state.project.subject !== "國語") return "";

  const checkedSet = new Set(state.checkedChineseSubcategories || []);
  const recs = getMandarinRecommendation(state.project.grade);
  const gradeCategory = getGradeCategory(state.project.grade);
  const categoryLabel = gradeCategory === "low" ? "低年級" : (gradeCategory === "middle" ? "中年級" : (gradeCategory === "high" ? "高年級" : ""));

  const columnsHtml = CHINESE_AUDIT_STRUCTURE.map((dimObj) => {
    const projectHtml = `
      <div class="sub-column-project" style="margin-bottom:36px;">
        <h4 style="margin:0 0 18px; font-size:21px; border-bottom: 2px solid var(--primary); padding-bottom: 10px; color: var(--primary); font-weight: bold;">${dimObj.project}</h4>
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${dimObj.items.map((item) => {
            const checked = checkedSet.has(item);
            return `
              <label class="chinese-sub-label" style="display:inline-flex; align-items:center; gap:14px; font-size:21px; cursor:pointer; margin:0; font-weight:500; color:var(--ink); padding: 8px 12px; border-radius: 8px; transition: background 0.2s;">
                <input type="checkbox" data-chinese-sub="${item}" ${checked ? "checked" : ""} style="width:auto; margin:0; transform: scale(1.75); cursor:pointer;">
                <span>${item}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
    return { dimension: dimObj.dimension, html: projectHtml };
  });

  const dims = ["字詞短語", "句式語法", "段篇讀寫"];
  const gridHtml = dims.map((dim) => {
    const dimHtml = columnsHtml.filter(c => c.dimension === dim).map(c => c.html).join("");
    return `
      <div style="flex:1; min-width:260px; background:#fff; padding:38px; border-radius:20px; border:1px solid var(--line); box-shadow:0 6px 16px rgba(0,0,0,0.02);">
        <h3 style="margin:0 0 28px; font-size:25px; font-weight:bold; color:#111; display:flex; align-items:center; gap:12px;">
          <span style="width:7px; height:28px; background:var(--primary); display:inline-block; border-radius:3px;"></span>
          ${dim}
        </h3>
        ${dimHtml}
      </div>
    `;
  }).join("");

  return `
    <div class="chinese-sub-checklist" style="margin:24px 0; padding:36px; background:var(--blue-soft); border-radius:20px; border:1px solid var(--line);">
      <h3 style="margin:0 0 16px; font-size:24px; font-weight:800; color:var(--dark);">📋 國語科評量項目細項篩選</h3>
      <div style="margin: 16px 0 24px 0; padding: 20px 24px; background: #fff; border: 1px solid var(--line); border-radius: 16px; font-size: 18px; color: #333; line-height: 1.8; text-align: left; box-shadow: 0 4px 10px rgba(0,0,0,0.01);">
        <strong style="font-size: 19px; color: var(--primary);">💡 許育健教授國語科評量向度建議佔分比例：</strong><br>
        • <strong>低年級</strong>（一、二年級）：字詞短語 50% ｜ 句式語法 30% ｜ 段篇讀寫 20%<br>
        • <strong>中年級</strong>（三、四年級）：字詞短語 30% ｜ 句式語法 50% ｜ 段篇讀寫 20%<br>
        • <strong>高年級</strong>（五、六年級）：字詞短語 20% ｜ 句式語法 30% ｜ 段篇讀寫 50%<br>
        <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #eee; font-weight: 600; font-size: 19px;">
          當前設定年級：<span style="color:var(--primary); font-size:20px; font-weight: bold;">${categoryLabel || "（請先選擇年級）"}</span>
          ${categoryLabel ? `➔ 建議比例：字詞短語 <span style="color:var(--primary); font-size:20px;">${recs.character}</span> ｜ 句式語法 <span style="color:var(--primary); font-size:20px;">${recs.grammar}</span> ｜ 段篇讀寫 <span style="color:var(--primary); font-size:20px;">${recs.reading}</span>` : ""}
        </div>
      </div>
      <p style="margin:0 0 24px; font-size:18px; color:var(--muted); line-height: 1.6;">勾選本次評量要涵蓋的細項。AI 將只使用已勾選的項目進行出題與自動對齊，這能讓出題更集中，避免細項過多導致分散。</p>
      
      <div class="actions" style="margin-bottom:24px; display:flex; gap:12px;">
        <button class="secondary" data-action="chinese-sub-default" style="padding:10px 20px; font-size:17px; height:auto; font-weight: 600;">恢復預設選項</button>
        <button class="secondary" data-action="chinese-sub-all" style="padding:10px 20px; font-size:17px; height:auto; font-weight: 600;">全選</button>
        <button class="secondary" data-action="chinese-sub-none" style="padding:10px 20px; font-size:17px; height:auto; font-weight: 600;">清空</button>
      </div>

      <div style="display:flex; gap:24px; flex-wrap:wrap; align-items:stretch;">
        ${gridHtml}
      </div>
    </div>
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

function getGradeCategory(grade) {
  const g = String(grade || "").trim();
  if (!g || g === "請選擇") return "";
  if (g.includes("一") || g.includes("二") || g.includes("1") || g.includes("2")) return "low";
  if (g.includes("三") || g.includes("四") || g.includes("3") || g.includes("4")) return "middle";
  return "high";
}

function getMandarinRecommendation(grade) {
  const category = getGradeCategory(grade);
  if (category === "low") {
    return { character: "50%", grammar: "30%", reading: "20%" };
  }
  if (category === "middle") {
    return { character: "30%", grammar: "50%", reading: "20%" };
  }
  if (category === "high") {
    return { character: "20%", grammar: "30%", reading: "50%" };
  }
  return { character: "—", grammar: "—", reading: "—" };
}

function renderStep3Or4() {
  const isChinese = (state.project.subject === "國語");
  const targets = state.objectiveTargets || [];
  const intents = state.intents;
  const planRows = state.planRows;

  let targetsSectionHtml = "";
  if (isChinese) {
    const dimScores = { "字詞短語": 0, "句式語法": 0, "段篇讀寫": 0 };
    intents.forEach((slot) => {
      const dim = slot.chineseDimension || getChineseDimension(slot.questionType);
      if (dimScores[dim] !== undefined) {
        dimScores[dim] += Number(slot.score) || 0;
      }
    });

    const totalIntentsScore = Object.values(dimScores).reduce((a, b) => a + b, 0);
    const recs = getMandarinRecommendation(state.project.grade);

    targetsSectionHtml = `
      <h3>國語科評量向度配分比例（點選下方題位向度可即時調整）</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>評量向度</th><th>建議佔分比</th><th>預估配分 (比例)</th></tr></thead>
        <tbody>
          <tr>
            <td>字詞短語</td>
            <td>${recs.character}</td>
            <td style="font-weight:bold; color:var(--primary);">${dimScores["字詞短語"]} 分 (${totalIntentsScore > 0 ? Math.round(dimScores["字詞短語"] / totalIntentsScore * 100) : 0}%)</td>
          </tr>
          <tr>
            <td>句式語法</td>
            <td>${recs.grammar}</td>
            <td style="font-weight:bold; color:var(--primary);">${dimScores["句式語法"]} 分 (${totalIntentsScore > 0 ? Math.round(dimScores["句式語法"] / totalIntentsScore * 100) : 0}%)</td>
          </tr>
          <tr>
            <td>段篇讀寫</td>
            <td>${recs.reading}</td>
            <td style="font-weight:bold; color:var(--primary);">${dimScores["段篇讀寫"]} 分 (${totalIntentsScore > 0 ? Math.round(dimScores["段篇讀寫"] / totalIntentsScore * 100) : 0}%)</td>
          </tr>
        </tbody>
      </table></div>
    `;
  } else {
    targetsSectionHtml = `
      <h3>學習目標與配分占比（依節數）</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>目標</th><th>文字</th><th>節數</th><th>占總時數</th><th>目標配分(約)</th></tr></thead>
        <tbody>${targets.map((row) => `<tr><td>${escapeHtml(row.objectiveId)}</td><td>${escapeHtml(row.text)}</td><td>${escapeHtml(row.periodCount)}</td><td>${escapeHtml(formatPercent(row.share))}</td><td>${escapeHtml(row.targetScore)}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  return `<section class="panel">
    <h2>③ 配題與藍圖</h2>
    <p class="notice">${isChinese ? "藍圖鎖定每題題型、配分與評量向度；AI 生成時將嚴格遵循指定的向度命題，以確保向度佔分精準。" : "藍圖只鎖定每題的題型與配分；各題對應哪個學習目標、認知層次與出題順序，交由 AI 依下列節數比例與整卷整體性編排。"}</p>

    ${targetsSectionHtml}

    <h3>配題分布（題型與配分固定）</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題型</th><th>題數</th><th>每題(答)配分</th><th>小計</th></tr></thead>
      <tbody>${planRows.map((row) => `<tr><td>${escapeHtml(row.questionType)}</td><td>${escapeHtml(row.count)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml((Number(row.count) || 0) * (Number(row.score) || 0))}分</td></tr>`).join("")}</tbody>
    </table></div>

    <h3>題位（共 ${intents.length} 題）</h3>
    <p class="notice" style="margin-bottom:12px;">您可以自由勾選特定題號為「題組」，並設定其子題數量。非選擇題型亦可設定為題組。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>題型</th><th>配分</th><th>題組與設定</th></tr></thead>
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
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; margin:0; font-size:14px; color:var(--ink);">
                <input type="checkbox" data-slot-index="${index}" data-slot-field="isGroup" ${isGroup ? "checked" : ""} style="width:auto; margin:0;">
                <span>合併為題組</span>
              </label>
              <select data-slot-index="${index}" data-slot-field="subCount" style="width:auto; display:inline-block; padding:2px 6px; font-size:13px; height:28px; border-radius:6px;" ${!isGroup ? "disabled" : ""}>
                <option value="2" ${slot.subCount === 2 ? "selected" : ""}>2 個子題</option>
                <option value="3" ${slot.subCount === 3 || !slot.subCount ? "selected" : ""}>3 個子題</option>
                <option value="4" ${slot.subCount === 4 ? "selected" : ""}>4 個子題</option>
              </select>
              ${isChinese ? `
                <select data-slot-index="${index}" data-slot-field="chineseDimension" style="width:auto; display:inline-block; padding:2px 6px; font-size:13px; height:28px; border-radius:6px; border:1px solid var(--primary); background: #fff;">
                  <option value="字詞短語" ${(slot.chineseDimension || getChineseDimension(slot.questionType)) === "字詞短語" ? "selected" : ""}>字詞短語</option>
                  <option value="句式語法" ${(slot.chineseDimension || getChineseDimension(slot.questionType)) === "句式語法" ? "selected" : ""}>句式語法</option>
                  <option value="段篇讀寫" ${(slot.chineseDimension || getChineseDimension(slot.questionType)) === "段篇讀寫" ? "selected" : ""}>段篇讀寫</option>
                </select>
              ` : ""}
            </div>
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
      
      const currentDim = subItem.chineseDimension || "字詞短語";
      const currentSub = subItem.chineseSubcategory || getChineseSubcategory(subItem.questionType, currentDim);
      
      const dimStructure = CHINESE_AUDIT_STRUCTURE.filter(d => d.dimension === currentDim);
      const allSubForDim = dimStructure.flatMap(d => d.items);

      const checkedSet = new Set(state.checkedChineseSubcategories || []);
      const visibleSubs = allSubForDim.filter(sub => checkedSet.has(sub) || sub === currentSub);

      const subOptions = visibleSubs.map(sub => 
        `<option value="${sub}" ${sub === currentSub ? "selected" : ""}>${sub}</option>`
      ).join("");

      return `<div style="display:flex; gap:12px; margin-top:8px;">
        <label style="flex:1; margin:0;">評量向度
          <select data-item-field="chineseDimension" data-item-id="${escapeHtml(subItem.itemId)}">
            <option value="字詞短語" ${currentDim === "字詞短語" ? "selected" : ""}>字詞短語</option>
            <option value="句式語法" ${currentDim === "句式語法" ? "selected" : ""}>句式語法</option>
            <option value="段篇讀寫" ${currentDim === "段篇讀寫" ? "selected" : ""}>段篇讀寫</option>
          </select>
        </label>
        <label style="flex:1; margin:0;">評量項目(細項)
          <select data-item-field="chineseSubcategory" data-item-id="${escapeHtml(subItem.itemId)}">
            ${subOptions}
          </select>
        </label>
      </div>`;
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
            子題號：${escapeHtml(subId)} ｜ 配分：${escapeHtml(subItem.score)}分 ｜ 對應目標：${(() => {
              const raw = subItem.objectiveIds || (subItem.primaryObjectiveId ? [subItem.primaryObjectiveId] : []);
              return escapeHtml(raw.map((id) => {
                const obj = state.objectives.find((o) => o.objectiveId === id);
                return obj ? obj.text : id;
              }).filter(Boolean).join("、") || "未標示");
            })()} ｜ 層次：${escapeHtml(subItem.cognitiveLevel || "未標示")}
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
        <div class="item-meta">${escapeHtml(item.itemId)}｜${escapeHtml(item.questionType)}｜${escapeHtml(item.score)}分｜對應目標 ${(() => {
          const raw = item.objectiveIds || (item.primaryObjectiveId ? [item.primaryObjectiveId] : []);
          return escapeHtml(raw.map((id) => {
            const obj = state.objectives.find((o) => o.objectiveId === id);
            return obj ? obj.text : id;
          }).filter(Boolean).join("、") || "未標示");
        })()}｜層次 ${escapeHtml(item.cognitiveLevel || "未標示")}</div>
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
      <tbody>${summary.map((row) => {
        const obj = state.objectives.find((o) => o.objectiveId === row.objectiveId);
        const displayObj = obj ? obj.text : row.objectiveId;
        return `<tr><td>${escapeHtml(displayObj)}</td><td>${escapeHtml(row.unitCount)}</td><td>${escapeHtml(row.score)}</td></tr>`;
      }).join("")}</tbody>
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
          const obj = state.objectives.find((o) => o.objectiveId === row.objectiveId);
          const displayObj = obj ? obj.text : row.objectiveId;
          return `<tr><td>${escapeHtml(displayObj)}</td><td class="num">${escapeHtml(row.unitCount)}</td><td class="num"${off ? ' style="color:var(--danger)"' : ""}>${escapeHtml(row.score)}</td><td class="num">${row.target != null ? escapeHtml(row.target) : "—"}</td></tr>`;
        }).join("");
      })()}</tbody>
    </table></div>
    <h3>逐題審核表</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>題號</th><th>題型</th><th>配分</th><th>對應目標</th><th>認知層次</th></tr></thead>
      <tbody>${buildAuditRows(state.items).map((row) => {
        const labels = row.objectiveIds.split("、").map((id) => {
          const obj = state.objectives.find((o) => o.objectiveId === id);
          return obj ? obj.text : id;
        }).join("、");
        return `<tr><td>${escapeHtml(row.itemId)}</td><td>${escapeHtml(row.questionType)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml(labels)}</td><td>${escapeHtml(row.cognitiveLevel)}</td></tr>`;
      }).join("")}</tbody>
    </table></div>
    <div class="actions"><button data-next-step="6">前往輸出</button></div>
  </section>`;
}

function renderOutput() {
  const project = {
    ...state.project,
    examName: examTitle(),
    checkedChineseSubcategories: state.checkedChineseSubcategories,
  };
  const studentPaper = renderStudentPaper({ project, sections: state.sections, items: state.items });
  const teacherPaper = renderTeacherPaper({ project, sections: state.sections, items: state.items, objectives: state.objectives });
  const auditTableHtml = renderAuditTable({
    project,
    objectives: state.objectives,
    items: state.items,
    planRows: state.planRows,
    sections: state.sections,
  });

  window.downloadWordAudit = () => {
    const isChinese = (state.project.subject === "國語");
    const cleanHtmlForExport = (html) => {
      let cleaned = html;
      cleaned = cleaned.replace(/var\(--primary\)/g, "#000000");
      cleaned = cleaned.replace(/var\(--danger\)/g, "#d32f2f");
      cleaned = cleaned.replace(/var\(--dark\)/g, "#000000");
      cleaned = cleaned.replace(/var\(--line\)/g, "#000000");
      cleaned = cleaned.replace(/#000(?!000)/g, "#000000");
      cleaned = cleaned.replace(/#fff/g, "#ffffff");
      cleaned = cleaned.replace(/#fafafa/g, "#fafafa");
      cleaned = cleaned.replace(/#f5f5f5/g, "#f5f5f5");

      // Inject native border properties to all tables for Word compatibility
      cleaned = cleaned.replace(/<table/g, '<table border="1" cellspacing="0" cellpadding="6" bordercolor="#000000"');
      return cleaned;
    };

    const exportedHtml = cleanHtmlForExport(auditTableHtml);
    const styledHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>試題審核表</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: ${isChinese ? "21.0cm 29.7cm" : "29.7cm 21.0cm"};
            mso-page-orientation: ${isChinese ? "portrait" : "landscape"};
            margin: 2.0cm 2.0cm 2.0cm 2.0cm;
            mso-header-margin: 36pt;
            mso-footer-margin: 36pt;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body { font-family: "Microsoft JhengHei", Arial, sans-serif; font-size: 14px; }
          h2, h3 { text-align: center; margin: 4px 0; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 15px; }
          th, td { border: 1px solid #000000; padding: 6px; font-size: 13px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .num { text-align: center; }
          .self-audit-table td { padding: 4px 8px; }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${exportedHtml}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff", styledHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.examName || "試題"}_審核表.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.downloadExcelAudit = () => {
    const excelXml = generateExcelXml({
      project,
      objectives: state.objectives,
      items: state.items,
      planRows: state.planRows,
      sections: state.sections,
    });
    const blob = new Blob([excelXml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.examName || "試題"}_審核表.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return `<section class="panel">
    <h2>⑥ 輸出</h2>
    
    <div class="actions" style="margin-bottom: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
      <button onclick="window.print()" style="font-weight:600; padding:12px 24px; font-size:16px;">🖨️ 列印審核表 (A4 自動排版)</button>
      <button onclick="window.downloadWordAudit()" style="font-weight:600; padding:12px 24px; font-size:16px; background-color:#2b579a; color:white; border-color:#2b579a;">📝 匯出 Word 檔</button>
      <button onclick="window.downloadExcelAudit()" style="font-weight:600; padding:12px 24px; font-size:16px; background-color:#217346; color:white; border-color:#217346;">📊 匯出 Excel 檔</button>
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
  try {
    app.innerHTML = `${renderSteps()}${renderMessages()}${renderCurrentStep()}`;
  } catch (err) {
    console.error("Render error:", err);
    app.innerHTML = `<div style="padding: 24px; color: red; background: #fff1f0; border: 1px solid #ffa39e; border-radius: 8px; margin: 20px;">
      <h3>頁面渲染發生錯誤 (Render Error)</h3>
      <p><strong>錯誤訊息：</strong>${err.message}</p>
      <pre style="background: #fafafa; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px;">${err.stack}</pre>
    </div>`;
  }
}

function updateStateFromEvent(event) {
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
    return true;
  }

  if (planField && planIndex !== undefined) {
    const index = Number(planIndex);
    const subIndex = event.target.dataset.subIndex;
    if (state.planRows[index]) {
      if (planField === "subScore" && subIndex !== undefined) {
        const sIdx = Number(subIndex);
        const val = Math.max(1, Number(event.target.value) || 1);
        if (state.planRows[index].subScores) {
          state.planRows[index].subScores[sIdx] = val;
        }
      } else if (planField === "subCount") {
        const count = Number(event.target.value);
        let subScores = state.planRows[index].subScores || [];
        if (subScores.length < count) {
          while (subScores.length < count) subScores.push(2);
        } else if (subScores.length > count) {
          subScores = subScores.slice(0, count);
        }
        state.planRows[index].subScores = subScores;
      } else if (planField === "isGroup") {
        const checked = event.target.checked;
        state.planRows[index].isGroup = checked;
        if (checked) {
          state.planRows[index].groupCount = 1;
          state.planRows[index].subScores = [2, 3];
          if (!state.planRows[index].score) {
            state.planRows[index].score = 2;
          }
        } else {
          state.planRows[index].groupCount = 1;
          state.planRows[index].subScores = [];
          if (!state.planRows[index].score) {
            state.planRows[index].score = 2;
          }
        }
      } else if (planField === "count") {
        const val = Math.max(1, Number(event.target.value) || 1);
        state.planRows[index].count = val;
        if (state.planRows[index].isGroup) {
          state.planRows[index].groupCount = Math.min(state.planRows[index].groupCount || 1, val);
        }
      } else if (planField === "groupCount") {
        const count = state.planRows[index].count || 1;
        const val = Math.max(1, Math.min(count, Number(event.target.value) || 1));
        state.planRows[index].groupCount = val;
      } else if (planField === "score") {
        const val = Math.max(1, Number(event.target.value) || 1);
        state.planRows[index].score = val;
      } else {
        const value = planField === "questionType" ? event.target.value : Number(event.target.value);
        state.planRows[index] = { ...state.planRows[index], [planField]: value };
        if (planField === "questionType") {
          if (value === "學力檢測題") {
            state.planRows[index].isGroup = true;
            state.planRows[index].groupCount = state.planRows[index].count || 4;
            state.planRows[index].subScores = [2, 3];
            state.planRows[index].score = 2;
          } else {
            state.planRows[index].isGroup = false;
            state.planRows[index].groupCount = 1;
            state.planRows[index].subScores = [];
            state.planRows[index].score = 2;
          }
        }
      }
    }
    return true;
  }

  if (projectField) {
    setProjectField(projectField, event.target.value);
    return true;
  }

  if (field) {
    state[field] = event.target.value;
    return true;
  }

  if (itemField === "option" && itemId && event.target.dataset.optionIndex !== undefined) {
    updateItemOption(itemId, Number(event.target.dataset.optionIndex), event.target.value);
    return true;
  }

  if (itemField && itemId) {
    updateItemField(itemId, itemField, event.target.value);
    return true;
  }

  return false;
}

app.addEventListener("input", (event) => {
  const handled = updateStateFromEvent(event);
  if (!handled) return;

  const projectField = event.target.dataset.project;
  if (projectField === "subject" || projectField === "grade" || projectField === "semester" || projectField === "examType") {
    render();
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
    setState({ planRows: [...state.planRows, { questionType: options[0], count: 5, score: 2, isGroup: false, groupCount: 1, subScores: [] }] });
  }
  if (action === "remove-plan-row") {
    const index = Number(actionButton.dataset.planIndex);
    setState({ planRows: state.planRows.filter((_, currentIndex) => currentIndex !== index) });
  }
  if (action === "chinese-sub-default") {
    setState({ checkedChineseSubcategories: ["正確字音", "確認字形", "分辨部首", "字詞釋義", "句型辨識", "文句組成", "常用修辭", "提取訊息", "推論訊息", "主題習寫"] });
  }
  if (action === "chinese-sub-all") {
    const allItems = CHINESE_AUDIT_STRUCTURE.flatMap(d => d.items);
    setState({ checkedChineseSubcategories: allItems });
  }
  if (action === "chinese-sub-none") {
    setState({ checkedChineseSubcategories: [] });
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
      } else if (slotField === "chineseDimension") {
        value = event.target.value;
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

  if (event.target.dataset.chineseSub !== undefined) {
    const checkedBoxes = Array.from(app.querySelectorAll("input[data-chinese-sub]:checked"));
    state.checkedChineseSubcategories = checkedBoxes.map(cb => cb.dataset.chineseSub);
    render();
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
      if (itemField === "chineseDimension") {
        const target = state.items.find((item) => item.itemId === itemId);
        if (target) {
          const subcategoriesByDim = {
            "字詞短語": "正確字音",
            "句式語法": "句型辨識",
            "段篇讀寫": "提取訊息"
          };
          target.chineseSubcategory = subcategoriesByDim[event.target.value] || "正確字音";
        }
      }
    }
  }

  // 確保 select / checkbox 在 change 時能正確更新狀態並重繪
  const handled = updateStateFromEvent(event);
  if (handled) {
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
