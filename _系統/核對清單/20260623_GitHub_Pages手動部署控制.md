# GitHub Pages 手動部署控制

- 日期：2026-06-23
- 分支：codex/manual-pages-deploy-control
- 性質：deploy control；不包含功能修改。

## 背景

原本 `.github/workflows/deploy-pages.yml` 同時支援：

- push to `main` 自動部署。
- `workflow_dispatch` 手動部署。

這代表任何 PR merge into `main` 都會觸發 GitHub Pages deploy workflow，容易讓「merge」與「正式部署」綁在一起。

## 本次調整

本次將 GitHub Pages 部署改為只允許 `workflow_dispatch` 手動觸發。

- merge into `main` 不再自動 deploy。
- deploy 需 owner 到 GitHub Actions 手動觸發。
- 既有 Pages deploy job 保留。
- artifact path 仍為 `./frontend`。

## 範圍限制

- 本 PR 不包含功能修改。
- 本 PR 不包含 PR #2 / PR #3 內容。
- 本 PR 不處理 npm audit。
- 本 PR 不處理 `tmp/`。
- 本 PR 不動 stash。
- 本 PR 不 deploy。
- 本 PR 不 push main。

## 後續操作

merge 本 PR 後，若要部署 GitHub Pages：

1. 到 GitHub Actions。
2. 選擇 `Deploy frontend to GitHub Pages` workflow。
3. 手動執行 `workflow_dispatch`。
4. 確認 Pages workflow 成功後，再進行正式頁 smoke test。
