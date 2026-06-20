import { describe, expect, it } from "vitest";
import {
  renderFewShotExamples,
  selectFewShotExamples,
} from "../worker/src/fewshotExamples.js";

function example(overrides = {}) {
  return {
    exampleId: "EX-001",
    status: "teacher_reviewed",
    promptUseStatus: "prompt_ready",
    subject: "國語",
    grade: "四年級",
    itemType: "選擇題",
    cognitiveLevel: "理解",
    objectiveId: "O-001",
    question: "閱讀短文後，回答問題。這題的主旨是什麼？",
    options: {
      A: "正確答案",
      B: "關鍵詞誘答",
      C: "局部閱讀誘答",
      D: "生活經驗誘答",
    },
    answer: "A",
    correctReason: "A 能整合全文主旨。",
    distractorDesign: {
      B: { misconceptionTag: "keyword_trap", whyItIsWrong: "只抓關鍵詞。" },
      C: { misconceptionTag: "partial_reading", whyItIsWrong: "只看局部。" },
      D: { misconceptionTag: "life_experience_override", whyItIsWrong: "用生活經驗取代文本。" },
    },
    whyThisIsGood: ["題幹聚焦單一能力", "誘答具診斷性"],
    analysisStyleNote: "先說明正答，再拆解各誘答。",
    ...overrides,
  };
}

describe("few-shot examples", () => {
  it("只選入 teacher_reviewed 且 prompt_ready 的範例", () => {
    const selected = selectFewShotExamples({
      examples: [
        example({ exampleId: "CANDIDATE", status: "candidate" }),
        example({ exampleId: "NOT_READY", promptUseStatus: "not_ready_until_teacher_review" }),
        example({ exampleId: "READY" }),
      ],
      subject: "國語",
      grade: "四年級",
    });

    expect(selected.map((item) => item.exampleId)).toEqual(["READY"]);
  });

  it("最多只載入 4 題", () => {
    const selected = selectFewShotExamples({
      examples: Array.from({ length: 6 }, (_value, index) => example({ exampleId: `READY-${index + 1}` })),
      subject: "國語",
      grade: "四年級",
      limit: 4,
    });

    expect(selected).toHaveLength(4);
    expect(selected.map((item) => item.exampleId)).toEqual(["READY-1", "READY-2", "READY-3", "READY-4"]);
  });

  it("同科目與同年級範例排序優先", () => {
    const selected = selectFewShotExamples({
      examples: [
        example({ exampleId: "MATH", subject: "數學", grade: "六年級" }),
        example({ exampleId: "CHINESE-G4", subject: "國語文", grade: "國小四年級" }),
      ],
      subject: "國語",
      grade: "四年級",
      limit: 2,
    });

    expect(selected[0].exampleId).toBe("CHINESE-G4");
  });

  it("沒有可用範例時不渲染空殼區塊", () => {
    expect(renderFewShotExamples([])).toBe("");
  });

  it("渲染題感、誘答設計與解析示範", () => {
    const rendered = renderFewShotExamples([example({ exampleId: "READY" })]);

    expect(rendered).toContain("【few-shot 優良題範例】");
    expect(rendered).toContain("READY");
    expect(rendered).toContain("題幹聚焦單一能力");
    expect(rendered).toContain("keyword_trap");
    expect(rendered).toContain("先說明正答，再拆解各誘答。");
  });
});
