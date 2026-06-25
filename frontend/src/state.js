export function createInitialState() {
  return {
    step: 1,
    apiBaseUrl: "http://127.0.0.1:8787",
    project: {
      subject: "",
      frameworkId: "",
      grade: "",
      schoolName: "",
      schoolYear: "",
      semester: "",
      examType: "",
      teacherName: "",
      version: "",
      range: "",
    },
    materialText: "",
    planRows: [
      { questionType: "選擇題", count: 50, score: 2, isGroup: false, groupCount: 1, subScores: [] },
    ],
    objectiveInput: "",
    objectives: [],
    objectivePlans: [],
    intents: [],
    sections: [],
    items: [],
    partialResult: null,
    messages: [],
    errors: [],
    checkedChineseSubcategories: ["正確字音", "確認字形", "分辨部首", "字詞釋義", "句型辨識", "文句組成", "常用修辭", "提取訊息", "推論訊息", "主題習寫"],
    customTargetScores: {},
  };
}
