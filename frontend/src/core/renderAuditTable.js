import { CHINESE_AUDIT_STRUCTURE, getChineseSubcategory } from "./questionTypes.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function numberToChinese(index) {
  const chars = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return chars[index - 1] || String(index);
}

function getGradeCategory(grade) {
  const g = String(grade || "");
  if (g.includes("一") || g.includes("二") || g.includes("1") || g.includes("2")) return "low";
  if (g.includes("三") || g.includes("四") || g.includes("3") || g.includes("4")) return "middle";
  return "high"; // default to high (5, 6)
}

function getMandarinRecommendation(grade) {
  const category = getGradeCategory(grade);
  if (category === "low") {
    return { character: "50%", grammar: "30%", reading: "20%" };
  }
  if (category === "middle") {
    return { character: "30%", grammar: "50%", reading: "20%" };
  }
  return { character: "20%", grammar: "30%", reading: "50%" };
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

export function renderAuditTable({ project = {}, objectives = [], items = [], planRows = [], sections = [] } = {}) {
  const subject = project.subject || "";
  const isNatural = (subject === "自然" || subject === "自然科學");
  const isChinese = (subject === "國語");

  const itemById = new Map(items.map((item) => [item.itemId, item]));

  // Calculate local numbers for items in their sections
  const itemNumbers = new Map(); // itemId -> string e.g. "1" or "5(1)" or "5(2)"
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

  // Helper for self-audit checklist and signatures
  const footerHtml = `
    <div class="audit-footer" style="margin-top:24px;">
      <table class="self-audit-table" style="width:100%; border-collapse:collapse; margin-bottom:16px;">
        <thead>
          <tr>
            <th colspan="2" style="border:1px solid #000; padding:8px; background:#f5f5f5; text-align:left;">命題者自評（打v或√表示達成） 簽名：____________________</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #000; padding:6px 10px; width:40px; text-align:center;">□</td>
            <td style="border:1px solid #000; padding:6px 10px;">扣緊教學目標(或學習目標)與合於節數比例之配分。</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px 10px; text-align:center;">□</td>
            <td style="border:1px solid #000; padding:6px 10px;">教師自行命題，未直接使用教科書廠商提供之試題。</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px 10px; text-align:center;">□</td>
            <td style="border:1px solid #000; padding:6px 10px;">預估試題鑑別度指數(高分組答對率-低分組答對率)在20以上。</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px 10px; text-align:center;">□</td>
            <td style="border:1px solid #000; padding:6px 10px;">預估應試時間為每份卷40至60分鐘之間。</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px 10px; text-align:center;">□</td>
            <td style="border:1px solid #000; padding:6px 10px;">內容符合學生能力與真實情境，無爭議性、悖於常理或違背法規。</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px 10px; text-align:center;">□</td>
            <td style="border:1px solid #000; padding:6px 10px;">遵守迴避原則與保密原則。</td>
          </tr>
        </tbody>
      </table>

      <table class="signatures-table" style="width:100%; border-collapse:collapse;">
        <tbody>
          <tr>
            <td style="border:1px solid #000; padding:12px; width:33.3%;">
              <strong>一審</strong><br>
              □傳閱 □共同討論<br><br>
              審審教師：_________________
            </td>
            <td style="border:1px solid #000; padding:12px; width:33.3%;">
              <strong>二審</strong><br>
              □傳閱 □共同討論<br><br>
              審審教師：_________________
            </td>
            <td style="border:1px solid #000; padding:12px; width:33.3%;">
              <strong>三審</strong><br>
              □傳閱 □共同討論<br><br>
              審審教師：_________________
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const headerHtml = `
    <div class="audit-header" style="text-align:center; margin-bottom:16px;">
      <h2 style="margin:0 0 6px 0; font-size:20px;">新竹市香山區內湖國小</h2>
      <h3 style="margin:0 0 12px 0; font-size:16px;">${escapeHtml(project.schoolYear || "114")}學年度 ${escapeHtml(project.semester || "第2學期")} ${escapeHtml(project.examType || "定期評量")} 試題審核表</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000; padding:6px; width:15%; background:#f5f5f5;"><strong>年級／領域</strong></td>
          <td style="border:1px solid #000; padding:6px; width:35%;">${escapeHtml(project.grade)}／${escapeHtml(project.subject)}</td>
          <td style="border:1px solid #000; padding:6px; width:15%; background:#f5f5f5;"><strong>命題教師</strong></td>
          <td style="border:1px solid #000; padding:6px; width:35%;">${escapeHtml(project.teacherName)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:6px; background:#f5f5f5;"><strong>評量範圍</strong></td>
          <td style="border:1px solid #000; padding:6px;">${escapeHtml(project.range)}</td>
          <td style="border:1px solid #000; padding:6px; background:#f5f5f5;"><strong>版本</strong></td>
          <td style="border:1px solid #000; padding:6px;">${escapeHtml(project.version)}</td>
        </tr>
      </table>
    </div>
  `;

  if (isChinese) {
    // Chinese (國語): 49-row Detailed Audit Table matching the DOCX template
    const recs = getMandarinRecommendation(project.grade);
    const checkedSubs = new Set(project.checkedChineseSubcategories || ["正確字音", "確認字形", "分辨部首", "字詞釋義", "句型辨識", "文句組成", "常用修辭", "提取訊息", "推論訊息", "主題習寫"]);

    let rowsHtml = "";

    // Flat structure for rendering
    let structureRows = [];
    CHINESE_AUDIT_STRUCTURE.forEach((dimObj) => {
      dimObj.items.forEach((item, itemIdx) => {
        const dimItemCount = CHINESE_AUDIT_STRUCTURE
          .filter(d => d.dimension === dimObj.dimension)
          .reduce((sum, d) => sum + d.items.length, 0);

        const projItemCount = dimObj.items.length;
        const isFirstDim = (dimObj.project === CHINESE_AUDIT_STRUCTURE.find(d => d.dimension === dimObj.dimension).project && itemIdx === 0);
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

    let dimensionScoreMap = { "字詞短語": 0, "句式語法": 0, "段篇讀寫": 0 };
    let projectScoreMap = {};
    
    // Precalculate scores
    structureRows.forEach((r) => {
      const matchedItems = items.filter((x) => {
        const sub = x.chineseSubcategory || getChineseSubcategory(x.questionType, x.chineseDimension);
        return sub === r.item;
      });
      const score = matchedItems.reduce((sum, x) => sum + (Number(x.score) || 0), 0);
      dimensionScoreMap[r.dimension] += score;
      projectScoreMap[r.dimension + "_" + r.project] = (projectScoreMap[r.dimension + "_" + r.project] || 0) + score;
    });

    rowsHtml = structureRows.map((r) => {
      const matchedItems = items.filter((x) => {
        const sub = x.chineseSubcategory || getChineseSubcategory(x.questionType, x.chineseDimension);
        return sub === r.item;
      });
      const itemScore = matchedItems.reduce((sum, x) => sum + (Number(x.score) || 0), 0);
      const itemDist = formatItemDistribution(matchedItems, itemNumbers);

      let rowHtml = "<tr>";

      if (r.isFirstDim) {
        const recPct = r.dimension === "字詞短語" ? recs.character : (r.dimension === "句式語法" ? recs.grammar : recs.reading);
        const dimScore = dimensionScoreMap[r.dimension];
        const dimPct = totalScore > 0 ? Math.round(dimScore / totalScore * 100) : 0;
        
        rowHtml += `<td rowspan="${r.dimItemCount}" style="border:1px solid #000; padding:6px; text-align:center; font-size:13px; font-weight:bold; background:#fafafa;">建議：${recPct}<br><br>實際：<br>${dimScore}分 (${dimPct}%)</td>`;
        rowHtml += `<td rowspan="${r.dimItemCount}" style="border:1px solid #000; padding:6px; text-align:center; font-size:13px; font-weight:bold; background:#fafafa;">${r.dimension}</td>`;
      }

      if (r.isFirstProj) {
        rowHtml += `<td rowspan="${r.projItemCount}" style="border:1px solid #000; padding:6px; text-align:center; font-size:13px; font-weight:bold; background:#fafafa;">${r.project}</td>`;
      }

      const isChecked = checkedSubs.has(r.item);
      const checkMark = isChecked ? "☑" : "☐";
      rowHtml += `<td style="border:1px solid #000; padding:6px; font-size:13px; text-align:left;">${checkMark} ${r.item}</td>`;
      rowHtml += `<td style="border:1px solid #000; padding:6px; font-size:13px; text-align:left;">${escapeHtml(itemDist)}</td>`;
      rowHtml += `<td style="border:1px solid #000; padding:6px; font-size:13px; text-align:center;">${itemScore || ""}</td>`;

      if (r.isFirstProj) {
        const projScore = projectScoreMap[r.dimension + "_" + r.project];
        rowHtml += `<td rowspan="${r.projItemCount}" style="border:1px solid #000; padding:6px; text-align:center; font-size:13px; font-weight:bold;">${projScore || ""}</td>`;
      }

      rowHtml += "</tr>";
      return rowHtml;
    }).join("");

    return `
      <div class="audit-table-print" style="font-family:'Microsoft JhengHei', sans-serif; color:#000;">
        ${headerHtml}
        <div style="margin: 12px 0; padding: 10px 14px; background: #fafafa; border: 1px solid #eee; border-radius: 6px; font-size: 13px; color: #444; line-height: 1.6; text-align: left;">
          <strong>💡 許育健教授國語科評量向度佔分比例建議：</strong><br>
          • <strong>低年級</strong>（一、二年級）：字詞短語 50% ｜ 句式語法 30% ｜ 段篇讀寫 20%<br>
          • <strong>中年級</strong>（三、四年級）：字詞短語 30% ｜ 句式語法 50% ｜ 段篇讀寫 20%<br>
          • <strong>高年級</strong>（五、六年級）：字詞短語 20% ｜ 句式語法 30% ｜ 段篇讀寫 50%<br>
          （目前本份試卷適用年段：<strong style="color:var(--primary); font-size:14px;">${getGradeCategory(project.grade) === "low" ? "低年級" : (getGradeCategory(project.grade) === "middle" ? "中年級" : "高年級")}</strong>）
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; width:15%; font-size:13px;">分數佔比</th>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; width:10%; font-size:13px;">評量向度</th>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; width:10%; font-size:13px;">評量項目</th>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; width:18%; font-size:13px;">細項舉例</th>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; text-align:left; font-size:13px;">入題</th>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; width:8%; font-size:13px;">佔分</th>
              <th style="border:1px solid #000; padding:6px; background:#f5f5f5; width:8%; font-size:13px;">小計</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight:bold; background:#f5f5f5;">
              <td colspan="5" style="border:1px solid #000; padding:8px; text-align:center;">總分</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">${totalScore}分</td>
              <td style="border:1px solid #000; padding:8px; text-align:center;">${totalScore}分</td>
            </tr>
          </tbody>
        </table>
        ${footerHtml}
      </div>
    `;
  }

  // 2D grid table (雙向細目表) for all other subjects (Science, Math, Social, English)
  // Group objectives by unit
  const unitsMap = new Map();
  objectives.forEach((obj) => {
    const uName = obj.unitName || "未分單元";
    if (!unitsMap.has(uName)) unitsMap.set(uName, []);
    unitsMap.get(uName).push(obj);
  });

  const tablesHtml = Array.from(unitsMap.entries()).map(([unitTitle, unitObjectives]) => {
    const objIds = new Set(unitObjectives.map((o) => o.objectiveId));
    
    // Filter sections that have matched items in this unit
    const activeSections = sections.filter((sec) => {
      return sec.itemIds.some((id) => {
        const item = itemById.get(id);
        if (!item) return false;
        return (item.primaryObjectiveId && objIds.has(item.primaryObjectiveId)) || item.objectiveIds?.some((oId) => objIds.has(oId));
      });
    });

    const qTypesHtml = activeSections.map((sec) => {
      // Calculate total score of this section in this unit
      const unitSecItems = sec.itemIds.filter((id) => {
        const item = itemById.get(id);
        if (!item) return false;
        return (item.primaryObjectiveId && objIds.has(item.primaryObjectiveId)) || item.objectiveIds?.some((oId) => objIds.has(oId));
      });
      const unitSecScore = unitSecItems.reduce((sum, id) => sum + (Number(itemById.get(id)?.score) || 0), 0);
      const unitSecPct = totalScore > 0 ? Math.round(unitSecScore / totalScore * 100) : 0;
      
      const secIndex = sections.indexOf(sec);
      const secOrderLabel = secIndex >= 0 ? `${numberToChinese(secIndex + 1)}、` : "";
      
      return `<th style="border:1px solid #000; padding:8px; background:#f5f5f5; font-size:13px; width:100px;">
        ${secOrderLabel}${sec.title}(${unitSecPct}%)
      </th>`;
    }).join("");

    const rowsHtml = unitObjectives.map((obj) => {
      const cellsHtml = activeSections.map((sec) => {
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
        return `<td style="border:1px solid #000; padding:8px; text-align:center; font-size:13px;">
          ${matchedNo.length > 0 ? `第 ${matchedNo.join("、")} 題` : "—"}
        </td>`;
      }).join("");

      return `<tr>
        <td style="border:1px solid #000; padding:8px; text-align:left; font-size:13px; line-height:1.4;">${escapeHtml(obj.text)}</td>
        <td style="border:1px solid #000; padding:8px; text-align:center; font-size:13px; font-weight:bold;">${escapeHtml(obj.periodCount)}節</td>
        ${cellsHtml}
      </tr>`;
    }).join("");

    return `
      <h4 style="margin:16px 0 8px 0; font-size:15px; color:#333; text-align:left; border-left:4px solid var(--primary); padding-left:8px;">${escapeHtml(unitTitle)}</h4>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <thead>
          <tr>
            <th style="border:1px solid #000; padding:8px; background:#f5f5f5; text-align:left; width: 350px;">學習目標</th>
            <th style="border:1px solid #000; padding:8px; background:#f5f5f5; width:80px;">授課節數</th>
            ${qTypesHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }).join("");

  return `
    <div class="audit-table-print" style="font-family:'Microsoft JhengHei', sans-serif; color:#000;">
      ${headerHtml}
      ${tablesHtml}
      ${footerHtml}
    </div>
  `;
}
