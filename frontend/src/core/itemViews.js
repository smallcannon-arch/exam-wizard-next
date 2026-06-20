export function toStudentItem(item = {}) {
  return {
    questionId: item.questionId || item.itemId || "",
    primaryObjectiveId: item.primaryObjectiveId || "",
    question: item.question || "",
    options: Array.isArray(item.options) ? [...item.options] : [],
    answer: item.answer || "",
    explanation: item.explanation || "",
  };
}

export function toReviewItem(item = {}) {
  return {
    ...item,
    qualityMeta: item.qualityMeta || null,
  };
}
