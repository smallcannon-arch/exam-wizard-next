// 各科常用題型清單（國小，108 課綱常見），每科尾端統一附上「學力檢測題」。
// 純資料，不依賴 DOM。

export const LITERACY_ASSESSMENT_TYPE = "學力檢測題";

const PRESETS = {
  國語文: ["選擇題", "填充題", "注音", "國字", "改錯", "照樣造句", "重組", "閱讀測驗", "短文寫作"],
  數學: ["選擇題", "填充題", "計算題", "應用題", "作圖題"],
  自然: ["選擇題", "是非題", "填充題", "連連看", "簡答題", "實驗探究題"],
  社會: ["選擇題", "是非題", "填充題", "配合題", "問答題", "圖表判讀"],
  英語: ["聽力", "字彙", "選擇題", "填充題", "句子重組", "閱讀測驗"],
  生活: ["選擇題", "是非題", "填充題", "連連看", "實作題"],
  健康與體育: ["選擇題", "是非題", "填充題", "簡答題"],
  綜合活動: ["選擇題", "是非題", "填充題", "簡答題"],
};

const DEFAULT_TYPES = ["選擇題", "是非題", "填充題", "配合題", "簡答題", "應用題"];

export const SUBJECT_OPTIONS = ["國語文", "數學", "自然", "社會", "英語", "生活", "健康與體育", "綜合活動"];

export function matchSubject(subject) {
  const text = String(subject || "");
  if (text.includes("國語") || text.includes("語文")) return "國語文";
  if (text.includes("數")) return "數學";
  if (text.includes("自然") || text.includes("科學")) return "自然";
  if (text.includes("社會")) return "社會";
  if (text.includes("英")) return "英語";
  if (text.includes("生活")) return "生活";
  if (text.includes("健康") || text.includes("體育")) return "健康與體育";
  if (text.includes("綜合")) return "綜合活動";
  return null;
}

export function getQuestionTypeOptions(subject) {
  const key = matchSubject(subject);
  const base = key ? PRESETS[key] : DEFAULT_TYPES;
  return [...base, LITERACY_ASSESSMENT_TYPE];
}
