import { describe, expect, it } from "vitest";
import { buildGenerateItemsPrompt, buildRegenerateItemPrompt } from "../worker/src/prompts.js";

const project = { grade: "四年級", subject: "國語" };
const mathProject = { grade: "四年級", subject: "數學" };
const objectives = [{ objectiveId: "O-001", text: "能理解文章主旨", periodCount: 2 }];
const intents = [{
  itemId: "Q-001",
  questionType: "選擇題",
  score: 2,
  primaryObjectiveId: "O-001",
  chineseDimension: "段篇讀寫",
}];
const mathIntent = {
  itemId: "Q-M001",
  questionType: "圖表判讀題",
  itemType: "chart",
  score: 2,
  primaryObjectiveId: "O-001",
};

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
    expect(prompt).not.toContain("formula_transfer_error");
    expect(prompt).toContain("qualityMeta");
    expect(prompt).toContain("distractorDesign");
    expect(prompt).toContain("misconceptionTag");
    expect(prompt).toContain("teacherExplanation");
    expect(prompt).toContain("selfCheck");
    expect(prompt).toContain("不要輸出 internalVersion 與 studentVersion");
  });

  it("依科目裁切迷思標籤與國語細項規則", () => {
    const chinesePrompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });
    const mathPrompt = buildGenerateItemsPrompt({
      project: mathProject,
      materialText: "數學重點",
      objectives,
      intents: [mathIntent],
    });

    expect(chinesePrompt).toContain("keyword_trap");
    expect(chinesePrompt).not.toContain("formula_transfer_error");
    expect(chinesePrompt).toContain("國語科評量向度與細項特別要求");
    expect(chinesePrompt).toContain("提取訊息");
    expect(chinesePrompt).not.toContain("近音字");

    expect(mathPrompt).toContain("formula_transfer_error");
    expect(mathPrompt).not.toContain("keyword_trap");
    expect(mathPrompt).not.toContain("國語科評量向度與細項特別要求");
    expect(mathPrompt).not.toContain("字詞短語");
  });

  it("國語未指定勾選細項時保守載入完整細項清單", () => {
    const prompt = buildGenerateItemsPrompt({
      project: { grade: "四年級", subject: "國語文" },
      materialText: "課文重點",
      objectives,
      intents,
    });

    expect(prompt).toContain("國語科評量向度與細項特別要求");
    expect(prompt).toContain("近音字");
    expect(prompt).toContain("標點符號");
    expect(prompt).toContain("比較評估");
  });

  it("依題型裁切閱讀、標點、圖表與幾何規範", () => {
    const readingPrompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents: [{ ...intents[0], questionType: "閱讀測驗" }],
      checkedChineseSubcategories: ["推論訊息"],
    });
    const punctuationPrompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents: [{ ...intents[0], questionType: "標點題", chineseDimension: "句式語法" }],
      checkedChineseSubcategories: ["標點符號"],
    });
    const chartPrompt = buildGenerateItemsPrompt({
      project: mathProject,
      materialText: "數學重點",
      objectives,
      intents: [mathIntent],
    });
    const geometryPrompt = buildGenerateItemsPrompt({
      project: mathProject,
      materialText: "數學重點",
      objectives,
      intents: [{ ...mathIntent, questionType: "角度題", itemType: "geometry" }],
    });

    expect(readingPrompt).toContain("## 15. 閱讀測驗");
    expect(readingPrompt).toContain("閱讀文本");
    expect(readingPrompt).not.toContain("## 9. 實驗探究題");
    expect(readingPrompt).not.toContain("## 8. 作圖題");

    expect(punctuationPrompt).toContain("## 13. 照樣造句 / 造句 / 重組");
    expect(punctuationPrompt).toContain("標點符號");
    expect(punctuationPrompt).not.toContain("## 10. 圖表判讀題");

    expect(chartPrompt).toContain("## 10. 圖表判讀題");
    expect(chartPrompt).toContain("Markdown 文字表格");
    expect(chartPrompt).not.toContain("## 15. 閱讀測驗");

    expect(geometryPrompt).toContain("## 8. 作圖題");
    expect(geometryPrompt).toContain("幾何圖形");
    expect(geometryPrompt).not.toContain("## 15. 閱讀測驗");
  });

  it("無法辨識科目或題型時 fallback 到完整規則", () => {
    const unknownSubjectPrompt = buildGenerateItemsPrompt({
      project: { grade: "四年級", subject: "自然" },
      materialText: "自然重點",
      objectives,
      intents: [{ ...mathIntent, questionType: "圖表判讀題" }],
    });
    const unknownQuestionTypePrompt = buildGenerateItemsPrompt({
      project: mathProject,
      materialText: "數學重點",
      objectives,
      intents: [{ ...mathIntent, questionType: "神秘題型", itemType: "" }],
    });

    expect(unknownSubjectPrompt).toContain("keyword_trap");
    expect(unknownSubjectPrompt).toContain("formula_transfer_error");
    expect(unknownQuestionTypePrompt).toContain("## 12. 國字 / 注音 / 改錯");
    expect(unknownQuestionTypePrompt).toContain("## 14. 短文寫作");
    expect(unknownQuestionTypePrompt).toContain("## 15. 閱讀測驗");
  });

  it("明確區分學生解析、正答理由與教師版命題說明", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });

    expect(prompt).toContain("explanation 是給學生看的簡明解析");
    expect(prompt).toContain("qualityMeta.correctReason 用來精簡說明正答為何正確");
    expect(prompt).toContain("qualityMeta.teacherExplanation 用來給教師／審題者看");
    expect(prompt).toContain("qualityMeta 必須包含：schemaVersion（固定為 \"item-quality-meta/v1\"）, abilityFocus, correctReason, distractorDesign, teacherExplanation, selfCheck");
    expect(prompt).toContain("subject, grade, unit, cognitiveLevel, difficulty, itemType 屬於可由系統或題目資料補回的 metadata");
    expect(prompt).not.toContain("qualityMeta 必須包含：schemaVersion（固定為 \"item-quality-meta/v1\"）, subject, grade");
    expect(prompt).toContain("qualityMeta.teacherExplanation 是必填欄位，不得省略");
    expect(prompt).toContain("即使已有 explanation 與 qualityMeta.correctReason，也必須另行填寫 qualityMeta.teacherExplanation");
    expect(prompt).toContain("不要把 teacherExplanation、selfCheck 或誘答設計註記寫進 question、options 或 explanation");
  });

  it("明確要求合法 JSON 與 distractorDesign 物件格式", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });

    expect(prompt).toContain("JSON 輸出穩定性規則");
    expect(prompt).toContain("只輸出一個合法 JSON 物件");
    expect(prompt).toContain("所有 JSON 字串欄位都必須是單行字串");
    expect(prompt).toContain("不得在字串內直接換行");
    expect(prompt).toContain("options 必須是 JSON array");
    expect(prompt).toContain("不得是 object");
    expect(prompt).toContain("不得寫成 {\"A\":\"...\",\"B\":\"...\"}");
    expect(prompt).toContain("不得以 A/B/C/D 作為 options 物件 key");
    expect(prompt).toContain("answer 必須是 \"A\"、\"B\"、\"C\"、\"D\" 其中之一");
    expect(prompt).toContain("answer 不得是選項文字");
    expect(prompt).toContain("answer 不得是選項文字、完整句子、數字或選項內容");
    expect(prompt).toContain("qualityMeta.distractorDesign 必須是以錯誤選項代號為 key 的物件");
    expect(prompt).toContain("qualityMeta.distractorDesign keys 必須只能從 \"A\"、\"B\"、\"C\"、\"D\" 中選擇");
    expect(prompt).toContain("必須排除正確答案代號");
    expect(prompt).toContain("不得使用選項文字、完整句子或數字索引作為 key");
    expect(prompt).toContain("不得是陣列");
    expect(prompt).toContain("\"distractorDesign\": { \"A\":");
    expect(prompt).toContain("\"answer\": \"從容\"");
    expect(prompt).toContain("\"distractorDesign\": { \"從容\":");
    expect(prompt).toContain("\"distractorDesign\": [ { \"option\": \"A\"");
    expect(prompt).toContain("whyItIsWrong 與 revisionNote 之間");
    expect(prompt).toContain("correctReason 請控制在 30-60 字");
    expect(prompt).toContain("misconceptionDescription 請控制在 15-30 字");
    expect(prompt).toContain("whyStudentsMayChooseIt 請控制在 20-40 字");
    expect(prompt).toContain("whyItIsWrong 請控制在 30-60 字");
    expect(prompt).toContain("revisionNote 請控制在 10-25 字");
    expect(prompt).toContain("teacherExplanation 請控制在 40-80 字且只寫一句話");
    expect(prompt).not.toContain("teacherExplanation 請控制在 80-120 字");
    expect(prompt).toContain("qualityMeta.teacherExplanation 是必填欄位，不得省略");
  });

  it("明確要求無 stimulus 的題幹不得引用未提供文本", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });

    expect(prompt).toContain("stimulus contract");
    expect(prompt).toContain("根據這段文字");
    expect(prompt).toContain("根據本文");
    expect(prompt).toContain("根據上文／下文");
    expect(prompt).toContain("若沒有 stimulus");
    expect(prompt).toContain("本文、上文或這段文字");
    expect(prompt).toContain("AI_STIMULUS_MISSING");
  });

  it("數學 prompt 套用 qualityMeta / distractorDesign 壓縮契約且保留既有 JSON contract", () => {
    const mathPrompt = buildGenerateItemsPrompt({
      project: mathProject,
      materialText: "數學重點",
      objectives,
      intents: [mathIntent],
    });
    const chinesePrompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });

    expect(mathPrompt).toContain("數學 qualityMeta / distractorDesign 壓縮規則");
    expect(mathPrompt).toContain("qualityMeta.correctReason 請控制在 20-45 字");
    expect(mathPrompt).toContain("單一錯誤選項的 distractorDesign JSON 總長度不超過 220 字");
    expect(mathPrompt).toContain("不要在每個錯誤選項重複完整解題流程");
    expect(mathPrompt).toContain("每個錯誤選項最多 1 個短算式或 1 個關鍵錯誤點");
    expect(mathPrompt).toContain("answer 必須是 \"A\"、\"B\"、\"C\"、\"D\" 其中之一");
    expect(mathPrompt).toContain("answer 不得是選項文字");
    expect(mathPrompt).toContain("qualityMeta.distractorDesign 必須是以錯誤選項代號為 key 的物件");
    expect(mathPrompt).toContain("qualityMeta.distractorDesign keys 必須只能從 \"A\"、\"B\"、\"C\"、\"D\" 中選擇");
    expect(mathPrompt).toContain("必須排除正確答案代號");
    expect(chinesePrompt).not.toContain("數學 qualityMeta / distractorDesign 壓縮規則");
    expect(chinesePrompt).toContain("answer 必須是 \"A\"、\"B\"、\"C\"、\"D\" 其中之一");
    expect(chinesePrompt).toContain("國語科評量向度與細項特別要求");
  });

  it("數學單題重出也套用 qualityMeta compact 契約", () => {
    const prompt = buildRegenerateItemPrompt({
      project: mathProject,
      materialText: "數學重點",
      objectives,
      originalItem: {
        itemId: "Q-M001",
        questionType: "選擇題",
        score: 2,
        objectiveIds: ["O-001"],
        options: ["12", "15", "18", "20"],
        answer: "B",
      },
      reason: "誘答過長",
    });

    expect(prompt).toContain("數學 qualityMeta / distractorDesign 壓縮規則");
    expect(prompt).toContain("qualityMeta.teacherExplanation 請控制在 40-80 字，不要寫長篇逐步解題流程");
    expect(prompt).toContain("misconceptionDescription 請控制在 10-24 字");
    expect(prompt).toContain("revisionNote 請控制在 8-20 字");
    expect(prompt).toContain("qualityMeta.distractorDesign keys 必須只能從 \"A\"、\"B\"、\"C\"、\"D\" 中選擇");
    expect(prompt).toContain("answer 不得是選項文字");
  });

  it("預設 prompt 會載入同科目已准入 few-shot，且不載入未准入或跨科目範例", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "課文重點",
      objectives,
      intents,
      checkedChineseSubcategories: ["提取訊息"],
    });

    expect(prompt).toContain("G4_CH_READ_001");
    expect(prompt).toContain("G4_CH_SENTENCE_003");
    expect(prompt).not.toContain("G4_CH_REFERENT_002");
    expect(prompt).not.toContain("G4_MA_CLOCK_002");
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
    expect(prompt).toContain("qualityMeta.correctReason");
    expect(prompt).toContain("qualityMeta.teacherExplanation");
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
    expect(prompt).toContain("options 必須是 JSON array");
    expect(prompt).toContain("answer 必須是 \"A\"、\"B\"、\"C\"、\"D\" 其中之一");
    expect(prompt).toContain("answer 不得是選項文字");
    expect(prompt).toContain("qualityMeta.distractorDesign keys 必須只能從 \"A\"、\"B\"、\"C\"、\"D\" 中選擇");
    expect(prompt).toContain("不得使用選項文字、完整句子或數字索引作為 key");
    expect(prompt).toContain("不得以 A/B/C/D 作為 options 物件 key");
    expect(prompt).toContain("國語向度鎖定");
    expect(prompt).toContain("段篇讀寫");
  });
});
