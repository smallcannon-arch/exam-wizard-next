import { describe, expect, it } from "vitest";
import { renderStudentPaper, renderTeacherPaper } from "../frontend/src/core/renderPaper.js";

const project = { examName: "混合題型測試卷" };

const sections = [{
  title: "混合題型",
  itemIds: ["Q-001", "Q-002", "Q-003", "Q-004-1", "Q-004-2"],
}];

const items = [
  {
    itemId: "Q-001",
    questionType: "選擇題",
    score: 2,
    question: "哪一種是節能行為？",
    options: ["隨手關燈", "整天開燈", "冷氣開最低", "電腦不關機"],
    answer: "A",
  },
  {
    itemId: "Q-002",
    questionType: "是非題",
    score: 2,
    question: "水加熱後會蒸發。",
    options: ["SHOULD_NOT_RENDER_TRUE_FALSE_A", "SHOULD_NOT_RENDER_TRUE_FALSE_B"],
    answer: "O",
  },
  {
    itemId: "Q-003",
    questionType: "填充題",
    score: 2,
    question: "燃燒需要的氣體是什麼？",
    options: ["SHOULD_NOT_RENDER_FILL_A", "SHOULD_NOT_RENDER_FILL_B"],
    answer: "氧氣",
  },
  {
    itemId: "Q-004-1",
    groupId: "G-004",
    questionType: "學力檢測題",
    score: 2,
    stimulus: "閱讀下列校園節能資料。",
    question: "哪一項做法最能節省用電？",
    options: ["隨手關燈", "整天開燈", "冷氣開最低", "電腦不關機"],
    answer: "A",
  },
  {
    itemId: "Q-004-2",
    groupId: "G-004",
    questionType: "學力檢測題",
    score: 2,
    stimulus: "",
    question: "資料中的節能行動主要提醒我們什麼？",
    options: ["節約能源", "增加耗電", "忽略環境", "只看標題"],
    answer: "A",
  },
];

describe("renderPaper typed rendering", () => {
  it("does not render true/false or fill-in items as A-D choice options", () => {
    const studentPaper = renderStudentPaper({ project, sections, items });
    const teacherPaper = renderTeacherPaper({ project, sections, items });
    const combined = `${studentPaper}\n${teacherPaper}`;

    expect(combined).not.toContain("SHOULD_NOT_RENDER_TRUE_FALSE_A");
    expect(combined).not.toContain("SHOULD_NOT_RENDER_FILL_A");
    expect(combined).not.toContain("SHOULD_NOT_RENDER_FILL_B");
    expect(combined).toContain("(A) 隨手關燈");
  });

  it("keeps mixed items in requested order including group subitems", () => {
    const studentPaper = renderStudentPaper({ project, sections, items });

    const choiceIndex = studentPaper.indexOf("哪一種是節能行為？");
    const trueFalseIndex = studentPaper.indexOf("水加熱後會蒸發。");
    const fillInIndex = studentPaper.indexOf("燃燒需要的氣體是什麼？");
    const stimulusIndex = studentPaper.indexOf("閱讀下列校園節能資料。");
    const firstGroupQuestionIndex = studentPaper.indexOf("哪一項做法最能節省用電？");
    const secondGroupQuestionIndex = studentPaper.indexOf("資料中的節能行動主要提醒我們什麼？");

    expect(choiceIndex).toBeGreaterThanOrEqual(0);
    expect(trueFalseIndex).toBeGreaterThan(choiceIndex);
    expect(fillInIndex).toBeGreaterThan(trueFalseIndex);
    expect(stimulusIndex).toBeGreaterThan(fillInIndex);
    expect(firstGroupQuestionIndex).toBeGreaterThan(stimulusIndex);
    expect(secondGroupQuestionIndex).toBeGreaterThan(firstGroupQuestionIndex);
  });
});
