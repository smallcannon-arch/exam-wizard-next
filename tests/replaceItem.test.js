import { describe, expect, it } from "vitest";
import { normalizeRegeneratedItem, replaceItemById } from "../frontend/src/core/replaceItem.js";

const originalItem = {
  itemId: "Q-001",
  groupId: "",
  questionType: "選擇題",
  cognitiveLevel: "理解",
  stimulus: "",
  question: "原題幹",
  options: ["A", "B", "C", "D"],
  answer: "A",
  explanation: "原解析",
  objectiveIds: ["O-001"],
  primaryObjectiveId: "O-001",
  secondaryObjectiveIds: [],
  score: 2,
  reviewFlags: [],
};

describe("normalizeRegeneratedItem", () => {
  it("保留結構欄位，只替換內容欄位", () => {
    const result = normalizeRegeneratedItem({
      originalItem,
      regeneratedItem: {
        itemId: "AI-999",
        questionType: "填充題",
        question: "新題幹",
        options: ["甲", "乙"],
        answer: "甲",
        explanation: "新解析",
        objectiveIds: ["O-999"],
        primaryObjectiveId: "O-999",
        score: 99,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.item.itemId).toBe("Q-001");
    expect(result.item.questionType).toBe("選擇題");
    expect(result.item.score).toBe(2);
    expect(result.item.objectiveIds).toEqual(["O-001"]);
    expect(result.item.primaryObjectiveId).toBe("O-001");
    expect(result.item.question).toBe("新題幹");
  });

  it("題組小題重出時保留原本 stimulus", () => {
    const result = normalizeRegeneratedItem({
      originalItem: { ...originalItem, groupId: "G-001", stimulus: "原本題組文本" },
      regeneratedItem: { ...originalItem, stimulus: "AI 想改掉的文本", question: "新小題" },
    });

    expect(result.ok).toBe(true);
    expect(result.item.stimulus).toBe("原本題組文本");
    expect(result.item.question).toBe("新小題");
  });
});

describe("replaceItemById", () => {
  it("可取代指定題號", () => {
    const result = replaceItemById({
      items: [originalItem],
      itemId: "Q-001",
      regeneratedItem: { ...originalItem, question: "重新生成題幹", answer: "B" },
    });

    expect(result.ok).toBe(true);
    expect(result.items[0].itemId).toBe("Q-001");
    expect(result.items[0].question).toBe("重新生成題幹");
    expect(result.items[0].answer).toBe("B");
  });

  it("找不到題號時不改原陣列", () => {
    const result = replaceItemById({
      items: [originalItem],
      itemId: "Q-999",
      regeneratedItem: { ...originalItem, question: "不應出現" },
    });

    expect(result.ok).toBe(false);
    expect(result.items).toEqual([originalItem]);
  });
});
