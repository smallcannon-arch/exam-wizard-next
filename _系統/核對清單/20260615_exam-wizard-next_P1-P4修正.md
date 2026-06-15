# exam-wizard-next P1–P4 阻斷性修正工作紀錄

- 日期：2026/6/15
- 範圍：P1 ID 對應、P2 模板字串確認、P3 loading 提示、P4 移除離線示範
- 測試結果：npm test 22 passed (5 files)、npm run check 通過

## P1 統一 ID 對應（intentId ↔ itemId）
採長期方案：以 intentId 為對照主鍵、itemId 為卷面題號，並讓驗證器穩健比對。
- `worker/src/prompts.js`：生成 prompt 新增要求 AI 原樣回傳 intentId 與 itemId（不得重新編號）；必填欄位清單補上 intentId。重出 prompt 的「必須保留」補上 intentId。
- `frontend/src/core/prompt.js`：JSON 範例補上 intentId；重出 prompt「必須保留」補上 intentId。
- `frontend/src/core/validateGeneratedItems.js`：改為以 intentId/itemId 任一鍵對映到 intent 正規 ID（getCanonicalId / keyToCanonical），AI 即使只回 Q-001 也能對上 I-001，消除誤判「未回傳此題」。
- `tests/validateGeneratedItems.test.js`：新增 2 個測試（I- 藍圖對 Q- 回傳、同時回傳 intentId+itemId）。

## P2 模板字串
確認 `app.js:143` 已使用反引號 template literal；全檔掃描無殘留字面 ${...}。無需修改。

## P3 AI 生成／重出 loading 提示
- `frontend/src/app.js`：新增 busyItemId 狀態與 renderBusyBanner()（含旋轉 spinner、aria-live）。
  - 整卷生成：顯示「AI 正在生成試題草稿，請稍候……」，按鈕文字轉為「AI 生成中……」並 disabled。
  - 單題重出：顯示「AI 正在重新設計 Q-xxx，請稍候……」，該題按鈕轉為「AI 重出中……」並 disabled；新增 catch 區塊，失敗時保留原資料並提示。
- `frontend/src/style.css`：新增 .notice.loading 與 spinner 動畫。

## P4 移除離線示範題
- `frontend/src/app.js`：刪除 mockGenerateItems、mockRegenerateItem 兩函式、兩顆離線按鈕、兩個 click handler。

## 沙箱安裝套件
- 在 Linux 沙箱重裝 node_modules（補 rollup/esbuild 之 linux 原生二進位）以便執行 vitest；不影響本機 Windows 環境。

## 待辦（本次未做，依使用者選擇 P1–P4）
P5 每題顯示目標編號、P6 AI 提取學習目標(/extract-objectives)、P7 題型配置、P8 自訂配分方案 scorePlan。

## 建議 commit 訊息
- fix: unify intent/item id mapping and robust generated-item validation
- feat: add AI generate/regenerate loading indicators
- chore: remove offline mock item generation
