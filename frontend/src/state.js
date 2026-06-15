export function createInitialState() {
  return {
    step: 1,
    apiBaseUrl: "https://exam-wizard-proxy.example.workers.dev",
    project: {
      examName: "自然第一次定期評量",
      subject: "自然",
      grade: "四年級",
      totalScore: 100,
      unitScore: 2,
    },
    materialText: "",
    objectiveInput: "能判讀天氣資料並說明天氣變化｜3\n能根據觀察紀錄進行簡單推論｜2\n能說明水循環與生活的關係｜2",
    objectives: [],
    objectivePlans: [],
    intents: [],
    sections: [],
    items: [],
    messages: [],
    errors: [],
  };
}
