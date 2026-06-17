// 能力框架（Ability Framework）與科目（subject）分離。
// subject 只代表科目；frameworkId 才決定配分策略、能力資料結構與相容性檢查。
// 純資料 / 純函式，不依賴 DOM。

export const ASSESSMENT_FRAMEWORKS = {
  learning_objectives: {
    label: "教材目標模式",
    weightStrategy: "lesson_hours",     // 學習目標＋節數比例
    usesChineseDimension: false,
    isDefault: true,
  },
  chinese_dimension_items: {
    label: "評量向度模式",
    weightStrategy: "dimension_ratio",  // 國語向度比例＋細項
    usesChineseDimension: true,
    isAdvanced: true,
  },
};

// 各科可用的框架：國語可選兩種（預設教材目標、進階向度）；其他科僅教材目標。
export function getAvailableFrameworks(subject) {
  if (subject === "國語") {
    return ["learning_objectives", "chinese_dimension_items"];
  }
  return ["learning_objectives"];
}

// 解析目前 frameworkId：未設定（或非法）一律退回預設「教材目標模式」。
export function resolveFrameworkId(project = {}) {
  const id = project && typeof project.frameworkId === "string" ? project.frameworkId : "";
  return Object.prototype.hasOwnProperty.call(ASSESSMENT_FRAMEWORKS, id) ? id : "learning_objectives";
}

// 是否啟用國語向度模式：必須同時「科目為國語」且「framework 為 chinese_dimension_items」。
// 非國語即使誤設 chinese_dimension_items，也不得啟用。
export function usesChineseDimension(project = {}) {
  return project?.subject === "國語" && resolveFrameworkId(project) === "chinese_dimension_items";
}
