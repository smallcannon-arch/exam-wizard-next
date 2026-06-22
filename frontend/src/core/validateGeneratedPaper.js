// 題位制的生成後檢核：題型與配分需與題位相符；每題須指派有效的學習目標；
// 題數與總分需正確（以上為「錯誤」，會擋下匯入）。
// 「目標覆蓋」改為「提醒」：目標很細時不一定每個都出到題，僅提示、不擋下。
import {
  QUALITY_META_DISTRACTOR_REQUIRED_FIELDS,
  QUALITY_META_REQUIRED_FIELDS,
  QUALITY_META_SELF_CHECK_FIELDS,
} from "./schema.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

const CONTEXT_REFERENCE_PHRASES = [
  "根據這段文字",
  "根據這篇文章",
  "根據本文",
  "根據上文",
  "根據下文",
  "根據短文",
  "根據文章",
  "根據文中",
  "依據本文",
  "依據上文",
  "依據下文",
  "閱讀下文",
  "閱讀本文",
  "讀完本文",
  "讀完短文",
  "文中提到",
  "文章中提到",
  "短文中",
  "這段文字",
  "這篇文章",
  "上述內容",
  "以上內容",
  "下文中",
  "上文中",
];

function referencesExternalText(value) {
  const normalized = normalizeId(value);
  return CONTEXT_REFERENCE_PHRASES.some((phrase) => normalized.includes(phrase));
}

function needsStimulus(item) {
  return normalizeId(item?.questionType) === "閱讀測驗" || referencesExternalText(item?.question);
}

function getPrimaryObjective(item) {
  if (hasText(item?.primaryObjectiveId)) return item.primaryObjectiveId.trim();
  if (Array.isArray(item?.objectiveIds)) {
    const first = item.objectiveIds.find((id) => hasText(id));
    if (first) return first.trim();
  }
  return "";
}

// 向度鎖定檢核：題位（slot）有鎖定向度時，AI 回傳的 chineseDimension 必須一致。
// 用「警示」而非「錯誤」——不阻擋匯入（避免教材目標模式靠題型推估向度時動輒整卷重生），
// 僅提示老師到修題畫面確認／修正。slot.chineseDimension 只在國語才會設值，故隱含限國語。
function dimensionLockWarning(item, slot) {
  const locked = normalizeId(slot?.chineseDimension);
  const got = normalizeId(item?.chineseDimension);
  if (locked && got && got !== locked) {
    return `提醒：${normalizeId(item?.itemId)} 的評量向度 AI 回傳「${got}」與題位鎖定「${locked}」不符，已沿用，匯入後請於修題畫面確認或修正。`;
  }
  return "";
}

function getParentId(itemId) {
  const id = normalizeId(itemId);
  if (isGroupItem(id)) {
    const hyphenIndex = id.lastIndexOf("-");
    return id.substring(0, hyphenIndex);
  }
  return id;
}

function isGroupItem(itemId) {
  const id = normalizeId(itemId);
  return /-[1-9]\d*$/.test(id) && (id.match(/-/g) || []).length > 1;
}

const CHOICE_LIKE_TYPES = ["選擇題", "圖表判讀題", "實驗探究題", "學力檢測題", "閱讀測驗"];

function optionKey(index) {
  return String.fromCharCode(65 + index);
}

function normalizeAnswerKey(value) {
  const text = normalizeId(value).toUpperCase().replace(/[()（）\s.。]/g, "");
  return /^[A-D]$/.test(text) ? text : "";
}

function answerMatchesOptions(item) {
  const options = Array.isArray(item?.options) ? item.options : [];
  if (options.length === 0) return false;

  const answerKey = normalizeAnswerKey(item?.answer);
  if (answerKey) {
    const index = answerKey.charCodeAt(0) - 65;
    return index >= 0 && index < options.length;
  }

  return false;
}

function hasChoiceOptions(item) {
  return Array.isArray(item?.options) && item.options.length > 0;
}

function hasOptionCodeAnswer(item) {
  return !!normalizeAnswerKey(item?.answer) || !!normalizeAnswerKey(item?.correctAnswer);
}

function hasOwnField(value, field) {
  return isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, field);
}

function hasDistractorDesignSignals(item) {
  return hasOwnField(item, "distractorDesign")
    || (isPlainObject(item?.qualityMeta) && hasOwnField(item.qualityMeta, "distractorDesign"));
}

function hasChoiceTypeSignal(item) {
  const signals = [
    item?.itemType,
    item?.responseType,
    item?.selectionPolicy,
  ];

  return signals.some((value) => {
    const text = normalizeId(value).toLowerCase();
    if (!text) return false;
    return text.includes("choice")
      || text.includes("select")
      || text.includes("option")
      || text.includes("選擇")
      || text.includes("單選")
      || text.includes("複選")
      || text.includes("選項");
  });
}

function hasChoiceSignals(item) {
  return hasOptionCodeAnswer(item)
    || item?.options !== undefined
    || hasDistractorDesignSignals(item)
    || hasChoiceTypeSignal(item);
}

function shouldValidateChoiceForm(item) {
  const questionType = normalizeId(item?.questionType);
  if (!CHOICE_LIKE_TYPES.includes(questionType)) return false;
  if (questionType !== "學力檢測題") return true;
  return hasChoiceSignals(item);
}

function answerIsSingleChoiceKey(item) {
  return !!normalizeAnswerKey(item?.answer);
}

function optionLengthWarning(item) {
  const options = Array.isArray(item?.options) ? item.options.map((option) => normalizeId(option)) : [];
  if (options.length < 2) return "";

  const lengths = options.map((option) => option.length).filter((length) => length > 0);
  if (lengths.length < 2) return "";

  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  if (max >= 12 && max >= min * 2.5) {
    return `${normalizeId(item?.itemId)}：選項字數差距較大，可能洩漏正答，請人工確認。`;
  }
  return "";
}

function validateQualityMeta(item, { requireQualityMeta = false } = {}) {
  const errors = [];
  const warnings = [];
  const id = normalizeId(item?.itemId) || "未知題號";
  const qualityMeta = isPlainObject(item?.qualityMeta) ? item.qualityMeta : null;

  if (!qualityMeta) {
    if (requireQualityMeta) {
      errors.push(`${id}：v2 品質模式下缺少 qualityMeta。`);
    }
    return { errors, warnings };
  }

  for (const field of QUALITY_META_REQUIRED_FIELDS) {
    const value = qualityMeta[field];
    if (field === "distractorDesign" || field === "selfCheck") {
      if (!isPlainObject(value)) errors.push(`${id}：qualityMeta.${field} 必須是物件。`);
    } else if (!hasText(value)) {
      errors.push(`${id}：qualityMeta 缺少 ${field}。`);
    }
  }

  const selfCheck = isPlainObject(qualityMeta.selfCheck) ? qualityMeta.selfCheck : {};
  for (const field of QUALITY_META_SELF_CHECK_FIELDS) {
    if (typeof selfCheck[field] !== "boolean") {
      errors.push(`${id}：qualityMeta.selfCheck.${field} 必須是 true/false。`);
    }
  }

  if (QUALITY_META_SELF_CHECK_FIELDS.every((field) => selfCheck[field] === true) && !hasText(qualityMeta.teacherExplanation)) {
    warnings.push(`${id}：selfCheck 全部為 true，但 teacherExplanation 不足，請人工確認。`);
  }

  if (hasText(qualityMeta.teacherExplanation) && normalizeId(qualityMeta.teacherExplanation).length < 20) {
    warnings.push(`${id}：teacherExplanation 偏短，審題資訊可能不足。`);
  }

  const questionType = normalizeId(item?.questionType);
  const isChoiceLike = CHOICE_LIKE_TYPES.includes(questionType);
  if (!isChoiceLike) return { errors, warnings };
  if (!shouldValidateChoiceForm(item)) return { errors, warnings };

  const options = Array.isArray(item?.options) ? item.options : [];
  const answerKey = normalizeAnswerKey(item?.answer);
  const answerIndex = answerKey ? answerKey.charCodeAt(0) - 65 : -1;
  const distractorDesign = isPlainObject(qualityMeta.distractorDesign) ? qualityMeta.distractorDesign : {};

  for (const key of Object.keys(distractorDesign)) {
    const normalizedKey = normalizeAnswerKey(key);
    if (!normalizedKey) {
      errors.push(`${id}：qualityMeta.distractorDesign key「${key}」必須是錯誤選項代號 A/B/C/D，不可使用選項文字。`);
      continue;
    }
    const keyIndex = normalizedKey.charCodeAt(0) - 65;
    if (keyIndex < 0 || keyIndex >= options.length) {
      errors.push(`${id}：qualityMeta.distractorDesign key「${key}」不在選項範圍內。`);
    }
  }

  if (answerKey && Object.prototype.hasOwnProperty.call(distractorDesign, answerKey)) {
    errors.push(`${id}：正答 ${answerKey} 不應出現在 qualityMeta.distractorDesign 中。`);
  }

  const tags = [];
  options.forEach((_option, index) => {
    const key = optionKey(index);
    if (index === answerIndex) return;

    const design = isPlainObject(distractorDesign[key]) ? distractorDesign[key] : null;
    if (!design) {
      errors.push(`${id}：錯誤選項 ${key} 缺少 distractorDesign。`);
      return;
    }

    for (const field of QUALITY_META_DISTRACTOR_REQUIRED_FIELDS) {
      if (!hasText(design[field])) {
        errors.push(`${id}：錯誤選項 ${key} 缺少 ${field}。`);
      }
    }
    if (hasText(design.misconceptionTag)) tags.push(design.misconceptionTag.trim());
  });

  if (tags.length > 1 && new Set(tags).size < tags.length) {
    warnings.push(`${id}：誘答迷思標籤重複，診斷價值可能降低。`);
  }

  const lengthWarning = optionLengthWarning(item);
  if (lengthWarning) warnings.push(lengthWarning);

  return { errors, warnings };
}

function validateChoiceAnswer(item, errors) {
  const id = normalizeId(item?.itemId) || "未知題號";
  const questionType = normalizeId(item?.questionType);
  if (!shouldValidateChoiceForm(item)) return;
  if (!hasChoiceOptions(item)) return;
  if (!answerIsSingleChoiceKey(item)) {
    errors.push(`${id}：answer 必須是 A/B/C/D 選項代號，不可使用選項文字。`);
    return;
  }
  if (!answerMatchesOptions(item)) {
    errors.push(`${id}：answer「${item.answer}」不在選項範圍內。`);
  }

  if (hasText(item?.correctAnswer)) {
    const correctAnswerKey = normalizeAnswerKey(item.correctAnswer);
    if (!correctAnswerKey) {
      errors.push(`${id}：correctAnswer 必須是 A/B/C/D 選項代號，不可使用選項文字。`);
    } else if (correctAnswerKey !== normalizeAnswerKey(item.answer)) {
      errors.push(`${id}：answer 與 correctAnswer 不一致。`);
    }
  }
}

function validateChoiceOptionsArray(item, errors) {
  const id = normalizeId(item?.itemId) || "未知題號";
  const questionType = normalizeId(item?.questionType);
  if (!shouldValidateChoiceForm(item)) return;
  if (item?.options !== undefined && !Array.isArray(item.options)) {
    errors.push(`${id}：options 必須是陣列，不可使用物件形式。`);
  }
}

export function validateGeneratedPaper({ slots = [], objectives = [], items = [], qualityMode = "basic" } = {}) {
  const errors = [];
  const warnings = [];
  const requireQualityMeta = qualityMode === "v2";

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

        if (shouldValidateChoiceForm(item)) {
          validateChoiceOptionsArray(item, errors);
          const optionCount = Array.isArray(item.options) ? item.options.length : 0;
          if (optionCount < 2) {
            errors.push(`${subId}：${item.questionType}子題採選擇題形式，缺少選項。`);
          } else if (optionCount < 4) {
            warnings.push(`提醒：${subId}（${item.questionType}子題）只有 ${optionCount} 個選項（建議 4 個）。`);
          }
          validateChoiceAnswer(item, errors);
        }

        const qualityCheck = validateQualityMeta(item, { requireQualityMeta });
        errors.push(...qualityCheck.errors);
        warnings.push(...qualityCheck.warnings);

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
      const expectedSubCount = Number(slot.subCount) || expectedSubScores.length || 2;

      if (sortedGroupItems.length !== expectedSubCount) {
        errors.push(`${parentId}：子題數量為 ${sortedGroupItems.length}，與題位設定的 ${expectedSubCount} 子題數不符。`);
      } else {
        if (expectedSubScores.length > 0 && sortedGroupItems.length === expectedSubScores.length) {
          for (let i = 0; i < expectedSubScores.length; i++) {
            const expectedScore = Number(expectedSubScores[i]);
            const actualScore = Number(sortedGroupItems[i].score || 0);
            if (actualScore !== expectedScore) {
              errors.push(`${normalizeId(sortedGroupItems[i].itemId)}：子題配分應為 ${expectedScore} 分，但實際為 ${actualScore} 分。`);
            }
          }
        } else {
          if (totalGroupScore !== Number(slot.score)) {
            errors.push(`${parentId}：子題配分總和為 ${totalGroupScore} 分，但題位設定配分為 ${slot.score} 分，配分不合。`);
          }
        }
      }

      if (!hasStimulus) {
        errors.push(`${parentId}：題組缺少共同的 stimulus (引言 / 情境段落)。`);
      }

      for (const gi of groupItems) {
        const dimWarn = dimensionLockWarning(gi, slot);
        if (dimWarn) warnings.push(dimWarn);
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
      if (!hasText(item.stimulus) && needsStimulus(item)) {
        if (normalizeId(item.questionType) === "閱讀測驗") {
          errors.push(`${id}：閱讀測驗必須提供 stimulus（閱讀文本），不可只有題目與選項。`);
        } else {
          errors.push(`${id}：題目文字提到上文／本文／這段文字，但缺少 stimulus（閱讀文本）。`);
        }
      }

      if (shouldValidateChoiceForm(item)) {
        validateChoiceOptionsArray(item, errors);
        const optionCount = Array.isArray(item.options) ? item.options.length : 0;
        if (optionCount < 2) {
          errors.push(`${id}：${item.questionType}採選擇題形式，缺少選項。`);
        } else if (optionCount < 4) {
          warnings.push(`提醒：${id}（${item.questionType}）只有 ${optionCount} 個選項（建議 4 個）。`);
        }
        validateChoiceAnswer(item, errors);
      }

      const qualityCheck = validateQualityMeta(item, { requireQualityMeta });
      errors.push(...qualityCheck.errors);
      warnings.push(...qualityCheck.warnings);

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

      const dimWarn = dimensionLockWarning(item, slot);
      if (dimWarn) warnings.push(dimWarn);
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
