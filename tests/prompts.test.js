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
