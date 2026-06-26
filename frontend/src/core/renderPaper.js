import { toStudentItem } from "./itemViews.js";
import {
  shouldDisplayOptionsForQuestionType,
  usesAnswerBlank,
} from "./questionTypes.js";

function numberToChinese(index) {
  const chars = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return chars[index - 1] || String(index);
}

function answerBlank(questionType) {
  return usesAnswerBlank(questionType) ? "(      ) " : "";
}

// 題型決定是否允許呈現選項，避免是非／填充被印成 A-D。
function showsOptions(item) {
  return shouldDisplayOptionsForQuestionType(item.questionType)
    && Array.isArray(item.options)
    && item.options.length > 0;
}

function getSubNumber(itemId) {
  const parts = String(itemId || "").split("-");
  return parts[parts.length - 1] || "1";
}

export function renderStudentPaper({ project = {}, sections = [], items = [] } = {}) {
  const itemById = new Map(items.map((item) => [item.itemId, { ...toStudentItem(item), itemId: item.itemId, groupId: item.groupId, questionType: item.questionType, score: item.score, stimulus: item.stimulus }]));
  const lines = [`${project.examName || "未命名評量"}　學生卷`, ""];

  sections.forEach((section, sectionIndex) => {
    lines.push(`${numberToChinese(sectionIndex + 1)}、${section.title.replace(/^\d+\.\s*/, "")}`);
    let questionNumber = 1;
    const renderedGroups = new Set();

    section.itemIds.forEach((itemId) => {
      const item = itemById.get(itemId);
      if (!item) return;

      const groupId = item.groupId;
      if (groupId) {
        if (renderedGroups.has(groupId)) {
          lines.push(`　　${answerBlank(item.questionType)}(${getSubNumber(item.itemId)})（${item.score}分）${item.question}`);
          if (showsOptions(item)) {
            lines.push("　　　　" + item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
          }
          lines.push("");
          return;
        }

        renderedGroups.add(groupId);
        lines.push(`${questionNumber}.【題組】${item.stimulus || ""}`);
        questionNumber++;

        lines.push(`　　${answerBlank(item.questionType)}(${getSubNumber(item.itemId)})（${item.score}分）${item.question}`);
        if (showsOptions(item)) {
          lines.push("　　　　" + item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
        }
        lines.push("");
      } else {
        if (item.stimulus && item.stimulus.trim()) {
          lines.push(`【閱讀下文，回答第 ${questionNumber} 題】：\n${item.stimulus.trim()}`);
        }
        lines.push(`${answerBlank(item.questionType)}${questionNumber}.（${item.score}分）${item.question}`);
        if (showsOptions(item)) {
          lines.push(item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
        }
        lines.push("");
        questionNumber++;
      }
    });
  });

  return lines.join("\n");
}

export function renderTeacherPaper({ project = {}, sections = [], items = [], objectives = [] } = {}) {
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  const objectiveMap = new Map((objectives || []).map((obj) => [obj.objectiveId, obj.text]));
  const lines = [`${project.examName || "未命名評量"}　教師卷`, ""];

  sections.forEach((section, sectionIndex) => {
    lines.push(`${numberToChinese(sectionIndex + 1)}、${section.title.replace(/^\d+\.\s*/, "")}`);
    let questionNumber = 1;
    const renderedGroups = new Set();

    section.itemIds.forEach((itemId) => {
      const item = itemById.get(itemId);
      if (!item) return;

      const rawObjectives = item.objectiveIds || (item.primaryObjectiveId ? [item.primaryObjectiveId] : []);
      const objectiveTag = rawObjectives
        .map((id) => objectiveMap.get(id) || id)
        .filter(Boolean)
        .join("、") || "未標示";
      const chineseDimTag = item.chineseDimension ? `｜${item.chineseDimension}` : "";
      const metaTag = `【${item.questionType || "未標示"}${chineseDimTag}｜${objectiveTag}｜${item.cognitiveLevel || "未標示"}｜${item.score}分】`;

      const groupId = item.groupId;
      if (groupId) {
        if (renderedGroups.has(groupId)) {
          lines.push(`　　${answerBlank(item.questionType)}(${getSubNumber(item.itemId)})（${item.score}分）${item.question}　${metaTag}`);
          if (showsOptions(item)) {
            lines.push("　　　　" + item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
          }
          lines.push(`　　答案：${item.answer}`);
          lines.push(`　　解析：${item.explanation || "未提供"}`);
          lines.push("");
          return;
        }

        renderedGroups.add(groupId);
        lines.push(`${questionNumber}.【題組】${item.stimulus || ""}`);
        questionNumber++;

        lines.push(`　　${answerBlank(item.questionType)}(${getSubNumber(item.itemId)})（${item.score}分）${item.question}　${metaTag}`);
        if (showsOptions(item)) {
          lines.push("　　　　" + item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
        }
        lines.push(`　　答案：${item.answer}`);
        lines.push(`　　解析：${item.explanation || "未提供"}`);
        lines.push("");
      } else {
        if (item.stimulus && item.stimulus.trim()) {
          lines.push(`【閱讀下文，回答第 ${questionNumber} 題】：\n${item.stimulus.trim()}`);
        }
        lines.push(`${answerBlank(item.questionType)}${questionNumber}.（${item.score}分）${item.question}　${metaTag}`);
        if (showsOptions(item)) {
          lines.push(item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
        }
        lines.push(`答案：${item.answer}`);
        lines.push(`解析：${item.explanation || "未提供"}`);
        lines.push("");
        questionNumber++;
      }
    });
  });

  return lines.join("\n");
}
