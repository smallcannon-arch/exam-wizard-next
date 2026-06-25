import { describe, expect, it } from "vitest";
import { buildGenerateItemsPrompt } from "../worker/src/prompts.js";

const project = { grade: "\u56db\u5e74\u7d1a", subject: "\u570b\u8a9e" };
const objectives = [{
  objectiveId: "O-001",
  text: "\u80fd\u7406\u89e3\u56db\u5e74\u7d1a\u570b\u8a9e\u8a9e\u8a5e\u8207\u53e5\u610f\u3002",
  periodCount: 2,
}];
const intents = [{
  itemId: "Q-001",
  questionType: "\u9078\u64c7\u984c",
  score: 2,
  primaryObjectiveId: "O-001",
  chineseDimension: "\u6bb5\u7bc7\u8b80\u5beb",
}];

describe("Chinese distractorDesign compact prompt contract", () => {
  it("tightens Chinese distractorDesign length and misconceptionTag diversity", () => {
    const prompt = buildGenerateItemsPrompt({
      project,
      materialText: "\u56db\u5e74\u7d1a\u570b\u8a9e\u7df4\u7fd2\u7d20\u6750",
      objectives,
      intents,
      checkedChineseSubcategories: ["\u63d0\u53d6\u8a0a\u606f"],
    });

    expect(prompt).toContain("\u570b\u8a9e qualityMeta / distractorDesign \u58d3\u7e2e\u898f\u5247");
    expect(prompt).toContain("\u55ae\u4e00\u932f\u8aa4\u9078\u9805\u7684 distractorDesign JSON \u7e3d\u9577\u5ea6\u4e0d\u8d85\u904e 140 \u5b57");
    expect(prompt).toContain("distractorDesign \u5916\u5c64 key \u5fc5\u9808\u53ea\u5beb\u932f\u8aa4\u9078\u9805\u4ee3\u865f");
    expect(prompt).toContain("\u6a19\u7c64\u53ea\u80fd\u653e\u5728 misconceptionTag \u6b04\u4f4d");
    expect(prompt).toContain("misconceptionDescription \u8acb\u63a7\u5236\u5728 6-14 \u5b57");
    expect(prompt).toContain("whyStudentsMayChooseIt \u8acb\u63a7\u5236\u5728 8-18 \u5b57");
    expect(prompt).toContain("whyItIsWrong \u8acb\u63a7\u5236\u5728 12-28 \u5b57");
    expect(prompt).toContain("revisionNote \u8acb\u63a7\u5236\u5728 4-10 \u5b57");
    expect(prompt).toContain("\u540c\u4e00\u984c\u4e09\u500b\u932f\u8aa4\u9078\u9805\u7684 misconceptionTag \u4e0d\u5f97\u4e09\u500b\u5b8c\u5168\u76f8\u540c");
    expect(prompt).toContain("\u4e0d\u8981\u9810\u8a2d\u4f7f\u7528 structure_confusion");
    expect(prompt).toContain("keyword_trap\u3001partial_reading\u3001stem_neglect");
    expect(prompt).toContain("\u6bcf\u500b\u932f\u8aa4\u9078\u9805\u53ea\u5beb\u4e00\u500b\u6838\u5fc3\u8ff7\u601d");
    expect(prompt).not.toContain("\u55ae\u4e00\u932f\u8aa4\u9078\u9805\u7684 distractorDesign JSON \u7e3d\u9577\u5ea6\u4e0d\u8d85\u904e 160 \u5b57");
  });
});
