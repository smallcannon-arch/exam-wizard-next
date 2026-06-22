import { describe, expect, it } from "vitest";
import {
  buildGenerationFailureMessages,
  createGenerationProgress,
  getGenerationProgressView,
} from "../frontend/src/core/generationProgress.js";

describe("generation progress UI helpers", () => {
  it("creates a submitted progress state without fake percentages", () => {
    const progress = createGenerationProgress({ totalItems: 12, now: 1000 });
    const view = getGenerationProgressView(progress, 1000);

    expect(progress.totalItems).toBe(12);
    expect(view.title).toBe("正在產生試題");
    expect(view.elapsedLabel).toBe("已等待 0 秒");
    expect(view.steps.map((step) => step.label)).toEqual([
      "已送出命題需求",
      "正在產生題目",
      "正在檢查題目格式",
      "正在準備顯示結果",
    ]);
    expect(JSON.stringify(view)).not.toContain("%");
  });

  it("shows the 30 second wait notice", () => {
    const progress = { ...createGenerationProgress({ now: 0 }), phase: "generating" };
    const view = getGenerationProgressView(progress, 30000);

    expect(view.timeoutNotice).toBe("這次生成需要較多時間，系統仍在處理中。");
  });

  it("shows the 60 second wait notice", () => {
    const progress = { ...createGenerationProgress({ now: 0 }), phase: "generating" };
    const view = getGenerationProgressView(progress, 60000);

    expect(view.timeoutNotice).toBe("仍在產生試題。若題數較多或品質檢查較完整，等待時間可能會增加。");
  });

  it("shows the 90 second wait notice", () => {
    const progress = { ...createGenerationProgress({ now: 0 }), phase: "generating" };
    const view = getGenerationProgressView(progress, 90000);

    expect(view.timeoutNotice).toBe("等待時間較長。請先不要重複送出；若稍後失敗，可再重新嘗試。");
  });

  it("marks previous phases as done and current phase as active", () => {
    const progress = { ...createGenerationProgress({ now: 0 }), phase: "validating" };
    const view = getGenerationProgressView(progress, 5000);

    expect(view.steps.map((step) => step.state)).toEqual(["done", "done", "active", "pending"]);
  });

  it("returns user-facing timeout messages without raw technical details", () => {
    const messages = buildGenerationFailureMessages("AbortError: GEMINI_API_KEY timeout raw output stack", { type: "validation" });

    expect(messages).toEqual([
      "生成失敗",
      "AI 服務回應逾時。",
      "請稍後再試，或減少題數後重試。",
    ]);
    expect(messages.join(" ")).not.toContain("GEMINI_API_KEY");
    expect(messages.join(" ")).not.toContain("raw output");
    expect(messages.join(" ")).not.toContain("stack");
  });

  it("returns validation failure guidance without exposing validation dumps", () => {
    const messages = buildGenerationFailureMessages(["answer contract failure", "distractorDesign key failure"], { type: "validation" });

    expect(messages).toEqual([
      "生成失敗",
      "題目格式或欄位不完整。",
      "請重新生成，或減少題數後再試。",
    ]);
    expect(messages.join(" ")).not.toContain("distractorDesign");
  });
});
