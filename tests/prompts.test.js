import { describe, expect, it } from "vitest";
import { buildGenerateItemsPrompt, buildRegenerateItemPrompt } from "../worker/src/prompts.js";

const project = { grade: "四年級", subject: "國語" };
const objectives = [{ objectiveId: "O-001", text: "能理解文章主旨", periodCount: 2 }];
const intents = [{
  itemId: "Q-001",
  questionType: "選擇題",
  score: 2,
  primaryObjectiveId: "O-001",
  chineseDimension: "段篇讀寫",
}];

const promptReadyFewShot = {
  exampleId: "PROMPT-READY-001",
  status: "teacher_reviewed",
  promptUseStatus: "prompt_ready",
  subject: "國語文",
  grade: "國小四年級",
  itemType: "選擇題",
  cognitiveLevel: "理解",
  objectiveId: "O-001",
  question: "這是一題已准入的 few-shot 範例題幹。",
  options: {
    A: "正答",
    B: "誘答一",
    C: "誘答二",
    D: "誘答三",
  },
  answer: "A",
  correctReason: "A 能完整對應題幹。",
  distractorDesign: {
    B: { misconceptionTag: "keyword_trap", whyItIsWrong: "只抓關鍵詞。" },
  },
  whyThisIsGood: ["誘答具診斷性"],
  analysisStyleNote: "解析先講正答，再拆誘答。",
};

describe("worker prompts", () => {
  it("整卷生成提示詞包含題感、誘答迷思與內部欄位要求", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });

    expect(prompt).toContain("優良題感與 few-shot 使用規則");
    expect(prompt).toContain("不得臨時自造 few-shot 範例");
    expect(prompt).toContain("錯誤選項與迷思標籤規格");
    expect(prompt).toContain("keyword_trap");
    expect(prompt).toContain("formula_transfer_error");
    expect(prompt).toContain("qualityMeta");
    expect(prompt).toContain("distractorDesign");
    expect(prompt).toContain("misconceptionTag");
    expect(prompt).toContain("teacherExplanation");
    expect(prompt).toContain("selfCheck");
    expect(prompt).toContain("不要輸出 internalVersion 與 studentVersion");
  });

  it("candidate 或未准入 few-shot 不會插入生成提示詞", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
      fewShotExamples: [
        { ...promptReadyFewShot, exampleId: "CANDIDATE-001", status: "candidate", question: "候選題不得進 prompt" },
        { ...promptReadyFewShot, exampleId: "NOT-READY-001", promptUseStatus: "not_ready_until_teacher_review", question: "未准入題不得進 prompt" },
      ],
    });

    expect(prompt).not.toContain("【few-shot 優良題範例】");
    expect(prompt).not.toContain("候選題不得進 prompt");
    expect(prompt).not.toContain("未准入題不得進 prompt");
  });

  it("prompt_ready few-shot 會插在品質規則後且 JSON 輸出要求前", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
      fewShotExamples: [promptReadyFewShot],
    });

    expect(prompt).toContain("【few-shot 優良題範例】");
    expect(prompt).toContain("這是一題已准入的 few-shot 範例題幹。");
    expect(prompt).toContain("qualityMeta.distractorDesign");
    expect(prompt).toContain("teacherExplanation");
    expect(prompt).toContain("selfCheck");

    const qualityIndex = prompt.indexOf("# 優良題感與 few-shot 使用規則");
    const fewShotIndex = prompt.indexOf("【few-shot 優良題範例】");
    const outputIndex = prompt.indexOf("# 輸出要求");

    expect(qualityIndex).toBeGreaterThanOrEqual(0);
    expect(fewShotIndex).toBeGreaterThan(qualityIndex);
    expect(outputIndex).toBeGreaterThan(fewShotIndex);
  });

  it("單題重出提示詞也套用同一套品質欄位並保留國語向度鎖定", () => {
    const prompt = buildRegenerateItemPrompt({
      project,
      materialText: "課文重點",
      objectives,
      originalItem: {
        itemId: "Q-001",
        questionType: "選擇題",
        score: 2,
        objectiveIds: ["O-001"],
        chineseDimension: "段篇讀寫",
        chineseSubcategory: "提取訊息",
      },
      reason: "誘答太弱",
    });

    expect(prompt).toContain("優良題感與 few-shot 使用規則");
    expect(prompt).toContain("qualityMeta");
    expect(prompt).toContain("distractorDesign");
    expect(prompt).toContain("selfCheck");
    expect(prompt).toContain("國語向度鎖定");
    expect(prompt).toContain("段篇讀寫");
  });
});
