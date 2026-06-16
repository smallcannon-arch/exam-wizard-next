import { describe, expect, it } from "vitest";
import { generateExcelXml } from "../frontend/src/core/excelGenerator.js";

const objectives = [
  { objectiveId: "O-001", text: "3-1-1 觀察生鏽", periodCount: 3, unitName: "第一單元" },
  { objectiveId: "O-002", text: "3-1-2 實驗生鏽", periodCount: 2, unitName: "第一單元" },
  { objectiveId: "O-003", text: "4-1-1 動物適應", periodCount: 4, unitName: "第二單元" },
];

const items = [
  { itemId: "Q-001", questionType: "選擇題", score: 2, primaryObjectiveId: "O-001", objectiveIds: ["O-001"] },
  { itemId: "Q-002", questionType: "是非題", score: 2, primaryObjectiveId: "O-002", objectiveIds: ["O-002"] },
  { itemId: "Q-003", questionType: "學力檢測題", score: 5, primaryObjectiveId: "O-003", objectiveIds: ["O-003"], chineseDimension: "字詞短語", chineseSubcategory: "正確字音" },
];

const sections = [
  { title: "選擇題", itemIds: ["Q-001"] },
  { title: "是非題", itemIds: ["Q-002"] },
  { title: "學力檢測題", itemIds: ["Q-003"] },
];

describe("excelGenerator", () => {
  it("自然科生成多個 Worksheets 工作表", () => {
    const xml = generateExcelXml({
      project: { subject: "自然", grade: "五年級", schoolYear: "114", semester: "第2學期", examType: "定期評量", teacherName: "江志宏", range: "第一至二單元", version: "翰林版" },
      objectives,
      items,
      sections,
    });
    
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('progid="Excel.Sheet"');
    // Should contain separate sheets for the two units
    expect(xml).toContain('ss:Name="第一單元"');
    expect(xml).toContain('ss:Name="第二單元"');
    expect(xml).toContain("江志宏");
    expect(xml).toContain("新竹市香山區內湖國小");
  });

  it("國語科生成單一評量向度分析表工作表", () => {
    const xml = generateExcelXml({
      project: { subject: "國語", grade: "五年級", schoolYear: "114", semester: "第2學期", examType: "定期評量", teacherName: "江老師", range: "第一至五課", version: "康軒版" },
      objectives,
      items,
      sections,
    });

    expect(xml).toContain('ss:Name="評量向度分析表"');
    expect(xml).toContain("正確字音");
    expect(xml).toContain("確認字形");
    expect(xml).toContain("江老師");
  });
});
