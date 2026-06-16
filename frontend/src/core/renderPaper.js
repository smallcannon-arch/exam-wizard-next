function numberToChinese(index) {
  const chars = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return chars[index - 1] || String(index);
}

// 選擇題形式（含實驗探究題、圖表判讀題）在題號前加作答括號（如 (      )1.）。
const CHOICE_LIKE_TYPES = ["選擇題", "是非題", "實驗探究題", "圖表判讀題", "學力檢測題", "閱讀測驗"];

function answerBlank(questionType) {
  return CHOICE_LIKE_TYPES.includes(questionType) ? "(      ) " : "";
}

// 是非題不呈現選項；其餘只要有 options 就列出。
function showsOptions(item) {
  return item.questionType !== "是非題" && Array.isArray(item.options) && item.options.length > 0;
}

function getSubNumber(itemId) {
  const parts = String(itemId || "").split("-");
  return parts[parts.length - 1] || "1";
}

export function renderStudentPaper({ project = {}, sections = [], items = [] } = {}) {
  const itemById = new Map(items.map((item) => [item.itemId, item]));
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
