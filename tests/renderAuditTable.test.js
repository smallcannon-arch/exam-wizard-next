import { describe, expect, it } from "vitest";
import { renderAuditTable } from "../frontend/src/core/renderAuditTable.js";

const objectives = [
  { objectiveId: "O-001", text: "3-1-1 觀察生鏽", periodCount: 3, unitName: "第一單元" },
  { objectiveId: "O-002", text: "3-1-2 實驗生鏽", periodCount: 2, unitName: "第一單元" },
];

const items = [
  { itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001", objectiveIds: ["O-001"] },
  { itemId: "Q-002-1", groupId: "G-002", questionType: "學力檢測題", score: 2, stimulus: "情境段落", primaryObjectiveId: "O-002", objectiveIds: ["O-002"], chineseDimension: "字詞短語" },
  { itemId: "Q-002-2", groupId: "G-002", questionType: "學力檢測題", score: 3, stimulus: "", primaryObjectiveId: "O-002", objectiveIds: ["O-002"], chineseDimension: "段篇讀寫" },
];

const sections = [
  { title: "選擇題", itemIds: ["Q-001"] },
  { title: "學力檢測題", itemIds: ["Q-002-1", "Q-002-2"] },
];

describe("renderAuditTable", () => {
  it("自然科輸出二維細目表", () => {
    const html = renderAuditTable({
      project: { subject: "自然科學", grade: "五年級", schoolYear: "114", semester: "第2學期", examType: "定期評量", teacherName: "江老師", range: "第一單元", version: "翰林版" },
      objectives,
      items,
      sections,
    });
    expect(html).toContain("學校名稱");
    expect(html).not.toContain("新竹市香山區內湖國小");
    expect(html).toContain("114學年度");
    expect(html).toContain("五年級／自然科學");
    // Should contain cell mapping like "第 1(1)、1(2) 題"
    expect(html).toContain("第 1(1)、1(2) 題");
  });

  it("uses the entered school name in the audit title", () => {
    const html = renderAuditTable({
      project: { schoolName: "測試國小", subject: "數學", grade: "五年級", schoolYear: "114", semester: "第2學期", examType: "定期評量", teacherName: "江老師", range: "第一單元", version: "翰林版" },
      objectives,
      items,
      sections,
    });

    expect(html).toContain("測試國小");
    expect(html).not.toContain("學校名稱");
    expect(html).not.toContain("新竹市香山區內湖國小");
  });

  it("國語科輸出評量向度分析表", () => {
    const html = renderAuditTable({
      project: { subject: "國語", grade: "五年級", schoolYear: "114", semester: "第2學期", examType: "定期評量", teacherName: "江老師", range: "第一單元", version: "康軒版" },
      objectives,
      items,
      sections,
    });
    expect(html).toContain("評量向度");
    expect(html).toContain("分數佔比");
    expect(html).toContain("字詞短語");
    expect(html).toContain("段篇讀寫");
    expect(html).toContain("4分 (57%)"); // Q-001 and Q-002-1 both map to 字詞短語 (total 4 pts out of 7 pts)
  });

  it("非國語科目輸出雙向細目表", () => {
    const html = renderAuditTable({
      project: { subject: "數學", grade: "五年級", schoolYear: "114", semester: "第2學期", examType: "定期評量", teacherName: "江老師", range: "第一單元", version: "翰林版" },
      objectives,
      items,
      sections,
    });
    expect(html).toContain("學習目標");
    expect(html).toContain("第一單元");
    expect(html).toContain("3節");
    expect(html).toContain("第 1 題");
    expect(html).toContain("第 1(1)、1(2) 題");
  });
});
