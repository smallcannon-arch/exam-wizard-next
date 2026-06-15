# exam-wizard-next 上線部署步驟（前端 GitHub Pages）

日期：2026/6/15
Worker 端已完成：已部署 https://exam-wizard-next-proxy.smallcannon.workers.dev ，
CORS 已設 https://smallcannon-arch.github.io 。

前端只剩「推上 GitHub + 開 Pages」，需用你的 GitHub 帳號操作。
你 Windows 沒裝 Git，建議走 GitHub Desktop（圖形介面，免指令）。

## 步驟 A：把 repo 推上 GitHub（GitHub Desktop 法，推薦）
1. 下載安裝 GitHub Desktop，用 smallcannon-arch 帳號登入。
2. File → Add local repository → 選資料夾 D:\User\Nhps\Documents\exam-wizard-next
3. 左下會列出未提交變更，填一行 commit 訊息（例如：deploy: setup pages + production worker url），按 Commit to main。
4. 按右上「Publish repository」。
   - 重點：GitHub Pages 免費版只支援「公開 repo」。請取消勾選 Keep this code private（或確認你的方案支援私有 repo Pages）。
   - 金鑰不在前端，安全：API Key 是 Cloudflare Worker 的 secret，.dev.vars 已被 .gitignore 排除，不會上傳。
5. Publish 完成，程式碼就在 https://github.com/smallcannon-arch/exam-wizard-next 。

（替代法：若你之後有裝 Git CLI，可在 worker 以外的專案根目錄執行
  git remote add origin https://github.com/smallcannon-arch/exam-wizard-next.git
  git add -A && git commit -m "deploy: setup pages" && git push -u origin main ）

## 步驟 B：開啟 GitHub Pages（用 Actions）
1. 進 repo → Settings → Pages。
2. Build and deployment → Source 選「GitHub Actions」。
   （我已放好 .github/workflows/deploy-pages.yml，推上去後會自動執行並發佈 frontend/。）
3. 到 repo 的 Actions 分頁，看「Deploy frontend to GitHub Pages」是否跑出綠勾。
4. 成功後網址：https://smallcannon-arch.github.io/exam-wizard-next/
   （workflow 把 frontend/ 當根目錄，所以網址不會多一層 /frontend。）

## 步驟 C：上線後驗證
1. 開上面的 Pages 網址，走一次：建卷 → 目標 → 配題 → AI 生成。
2. 若 AI 生成失敗、瀏覽器主控台出現 CORS 錯誤：
   - 確認 Worker 的 ALLOWED_ORIGIN 是否正好等於 https://smallcannon-arch.github.io（無結尾斜線）。
   - 確認 frontend/src/config.js 的 PRODUCTION_API_BASE_URL 是 https://exam-wizard-next-proxy.smallcannon.workers.dev。

## 備註
- 本機開發仍照舊：worker 端 npm run dev、frontend 端 python -m http.server 8000，
  .dev.vars 已把本機 origin 覆寫回 http://localhost:8000，兩邊互不影響。
- desktop.ini 等 Windows 資料夾檔已加入 .gitignore；之前已被追蹤的舊檔若仍顯示，
  可在 GitHub Desktop 一併提交，或日後用 git rm --cached 清掉（非必要）。
- 我在 Linux 沙箱跑測試時 npm install 動到了根目錄 package-lock.json（補了 linux 平台套件），
  屬無害變更，提交或還原皆可。
