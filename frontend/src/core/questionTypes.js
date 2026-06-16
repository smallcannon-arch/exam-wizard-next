// 各科常用題型清單（國小，108 課綱常見），每科尾端統一附上「學力檢測題」。
// 純資料，不依賴 DOM。

export const LITERACY_ASSESSMENT_TYPE = "學力檢測題";

const PRESETS = {
  國語文: ["選擇題", "填充題", "注音", "國字", "改錯", "照樣造句", "重組", "閱讀測驗", "圖表判讀題", "短文寫作"],
  數學: ["選擇題", "填充題", "計算題", "應用題", "作圖題", "圖表判讀題"],
  自然: ["選擇題", "是非題", "填充題", "連連看", "簡答題", "實驗探究題", "圖表判讀題"],
  社會: ["選擇題", "是非題", "填充題", "配合題", "問答題", "圖表判讀題"],
  英語: ["聽力", "字彙", "選擇題", "填充題", "句子重組", "閱讀測驗"],
};

const DEFAULT_TYPES = ["選擇題", "是非題", "填充題", "配合題", "簡答題", "應用題", "圖表判讀題"];

export const SUBJECT_OPTIONS = ["國語", "數學", "社會", "自然", "英文"];

export function matchSubject(subject) {
  const text = String(subject || "");
  if (text.includes("國語") || text.includes("語文")) return "國語文";
  if (text.includes("數")) return "數學";
  if (text.includes("自然") || text.includes("科學")) return "自然";
  if (text.includes("社會")) return "社會";
  if (text.includes("英")) return "英語";
  return null;
}

export function getQuestionTypeOptions(subject) {
  const key = matchSubject(subject);
  const base = key ? PRESETS[key] : DEFAULT_TYPES;
  return [...base, LITERACY_ASSESSMENT_TYPE];
}

// 國語科專屬：根據題型預估預設評量向度
export function getChineseDimension(questionType) {
  const qt = String(questionType || "");
  if (["國字", "注音", "改錯", "部首", "筆畫", "字形", "字音", "字詞義", "字義", "詞義"].some(x => qt.includes(x))) {
    return "字詞短語";
  }
  if (["照樣造句", "造句", "重組", "句型", "修辭", "標點", "句式", "語法"].some(x => qt.includes(x))) {
    return "句式語法";
  }
  if (["閱讀測驗", "短文寫作", "寫作", "閱讀", "段篇"].some(x => qt.includes(x))) {
    return "段篇讀寫";
  }
  // 選擇題/學力檢測題等，若無法直接判斷，預設為句式語法或字詞短語
  if (qt.includes("選擇")) return "句式語法";
  return "字詞短語";
}

// 國語科專屬：根據題型與向度對應 49 項細項預設值
export function getChineseSubcategory(questionType, chineseDimension) {
  const qt = String(questionType || "");
  const dim = String(chineseDimension || "字詞短語");

  if (qt.includes("注音") || qt.includes("字音")) return "正確字音";
  if (qt.includes("國字") || qt.includes("字形")) return "確認字形";
  if (qt.includes("改錯")) return "確認字形";
  if (qt.includes("部首")) return "分辨部首";
  if (qt.includes("筆畫") || qt.includes("筆順")) return "筆畫筆順";
  
  if (qt.includes("字詞義") || qt.includes("字義") || qt.includes("詞義") || qt.includes("解釋")) return "字詞釋義";
  if (qt.includes("近義")) return "近義字詞";
  if (qt.includes("反義")) return "反義字詞";
  if (qt.includes("量詞") || qt.includes("疊詞") || qt.includes("詞語")) return "類詞應用";

  if (qt.includes("標點")) return "標點符號";
  if (qt.includes("照樣造句")) return "句型辨識";
  if (qt.includes("重組") || qt.includes("造句")) return "文句組成";
  if (qt.includes("修辭")) return "常用修辭";
  if (qt.includes("四字")) return "四字詞語";

  if (qt.includes("閱讀")) return "提取訊息";
  if (qt.includes("寫作") || qt.includes("作文")) return "主題習寫";

  // 根據向度的 fallback
  if (dim === "字詞短語") {
    if (qt.includes("選擇")) return "字詞釋義";
    return "確認字形";
  }
  if (dim === "句式語法") {
    if (qt.includes("選擇")) return "句型辨識";
    return "文句組成";
  }
  if (dim === "段篇讀寫") {
    if (qt.includes("選擇")) return "提取訊息";
    return "主題習寫";
  }

  return "確認字形";
}

// 國語科評量向度/項目/細項之 49 行靜態結構樹
export const CHINESE_AUDIT_STRUCTURE = [
  {
    dimension: "字詞短語",
    project: "字音",
    items: ["正確字音", "近音字", "多音字", "變音字"]
  },
  {
    dimension: "字詞短語",
    project: "字形",
    items: ["確認字形", "筆畫筆順", "分辨部首", "部件組合", "造字原則", "書法字體", "書法故事"]
  },
  {
    dimension: "字詞短語",
    project: "字詞義",
    items: ["字詞釋義", "近義字詞", "反義字詞", "類詞應用"]
  },
  {
    dimension: "句式語法",
    project: "句式",
    items: ["句意理解", "文句組成", "句型辨識", "句式變化", "標點符號", "句群關係"]
  },
  {
    dimension: "句式語法",
    project: "語法",
    items: ["四字詞語", "結構詞語", "常用修辭"]
  },
  {
    dimension: "段篇讀寫",
    project: "閱讀理解",
    items: ["提取訊息", "推論訊息", "整合詮釋", "比較評估"]
  },
  {
    dimension: "段篇讀寫",
    project: "閱讀策略",
    items: ["閱讀技巧", "預測推論", "摘要整合", "推估主旨", "辨識文類", "詳略閱讀"]
  },
  {
    dimension: "段篇讀寫",
    project: "語文應用",
    items: ["文體應用", "語文工具"]
  },
  {
    dimension: "段篇讀寫",
    project: "寫作練習",
    items: ["句子變化", "看圖寫作", "限制習寫", "主題習寫", "感想心得", "寫作技巧"]
  }
];
