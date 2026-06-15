# 開發路線圖

## Phase 0：骨架跑起來

- [ ] 前端可用 `python -m http.server 8000` 開啟。
- [ ] 可離線建立藍圖。
- [ ] 可離線產生示範題。
- [ ] 可離線重出示範題。
- [ ] `npm test` 通過。

## Phase 1：接上 Worker

- [ ] Worker `/health` 可連線。
- [ ] Worker `/generate-items` 可回傳正式試題草稿。
- [ ] Worker `/regenerate-item` 可回傳一題。
- [ ] 前端 API Base URL 可改成部署後 URL。

## Phase 2：老師可用的 MVP

- [ ] 題目可逐題編修。
- [ ] 選擇題 options 可編輯。
- [ ] 可手動新增/刪除題目。
- [ ] 可匯出 JSON 草稿。
- [ ] 可匯入 JSON 草稿。
- [ ] 學生卷與教師卷格式較完整。

## Phase 3：審核表

- [ ] 目標配分表。
- [ ] 題型統計表。
- [ ] 認知層次統計表。
- [ ] 檢核警示清單。
- [ ] 教師人工確認欄位。

## Phase 4：題組

- [ ] 題組共同文本。
- [ ] 題組小題。
- [ ] 題組整組重出。
- [ ] 單題重出時不破壞共同文本。

## Phase 5：科目 adapter

- [ ] 自然科 adapter。
- [ ] 國語科 adapter。
- [ ] 數學科 adapter。
