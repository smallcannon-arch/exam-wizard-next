export function createInitialState() {
  return {
    step: 1,
    apiBaseUrl: "http://127.0.0.1:8787",
    project: {
      subject: "",
      grade: "",
      schoolName: "新竹市香山區內湖國小",
      schoolYear: "",
      semester: "",
      examType: "",
      teacherName: "江志宏",
      version: "翰林版",
      range: "",
    },
    materialText: "",
    planRows: [
      { questionType: "選擇題", count: 20, score: 2 },
      { questionType: "是非題", count: 10, score: 2 },
      { questionType: "填充題", count: 10, score: 2 },
      { questionType: "學力檢測題", count: 4, score: 5 },
    ],
    objectiveInput: "",
    objectives: [],
    objectivePlans: [],
    intents: [],
    sections: [],
    items: [],
    messages: [],
    errors: [],
  };
}
