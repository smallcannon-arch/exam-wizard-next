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
    planRows: [],
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
