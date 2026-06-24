import { CHINESE_AUDIT_STRUCTURE, getChineseSubcategory } from "./questionTypes.js";

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getGradeCategory(grade) {
  const g = String(grade || "").trim();
  if (!g || g === "請選擇") return "";
  if (g.includes("一") || g.includes("二") || g.includes("1") || g.includes("2")) return "low";
  if (g.includes("三") || g.includes("四") || g.includes("3") || g.includes("4")) return "middle";
  return "high";
}

function getMandarinRecommendation(grade) {
  const category = getGradeCategory(grade);
  if (category === "low") {
    return { character: "50%", grammar: "30%", reading: "20%" };
  }
  if (category === "middle") {
    return { character: "30%", grammar: "50%", reading: "20%" };
  }
  if (category === "high") {
    return { character: "20%", grammar: "30%", reading: "50%" };
  }
  return { character: "—", grammar: "—", reading: "—" };
}

function numberToChinese(index) {
  const chars = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return chars[index - 1] || String(index);
}

// Group and format question numbers (e.g., "選擇題第1、2、3題")
function formatItemDistribution(matchedItems, itemNumbers) {
  if (matchedItems.length === 0) return "—";
  
  const typeMap = new Map();
  matchedItems.forEach((item) => {
    const type = item.questionType;
    if (!typeMap.has(type)) typeMap.set(type, []);
    const no = itemNumbers.get(item.itemId);
    if (no) typeMap.get(type).push(no);
  });

  return Array.from(typeMap.entries()).map(([type, nos]) => {
    return `${type}第${nos.join("、")}題`;
  }).join("、");
}

export function generateExcelXml({ project = {}, objectives = [], items = [], planRows = [], sections = [] } = {}) {
  const subject = project.subject || "";
  const isChinese = (subject === "國語");
  
  const itemById = new Map(items.map((item) => [item.itemId, item]));

  // Calculate local numbers for items in their sections
  const itemNumbers = new Map();
  sections.forEach((section) => {
    let questionNumber = 1;
    const renderedGroups = new Set();

    section.itemIds.forEach((itemId) => {
      const item = itemById.get(itemId);
      if (!item) return;

      const groupId = item.groupId;
      if (groupId) {
        const subNo = itemId.substring(itemId.lastIndexOf("-") + 1) || "1";
        if (renderedGroups.has(groupId)) {
          const majorNo = questionNumber - 1;
          itemNumbers.set(itemId, `${majorNo}(${subNo})`);
        } else {
          renderedGroups.add(groupId);
          itemNumbers.set(itemId, `${questionNumber}(${subNo})`);
          questionNumber++;
        }
      } else {
        itemNumbers.set(itemId, `${questionNumber}`);
        questionNumber++;
      }
    });
  });

  const totalScore = items.reduce((sum, item) => sum + (Number(item?.score) || 0), 0);

  // Common XML Styles
  const stylesXml = `
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="微軟正黑體" ss:Size="11" ss:Color="#000000"/>
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="微軟正黑體" ss:Size="16" ss:Bold="1"/>
    </Style>
    <Style ss:ID="MetaLabel">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="微軟正黑體" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaValue">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="微軟正黑體" ss:Size="11"/>
    </Style>
    <Style ss:ID="TableHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="微軟正黑體" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="TableCell">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="微軟正黑體" ss:Size="10"/>
    </Style>
    <Style ss:ID="TableCellCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="微軟正黑體" ss:Size="10"/>
    </Style>
    <Style ss:ID="TableCellBold">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="微軟正黑體" ss:Size="10" ss:Bold="1"/>
    </Style>
    <Style ss:ID="UnitTitle">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="微軟正黑體" ss:Size="12" ss:Bold="1"/>
    </Style>
  </Styles>`;

  let worksheetsXml = "";

  if (isChinese) {
    // Chinese (國語): 49-row Detailed Audit Table
    const recs = getMandarinRecommendation(project.grade);
    const checkedSubs = new Set(project.checkedChineseSubcategories || ["正確字音", "確認字形", "分辨部首", "字詞釋義", "句型辨識", "文句組成", "常用修辭", "提取訊息", "推論訊息", "主題習寫"]);

    // Build the sheet content
    let rowsHtml = "";

    // Header metadata row count helper
    const totalCols = 7;

    // Helper functions for merging
    // Row indices: dimension, project, item
    // CHINESE_AUDIT_STRUCTURE lists dimensions, projects, items.
    let structureRows = [];
    CHINESE_AUDIT_STRUCTURE.forEach((dimObj) => {
      dimObj.items.forEach((item, itemIdx) => {
        // Find dimension level items count
        const dimItemCount = CHINESE_AUDIT_STRUCTURE
          .filter(d => d.dimension === dimObj.dimension)
          .reduce((sum, d) => sum + d.items.length, 0);

        // Find project level items count
        const projItemCount = dimObj.items.length;

        // Find if it is the first row of dimension
        const isFirstDim = (dimObj.project === CHINESE_AUDIT_STRUCTURE.find(d => d.dimension === dimObj.dimension).project && itemIdx === 0);
        // Find if it is the first row of project
        const isFirstProj = (itemIdx === 0);

        structureRows.push({
          dimension: dimObj.dimension,
          project: dimObj.project,
          item: item,
          dimItemCount,
          projItemCount,
          isFirstDim,
          isFirstProj
        });
      });
    });

    // Generate XML Rows for objectives
    let dimensionScoreMap = { "字詞短語": 0, "句式語法": 0, "段篇讀寫": 0 };
    let projectScoreMap = {};
    
    // Pre-calculate project scores
    structureRows.forEach((r) => {
      const matchedItems = items.filter((x) => {
        const sub = x.chineseSubcategory || getChineseSubcategory(x.questionType, x.chineseDimension);
        return sub === r.item;
      });
      const score = matchedItems.reduce((sum, x) => sum + (Number(x.score) || 0), 0);
      dimensionScoreMap[r.dimension] += score;
      projectScoreMap[r.dimension + "_" + r.project] = (projectScoreMap[r.dimension + "_" + r.project] || 0) + score;
    });

    structureRows.forEach((r) => {
      const matchedItems = items.filter((x) => {
        const sub = x.chineseSubcategory || getChineseSubcategory(x.questionType, x.chineseDimension);
        return sub === r.item;
      });
      const itemScore = matchedItems.reduce((sum, x) => sum + (Number(x.score) || 0), 0);
      const itemDist = formatItemDistribution(matchedItems, itemNumbers);

      let rowXml = "      <Row ss:Height=\"22\">\n";

      // Column 1 & 2: Dimension
      if (r.isFirstDim) {
        const recPct = r.dimension === "字詞短語" ? recs.character : (r.dimension === "句式語法" ? recs.grammar : recs.reading);
        const dimScore = dimensionScoreMap[r.dimension];
        const dimPct = totalScore > 0 ? Math.round(dimScore / totalScore * 100) : 0;
        
        rowXml += `        <Cell ss:MergeDown="${r.dimItemCount - 1}" ss:StyleID="TableCellCenter"><Data ss:Type="String">建議佔分比&#10;${recPct}&#10;&#10;實際佔分&#10;${dimScore}分 (${dimPct}%)</Data></Cell>\n`;
        rowXml += `        <Cell ss:MergeDown="${r.dimItemCount - 1}" ss:StyleID="TableCellCenter"><Data ss:Type="String">${escapeXml(r.dimension)}</Data></Cell>\n`;
      }

      // Column 3: Project
      if (r.isFirstProj) {
        rowXml += `        <Cell ss:MergeDown="${r.projItemCount - 1}" ss:StyleID="TableCellCenter"><Data ss:Type="String">${escapeXml(r.project)}</Data></Cell>\n`;
      }

      // Column 4: Item (checked or not)
      const isChecked = checkedSubs.has(r.item);
      const checkMark = isChecked ? "☑" : "☐";
      rowXml += `        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${checkMark} ${escapeXml(r.item)}</Data></Cell>\n`;

      // Column 5: Question Distribution
      rowXml += `        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(itemDist)}</Data></Cell>\n`;

      // Column 6: Score
      rowXml += `        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="Number">${itemScore}</Data></Cell>\n`;

      // Column 7: Project Subtotal
      if (r.isFirstProj) {
        const projScore = projectScoreMap[r.dimension + "_" + r.project];
        rowXml += `        <Cell ss:MergeDown="${r.projItemCount - 1}" ss:StyleID="TableCellCenter"><Data ss:Type="Number">${projScore}</Data></Cell>\n`;
      }

      rowXml += "      </Row>\n";
      rowsHtml += rowXml;
    });

    worksheetsXml += `
  <Worksheet ss:Name="評量向度分析表">
    <Table ss:ExpandedColumnCount="7" ss:ExpandedRowCount="${55 + items.length}" x:FullColumns="1" x:FullRows="1">
      <Column ss:Width="100"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="150"/>
      <Column ss:Width="200"/>
      <Column ss:Width="60"/>
      <Column ss:Width="60"/>
      
      <!-- Row 1: Title -->
      <Row ss:Height="40">
        <Cell ss:MergeAcross="6" ss:StyleID="Title"><Data ss:Type="String">${escapeXml(project.schoolName || "學校名稱")}&#10;${escapeXml(project.schoolYear || "114")}學年度 ${escapeXml(project.semester || "第2學期")} ${escapeXml(project.examType || "定期評量")} 國語領域 試題審核表</Data></Cell>
      </Row>
      
      <!-- Row 2: Meta Row 1 -->
      <Row ss:Height="22">
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">年級／領域</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.grade)}／國語</Data></Cell>
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">命題教師</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.teacherName)}</Data></Cell>
      </Row>
      
      <!-- Row 3: Meta Row 2 -->
      <Row ss:Height="22">
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">評量範圍</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.range)}</Data></Cell>
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">版本</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.version)}</Data></Cell>
      </Row>
      
      <Row ss:Height="12"></Row>
      
      <!-- Table Headers -->
      <Row ss:Height="24">
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">分數佔比</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">評量向度</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">評量項目</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">細項舉例</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">入題</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">佔分</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">小計</Data></Cell>
      </Row>
      
      <!-- 49 Detailed Rows -->
      ${rowsHtml}
      
      <!-- Total Score Row -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="4" ss:StyleID="TableHeader"><Data ss:Type="String">總分</Data></Cell>
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="Number">${totalScore}</Data></Cell>
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="Number">${totalScore}</Data></Cell>
      </Row>
      
      <Row ss:Height="12"></Row>
      
      <!-- Self Audit Section -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="6" ss:StyleID="TableHeader"><Data ss:Type="String">命題者自評（打v或√表示達成） 簽名：____________________</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="TableCell"><Data ss:Type="String">扣緊教學目標(或學習目標)與合於節數比例之配分。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="TableCell"><Data ss:Type="String">教師自行命題，未直接使用教科書廠商提供之試題。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="TableCell"><Data ss:Type="String">預估試題鑑別度指數(高分組答對率-低分組答對率)在20以上。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="TableCell"><Data ss:Type="String">預估應試時間為每份卷40至60分鐘之間。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="TableCell"><Data ss:Type="String">內容符合學生能力與真實情境，無爭議性、悖於常理或違背法規。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="TableCell"><Data ss:Type="String">遵守迴避原則與保密原則。</Data></Cell>
      </Row>
      
      <Row ss:Height="12"></Row>
      
      <!-- Signatures Section -->
      <Row ss:Height="60">
        <Cell ss:MergeAcross="2" ss:StyleID="TableCell"><Data ss:Type="String">一審&#10;□傳閱  □共同討論&#10;&#10;審審教師：_________________</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="String"></Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="TableCell"><Data ss:Type="String">二審&#10;□傳閱  □共同討論&#10;&#10;審審教師：_________________</Data></Cell>
      </Row>
      <Row ss:Height="60">
        <Cell ss:MergeAcross="6" ss:StyleID="TableCell"><Data ss:Type="String">三審&#10;□傳閱  □共同討論&#10;&#10;審審教師：_________________</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>
    `;
  } else {
    // Non-Chinese subjects: 2D Grid Table split by Unit
    const unitsMap = new Map();
    objectives.forEach((obj) => {
      const uName = obj.unitName || "未分單元";
      if (!unitsMap.has(uName)) unitsMap.set(uName, []);
      unitsMap.get(uName).push(obj);
    });

    let unitIndex = 0;
    for (const [unitTitle, unitObjectives] of unitsMap.entries()) {
      const objIds = new Set(unitObjectives.map((o) => o.objectiveId));
      
      // Filter sections that are active in this unit
      const activeSections = sections.filter((sec) => {
        return sec.itemIds.some((id) => {
          const item = itemById.get(id);
          if (!item) return false;
          return (item.primaryObjectiveId && objIds.has(item.primaryObjectiveId)) || item.objectiveIds?.some((oId) => objIds.has(oId));
        });
      });

      const totalCols = Math.max(4, 3 + activeSections.length); // Col A: Objective, Col B: Empty, Col C: Period, Col D+: Sections
      const safeSheetName = (() => {
        let safe = unitTitle.replace(/[\\\/\?\*\[\]]/g, "").trim();
        if (safe.length > 25) safe = safe.substring(0, 25) + "...";
        return safe || `單元 ${unitIndex + 1}`;
      })();

      // Columns XML definition
      let columnsXml = `
      <Column ss:Width="280"/>
      <Column ss:Width="15"/>
      <Column ss:Width="60"/>
      `;
      activeSections.forEach(() => {
        columnsXml += '      <Column ss:Width="100"/>\n';
      });

      // Objectives rows
      let objectivesRowsXml = "";
      unitObjectives.forEach((obj) => {
        let rowXml = "      <Row ss:Height=\"22\">\n";
        rowXml += `        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(obj.text)}</Data></Cell>\n`;
        rowXml += '        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String"></Data></Cell>\n'; // Empty Column B
        rowXml += `        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">${escapeXml(obj.periodCount)}節</Data></Cell>\n`;

        activeSections.forEach((sec) => {
          const matchedNo = [];
          sec.itemIds.forEach((id) => {
            const item = itemById.get(id);
            if (!item) return;
            const matchesObj = item.primaryObjectiveId === obj.objectiveId || item.objectiveIds?.includes(obj.objectiveId);
            if (matchesObj) {
              const localNo = itemNumbers.get(id);
              if (localNo) matchedNo.push(localNo);
            }
          });
          const val = matchedNo.length > 0 ? `第 ${matchedNo.join("、")} 題` : "—";
          rowXml += `        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>\n`;
        });
        rowXml += "      </Row>\n";
        objectivesRowsXml += rowXml;
      });

      // Header row question type cells
      let qTypesHeaderCellsXml = "";
      activeSections.forEach((sec) => {
        const unitSecItems = sec.itemIds.filter((id) => {
          const item = itemById.get(id);
          if (!item) return false;
          return (item.primaryObjectiveId && objIds.has(item.primaryObjectiveId)) || item.objectiveIds?.some((oId) => objIds.has(oId));
        });
        const unitSecScore = unitSecItems.reduce((sum, id) => sum + (Number(itemById.get(id)?.score) || 0), 0);
        const unitSecPct = totalScore > 0 ? Math.round(unitSecScore / totalScore * 100) : 0;
        const secIndex = sections.indexOf(sec);
        const secOrderLabel = secIndex >= 0 ? `${numberToChinese(secIndex + 1)}、` : "";
        const label = `${secOrderLabel}${sec.title}(${unitSecPct}%)`;

        qTypesHeaderCellsXml += `        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(label)}</Data></Cell>\n`;
      });

      worksheetsXml += `
  <Worksheet ss:Name="${escapeXml(safeSheetName)}">
    <Table ss:ExpandedColumnCount="${totalCols}" ss:ExpandedRowCount="${50 + unitObjectives.length}" x:FullColumns="1" x:FullRows="1">
      ${columnsXml}
      
      <!-- Row 1: Title -->
      <Row ss:Height="40">
        <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="Title"><Data ss:Type="String">${escapeXml(project.schoolName || "學校名稱")}&#10;${escapeXml(project.schoolYear || "114")}學年度 ${escapeXml(project.semester || "第2學期")} ${escapeXml(project.examType || "定期評量")} 試題審核表</Data></Cell>
      </Row>
      
      <!-- Row 2: Metadata 1 -->
      <Row ss:Height="22">
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">年級／領域</Data></Cell>
        <Cell ss:MergeAcross="${Math.floor(totalCols/2) - 1}" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.grade)}／${escapeXml(project.subject)}</Data></Cell>
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">命題教師</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2 - Math.floor(totalCols/2)}" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.teacherName)}</Data></Cell>
      </Row>
      
      <!-- Row 3: Metadata 2 -->
      <Row ss:Height="22">
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">評量範圍</Data></Cell>
        <Cell ss:MergeAcross="${Math.floor(totalCols/2) - 1}" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.range)}</Data></Cell>
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">版本</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2 - Math.floor(totalCols/2)}" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.version)}</Data></Cell>
      </Row>
      
      <Row ss:Height="12"></Row>
      
      <!-- Row 5: Unit Name header -->
      <Row ss:Height="22">
        <Cell ss:MergeAcross="1" ss:StyleID="UnitTitle"><Data ss:Type="String">${escapeXml(unitTitle)}</Data></Cell>
        <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">授課節數</Data></Cell>
        <Cell ss:MergeAcross="${activeSections.length - 1}" ss:StyleID="TableHeader"><Data ss:Type="String">題型／配分</Data></Cell>
      </Row>
      
      <!-- Row 6: Table Headers -->
      <Row ss:Height="24">
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">學習目標</Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="TableHeader"><Data ss:Type="String">授課節數</Data></Cell>
        ${qTypesHeaderCellsXml}
      </Row>
      
      <!-- Objectives Rows -->
      ${objectivesRowsXml}
      
      <Row ss:Height="12"></Row>
      
      <!-- Self Audit Section -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="TableHeader"><Data ss:Type="String">命題者自評（打v或√表示達成） 簽名：____________________</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2}" ss:StyleID="TableCell"><Data ss:Type="String">扣緊教學目標(或學習目標)與合於節數比例之配分。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2}" ss:StyleID="TableCell"><Data ss:Type="String">教師自行命題，未直接使用教科書廠商提供之試題。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2}" ss:StyleID="TableCell"><Data ss:Type="String">預估試題鑑別度指數(高分組答對率-低分組答對率)在20以上。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2}" ss:StyleID="TableCell"><Data ss:Type="String">預估應試時間為每份卷40至60分鐘之間。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2}" ss:StyleID="TableCell"><Data ss:Type="String">內容符合學生能力與真實情境，無爭議性、悖於常理或違背法規。</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="TableCellCenter"><Data ss:Type="String">□</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 2}" ss:StyleID="TableCell"><Data ss:Type="String">遵守迴避原則與保密原則。</Data></Cell>
      </Row>
      
      <Row ss:Height="12"></Row>
      
      <!-- Signatures Section -->
      <Row ss:Height="60">
        <Cell ss:MergeAcross="${Math.floor(totalCols/3) - 1}" ss:StyleID="TableCell"><Data ss:Type="String">一審&#10;□傳閱  □共同討論&#10;&#10;審題教師：_________________</Data></Cell>
        <Cell ss:MergeAcross="${Math.floor(totalCols/3) - 1}" ss:StyleID="TableCell"><Data ss:Type="String">二審&#10;□傳閱  □共同討論&#10;&#10;審題教師：_________________</Data></Cell>
        <Cell ss:MergeAcross="${totalCols - 1 - 2*Math.floor(totalCols/3)}" ss:StyleID="TableCell"><Data ss:Type="String">三審&#10;□傳閱  □共同討論&#10;&#10;審題教師：_________________</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>
      `;
      unitIndex++;
    }
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>Exam Wizard</Author>
    <Created>2026-06-16T12:00:00Z</Created>
    <Version>16.00</Version>
  </DocumentProperties>
  ${stylesXml}
  ${worksheetsXml}
</Workbook>
  `.trim();
}
