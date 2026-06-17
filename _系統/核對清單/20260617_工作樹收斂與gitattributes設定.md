# 工作紀錄：工作樹收斂 + .gitattributes / .gitignore 設定

- 日期：2026/6/17
- 任務：審核 CODEX 暫存修改、核對 dirty worktree、設定換行碼與忽略規則
- 操作者：Claude（唯讀審核 + 設定檔起草；未提交、未推送）

## 一、審核結論

CODEX 實際只動到「孤兒閱讀題檢核 + timeout 緩解」這一包，未改壞既有邏輯。
四點意見中，第 1、4 點（閱讀測驗缺 stimulus 檢核、作答括號補閱讀測驗）在工作樹中已完成；
第 2、3 點（國語延時主因為單次整卷生成過大、現有 timeout 修法僅緩解、分批生成才是根治）成立，另列獨立工項。

## 二、dirty worktree 核對

實際內容有改動的程式碼檔＝ 8 個（與使用者清單一致）：

1. frontend/index.html — 快取版號 v25→v26
2. frontend/src/apiClient.js — postJson 可帶 timeoutMs，生成端 300s
3. frontend/src/app.js — 生成失敗自動重試一次（檢核失敗不重試）
4. frontend/src/core/renderPaper.js — 作答括號清單補「閱讀測驗」
5. frontend/src/core/validateGeneratedPaper.js — 外部文本指涉詞清單 + needsStimulus()
6. tests/validateGeneratedPaper.test.js — 對應三個新測試
7. worker/src/gemini.js — 90s 主動中止 + maxOutputTokens 32768
8. worker/src/prompts.js — 禁止無 stimulus 的一般題引用外部文本

雜訊（不進此 commit）：
- frontend/src/config.js、frontend/src/core/normalizeItem.js、tests/normalizeItem.test.js
  → 僅 CRLF 換行差異、零內容變動
- 9 個已追蹤 desktop.ini → 需從索引移除
- 未追蹤：scratch/、114下六年級(國語)備課資料/

## 三、本次新增／修改的設定檔

1. .gitattributes（新增）
   - `* text=auto`：文字檔以 LF 入庫，消除 CRLF 假 diff；不指定 eol，工作目錄維持原生。
   - 二進位副檔名（png/jpg/pdf/xlsx/docx/pptx/zip 等）標記 binary，禁止換行轉換。
2. .gitignore（修改，已備份至 _備份/.gitignore_20260617_0729）
   - 新增忽略：scratch/、114下六年級(國語)備課資料/

驗證：套用 .gitattributes 後，config.js / normalizeItem.js / normalizeItem.test.js 的假 diff 已消失。

## 四、待使用者本機執行（未由 Claude 執行）

1. 從索引移除 9 個 desktop.ini（檔案保留在硬碟，只是不再追蹤）：
   git rm --cached desktop.ini docs/desktop.ini frontend/desktop.ini frontend/src/desktop.ini frontend/src/core/desktop.ini scripts/desktop.ini tests/desktop.ini worker/desktop.ini worker/src/desktop.ini

2. 驗證四道（全過才提交）：
   npm test
   npm run check
   node --check worker/src/prompts.js
   node --check worker/src/gemini.js

3. 提交範圍：上述 8 個程式碼檔 + .gitattributes + .gitignore + desktop.ini 的移除。
   不要 stage config.js / normalizeItem.js / normalizeItem.test.js（純 CRLF）。

## 五、後續獨立工項（暫緩，待方向拍板）

- 分批生成（根治國語延時）：需改生成流程 + 新增跨批合併檢核，不與本包混。
