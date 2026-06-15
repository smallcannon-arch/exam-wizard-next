function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((option) => {
      if (typeof option === "string") return option.trim();

      if (isPlainObject(option)) {
        return firstNonEmptyText(
          option.text,
          option.label,
          option.value,
          option.content,
        );
      }

      return "";
    })
    .filter(Boolean);
}

export function normalizeGeneratedItem(item) {
  if (!isPlainObject(item)) return item;

  const question = firstNonEmptyText(
    item.question,
    item.stem,
    item.prompt,
    item.problem,
    item.questionText,
    item.itemText,
    item.text,
    item.title,
  );

  const explanation = firstNonEmptyText(
    item.explanation,
    item.rationale,
    item.analysis,
    item.reason,
    item.solution,
  );

  return {
    ...item,
    question,
    options: normalizeOptions(item.options),
    answer: firstNonEmptyText(item.answer, item.correctAnswer, item.key),
    explanation,
  };
}

export function normalizeGeneratedItems(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => normalizeGeneratedItem(item));
}