function numberToChinese(index) {
  const chars = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return chars[index - 1] || String(index);
}

// 是非題、選擇題在題號前加作答括號（如 (      )1.）；其餘題型不加。
function answerBlank(questionType) {
  return questionType === "是非題" || questionType === "選擇題" ? "(      )" : "";
}

// 是非題不呈現選項。
function showsOptions(item) {
  return item.questionType !== "是非題" && Array.isArray(item.options) && item.options.length > 0;
}

export function renderStudentPaper({ project = {}, sections = [], items = [] } = {}) {
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  const lines = [`${project.examName || "未命名評量"}　學生卷`, ""];

  sections.forEach((section, sectionIndex) => {
    lines.push(`${numberToChinese(sectionIndex + 1)}、${section.title.replace(/^\d+\.\s*/, "")}`);
    section.itemIds.forEach((itemId, localIndex) => {
      const item = itemById.get(itemId);
      if (!item) return;
      lines.push(`${answerBlank(item.questionType)}${localIndex + 1}.（${item.score}分）${item.question}`);
      if (showsOptions(item)) {
        lines.push(item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
      }
      lines.push("");
    });
  });

  return lines.join("\n");
}

export function renderTeacherPaper({ project = {}, sections = [], items = [] } = {}) {
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  const lines = [`${project.examName || "未命名評量"}　教師卷`, ""];

  sections.forEach((section, sectionIndex) => {
    lines.push(`${numberToChinese(sectionIndex + 1)}、${section.title.replace(/^\d+\.\s*/, "")}`);
    section.itemIds.forEach((itemId, localIndex) => {
      const item = itemById.get(itemId);
      if (!item) return;
      const objectiveTag = item.objectiveIds?.join("、") || item.primaryObjectiveId || "未標示";
      lines.push(`${answerBlank(item.questionType)}${localIndex + 1}.（${item.score}分）${item.question}　【${objectiveTag}｜${item.cognitiveLevel || "未標示"}｜${item.score}分】`);
      if (showsOptions(item)) {
        lines.push(item.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`).join("　"));
      }
      lines.push(`答案：${item.answer}`);
      lines.push(`解析：${item.explanation || "未提供"}`);
      lines.push("");
    });
  });

  return lines.join("\n");
}
