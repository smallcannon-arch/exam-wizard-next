# exam-wizard-next

這是一個重新開發用的最小骨架，目標是先把命題系統的主流程整理乾淨，而不是一開始就做滿功能。

## 核心理念

- 不做備選池。
- AI 直接生成正式試題草稿。
- 老師逐題檢查、編修。
- 不滿意的題目可指定 AI 重出。
- 重出單題時保留題號、配分、題型、目標對應與題組歸屬。
- 前端使用原生 HTML、CSS、ES Module。
- 前端執行期零相依。
- 核心命題邏輯放在 `frontend/src/core/`，不得依賴 DOM、fetch、localStorage 或 window。
- 後端使用 Cloudflare Workers，負責隱藏 Gemini API key 與 CORS。

## 專案結構

```text
exam-wizard-next/
  frontend/
    index.html
    src/
      app.js
      state.js
      apiClient.js
      style.css
      core/
        blueprint.js
        ids.js
        prompt.js
        renderPaper.js
        replaceItem.js
        schema.js
        scoring.js
        validation.js
  worker/
    src/
      index.js
      gemini.js
      prompts.js
      json.js
      cors.js
    package.json
    wrangler.toml.example
  tests/
    blueprint.test.js
    replaceItem.test.js
    scoring.test.js
  docs/
    ARCHITECTURE.md
    ROADMAP.md
    DEVELOPMENT_STEPS.md
```

## 本機前端啟動

在專案根目錄執行：

```bash
cd frontend
python -m http.server 8000
```

瀏覽器開啟：

```text
http://localhost:8000
```

## 測試

第一次使用：

```bash
npm install
```

跑測試：

```bash
npm test
```

核心純函式層檢查：

```bash
npm run check
```

## 後端設定

進入 Worker 專案：

```bash
cd worker
npm install
copy wrangler.toml.example wrangler.toml
npx wrangler secret put GEMINI_API_KEY
npm run dev
```

若本機前端是 `http://localhost:8000`，請確認 `wrangler.toml`：

```toml
ALLOWED_ORIGIN = "http://localhost:8000"
```

部署：

```bash
npm run deploy
```

部署後，把前端畫面的 API Base URL 改成你的 Workers URL。

## MVP 功能

1. 建卷：輸入科目、年級、總分、每題分數、教材摘要。
2. 學習目標：每行一個目標，格式為 `目標文字｜節數`。
3. 自動配題：預設 100 分、每題 2 分，共 50 題。
4. 題目藍圖：一題一個 item intent。
5. AI 生成正式草稿：不做備選。
6. 單題重出：老師指定某題，AI 只重出該題內容。
7. 檢核：總分、目標配分、題目基本欄位。
8. 輸出：學生卷、教師卷文字版。

## 下一步

請先照 `docs/DEVELOPMENT_STEPS.md` 做，確認骨架跑起來，再開始加功能。
