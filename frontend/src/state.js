export function createInitialState() {
  return {
    step: 1,
    apiBaseUrl: "http://127.0.0.1:8787",
    project: {
      subject: "自然",
      grade: "四年級",
    },
    materialText: "",
    planSubject: "",
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
