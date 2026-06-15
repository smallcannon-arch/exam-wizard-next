# 重新開發操作步驟

## 第 1 步：建立本機資料夾

建議位置：

```text
D:\User\Nhps\Documents\exam-wizard-next
```

把壓縮檔內容解壓縮到這個資料夾。

## 第 2 步：打開 VS Code

```bash
cd /d D:\User\Nhps\Documents\exam-wizard-next
code .
```

## 第 3 步：安裝測試工具

```bash
npm install
```

## 第 4 步：跑測試

```bash
npm test
```

若通過，代表核心資料模型目前可用。

## 第 5 步：啟動前端

```bash
cd frontend
python -m http.server 8000
```

瀏覽器開啟：

```text
http://localhost:8000
```

## 第 6 步：先走離線流程

1. 建卷。
2. 填學習目標。
3. 按「建立配題與藍圖」。
4. 按「離線產生示範題」。
5. 按某題「離線重出示範」。
6. 前往檢核。
7. 前往輸出。

先確認這條路是順的。

## 第 7 步：設定 Worker

```bash
cd ../worker
npm install
copy wrangler.toml.example wrangler.toml
npx wrangler secret put GEMINI_API_KEY
npm run dev
```

## 第 8 步：前端接本機 Worker

若 `wrangler dev` 顯示：

```text
http://localhost:8787
```

請在前端建卷畫面的 API Base URL 填入：

```text
http://localhost:8787
```

然後測試「連線 AI 生成正式草稿」。

## 第 9 步：部署 Worker

```bash
npm run deploy
```

將部署後的 URL 填回前端 API Base URL。

## 第 10 步：部署 GitHub Pages

先把 `frontend/` 的內容推到 GitHub Pages 專案。

若使用 project site，網址通常會像：

```text
https://帳號.github.io/repo-name/
```

記得把 Worker 的 `ALLOWED_ORIGIN` 改成 GitHub Pages 網址。
