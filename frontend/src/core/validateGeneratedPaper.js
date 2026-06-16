// 題位制的生成後檢核：題型與配分需與題位相符；每題須指派有效的學習目標；
// 題數與總分需正確（以上為「錯誤」，會擋下匯入）。
// 「目標覆蓋」改為「提醒」：目標很細時不一定每個都出到題，僅提示、不擋下。
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getPrimaryObjective(item) {
  if (hasText(item?.primaryObjectiveId)) return item.primaryObjectiveId.trim();
  if (Array.isArray(item?.objectiveIds)) {
    const first = item.objectiveIds.find((id) => hasText(id));
    if (first) return first.trim();
  }
  return "";
}

function getParentId(itemId) {
  const id = normalizeId(itemId);
  const hyphenCount = (id.match(/-/g) || []).length;
  if (hyphenCount > 1) {
    const hyphenIndex = id.lastIndexOf("-");
    return id.substring(0, hyphenIndex);
  }
  return id;
}

function isGroupItem(itemId) {
  const id = normalizeId(itemId);
  return (id.match(/-/g) || []).length > 1;
}

export function validateGeneratedPaper({ slots = [], objectives = [], items = [] } = {}) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(slots) || slots.length === 0) {
    return { ok: false, errors: ["缺少題位資料，請先建立藍圖。"], warnings };
  }
  if (!Array.isArray(items)) {
    return { ok: false, errors: ["AI 回傳 items 不是陣列。"], warnings };
  }

  const objectiveIdSet = new Set(objectives.map((objective) => normalizeId(objective?.objectiveId)).filter(Boolean));
  const slotById = new Map(slots.map((slot) => [normalizeId(slot.itemId), slot]));
  const covered = new Set();

  // Group items by parent ID (e.g. "Q-041-1" -> "Q-041", "Q-001" -> "Q-001")
  const itemsByParentId = new Map();
  for (const item of items) {
    if (!isPlainObject(item)) {
      errors.push("AI 回傳某題不是物件。");
      continue;
    }
    const id = normalizeId(item.itemId);
    if (!id) {
      errors.push("某題缺少 itemId。");
      continue;
    }

    const parentId = getParentId(id);
    if (!itemsByParentId.has(parentId)) {
      itemsByParentId.set(parentId, []);
    }
    itemsByParentId.get(parentId).push(item);
  }

  const seenParentIds = new Set();

  for (const [parentId, groupItems] of itemsByParentId.entries()) {
    const slot = slotById.get(parentId);
    if (!slot) {
      errors.push(`${parentId}：不在題位清單內。`);
      continue;
    }
    seenParentIds.add(parentId);

    const expectsGroup = !!slot.isGroup;
    const isGroup = expectsGroup || groupItems.length > 1 || isGroupItem(groupItems[0].itemId);

    if (isGroup) {
      if (normalizeId(slot.questionType) !== "學力檢測題" && !slot.isGroup) {
        errors.push(`${parentId}：該題型為「${slot.questionType}」，不可拆分為子題（請在藍圖中勾選為題組）。`);
      }

      if (expectsGroup && groupItems.length === 1 && !isGroupItem(groupItems[0].itemId)) {
        errors.push(`${parentId}：該題位設定為題組，但 AI 回傳為單題。`);
      }

      const subItemIds = new Set();
      let totalGroupScore = 0;
      let hasStimulus = false;

      // 檢查 groupId
      const groupIds = new Set();
      for (const item of groupItems) {
        const gid = normalizeId(item.groupId);
        const subId = normalizeId(item.itemId);
        if (!gid) {
          errors.push(`${subId}：題組子題缺少 groupId。`);
        } else {
          groupIds.add(gid);
        }
      }
      if (groupIds.size > 1) {
        errors.push(`${parentId}：題組子題的 groupId 必須相同（目前有：${Array.from(groupIds).join("、")}）。`);
      }

      for (const item of groupItems) {
        const subId = normalizeId(item.itemId);
        if (subItemIds.has(subId)) {
          errors.push(`${subId}：AI 回傳重複子題號。`);
        }
        subItemIds.add(subId);

        if (!isGroupItem(subId) || getParentId(subId) !== parentId) {
          errors.push(`${subId}：題組子題的題號格式應為「${parentId}-數字」（如 ${parentId}-1）。`);
        }

        totalGroupScore += Number(item.score || 0);

        if (hasText(item.stimulus)) {
          hasStimulus = true;
        }

        if (!hasText(item.question)) {
          errors.push(`${subId}：缺少 question。`);
        }
        if (!hasText(item.answer)) {
          errors.push(`${subId}：缺少 answer。`);
        }

        const CHOICE_LIKE = ["選擇題", "圖表判讀題", "實驗探究題", "學力檢測題", "閱讀測驗"];
        if (CHOICE_LIKE.includes(normalizeId(item.questionType))) {
          const optionCount = Array.isArray(item.options) ? item.options.length : 0;
          if (optionCount < 2) {
            errors.push(`${subId}：${item.questionType}子題採選擇題形式，缺少選項。`);
          } else if (optionCount < 4) {
            warnings.push(`提醒：${subId}（${item.questionType}子題）只有 ${optionCount} 個選項（建議 4 個）。`);
          }
        }

        const primary = getPrimaryObjective(item);
        if (!primary) {
          errors.push(`${subId}：缺少對應學習目標。`);
        } else if (normalizeId(slot.primaryObjectiveId) && primary !== normalizeId(slot.primaryObjectiveId)) {
          errors.push(`${subId}：對應學習目標應為「${slot.primaryObjectiveId}」，不可更動。`);
        } else if (objectiveIdSet.size > 0 && !objectiveIdSet.has(primary)) {
          errors.push(`${subId}：對應目標 ${primary} 不在學習目標清單內。`);
        }

        if (Array.isArray(item.objectiveIds)) {
          for (const objectiveId of item.objectiveIds) {
            const normalized = normalizeId(objectiveId);
            if (objectiveIdSet.has(normalized)) covered.add(normalized);
          }
        }
        if (objectiveIdSet.has(primary)) covered.add(primary);
      }

      // 依子題編號尾碼的數字大小進行排序，避免 lexical 排序（如 10 排在 2 前面）
      const sortedGroupItems = [...groupItems].sort((a, b) => {
        const partsA = normalizeId(a.itemId).split("-");
        const partsB = normalizeId(b.itemId).split("-");
        const numA = parseInt(partsA[partsA.length - 1], 10) || 0;
        const numB = parseInt(partsB[partsB.length - 1], 10) || 0;
        return numA - numB;
      });

      const expectedSubScores = Array.isArray(slot.subScores) ? slot.subScores : [];
      if (expectedSubScores.length > 0) {
        if (sortedGroupItems.length !== expectedSubScores.length) {
          errors.push(`${parentId}：子題數量為 ${sortedGroupItems.length}，與題位設定的 ${expectedSubScores.length} 子題數不符。`);
        } else {
          for (let i = 0; i < expectedSubScores.length; i++) {
            const expectedScore = Number(expectedSubScores[i]);
            const actualScore = Number(sortedGroupItems[i].score || 0);
            if (actualScore !== expectedScore) {
              errors.push(`${normalizeId(sortedGroupItems[i].itemId)}：子題配分應為 ${expectedScore} 分，但實際為 ${actualScore} 分。`);
            }
          }
        }
      } else {
        if (totalGroupScore !== Number(slot.score)) {
          errors.push(`${parentId}：子題配分總和為 ${totalGroupScore} 分，但題位設定配分為 ${slot.score} 分，配分不合。`);
        }
      }

      if (!hasStimulus) {
        errors.push(`${parentId}：題組缺少共同的 stimulus (引言 / 情境段落)。`);
      }

    } else {
      const item = groupItems[0];
      const id = normalizeId(item.itemId);

      if (normalizeId(item.questionType) !== normalizeId(slot.questionType)) {
        errors.push(`${id}：題型應為「${slot.questionType}」，不可更動。`);
      }
      if (Number(item.score) !== Number(slot.score)) {
        errors.push(`${id}：配分應為 ${slot.score} 分，不可更動。`);
      }
      if (!hasText(item.question)) {
        errors.push(`${id}：缺少 question。`);
      }
      if (!hasText(item.answer)) {
        errors.push(`${id}：缺少 answer。`);
      }

      const CHOICE_LIKE = ["選擇題", "圖表判讀題", "實驗探究題", "閱讀測驗"];
      if (CHOICE_LIKE.includes(normalizeId(item.questionType))) {
        const optionCount = Array.isArray(item.options) ? item.options.length : 0;
        if (optionCount < 2) {
          errors.push(`${id}：${item.questionType}採選擇題形式，缺少選項。`);
        } else if (optionCount < 4) {
          warnings.push(`提醒：${id}（${item.questionType}）只有 ${optionCount} 個選項（建議 4 個）。`);
        }
      }

      const primary = getPrimaryObjective(item);
      if (!primary) {
        errors.push(`${id}：缺少對應學習目標。`);
      } else if (normalizeId(slot.primaryObjectiveId) && primary !== normalizeId(slot.primaryObjectiveId)) {
        errors.push(`${id}：對應學習目標應為「${slot.primaryObjectiveId}」，不可更動。`);
      } else if (objectiveIdSet.size > 0 && !objectiveIdSet.has(primary)) {
        errors.push(`${id}：對應目標 ${primary} 不在學習目標清單內。`);
      }

      if (Array.isArray(item.objectiveIds)) {
        for (const objectiveId of item.objectiveIds) {
          const normalized = normalizeId(objectiveId);
          if (objectiveIdSet.has(normalized)) covered.add(normalized);
        }
      }
      if (objectiveIdSet.has(primary)) covered.add(primary);
    }
  }

  for (const slot of slots) {
    if (!seenParentIds.has(normalizeId(slot.itemId))) {
      errors.push(`${slot.itemId}：AI 未回傳此題。`);
    }
  }

  const uncovered = [];
  for (const objectiveId of objectiveIdSet) {
    if (!covered.has(objectiveId)) uncovered.push(objectiveId);
  }
  if (uncovered.length > 0) {
    warnings.push(`提醒：以下學習目標未被任何題目覆蓋，可重新生成或自行補強：${uncovered.join("、")}。`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
