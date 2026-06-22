# PR #2 Release Risk Review Checklist

- 檢查日期：2026-06-22
- PR：#2
- URL：https://github.com/smallcannon-arch/exam-wizard-next/pull/2
- 用途：判斷 PR #2 後續是否可維持 Draft、轉 Ready for review、merge 到 PR #1 base branch，或進一步考慮 deploy。
- 範圍：文件檢查與 release risk decision checklist；本文件不代表已同意 merge 或 deploy。

---

## 1. PR 基本資訊

| 項目 | 內容 |
| -- | -- |
| PR number | #2 |
| PR URL | https://github.com/smallcannon-arch/exam-wizard-next/pull/2 |
| PR 狀態 | `OPEN / Draft` |
| base | `codex/prompt-quality-enhancement-20260620` |
| head | `codex/generation-stabilization-20260621` |
| 是否 stacked PR | 是，疊在 PR #1 branch 上 |
| 是否可直接對 main merge | 否 |
| 是否建議直接 deploy | 否 |

目前定錨：

- PR #2 已完成 review readiness check。
- 最新已推送 commit：`f9eea66 docs(stabilization): 補 PR2 review readiness check`。
- GitHub 目前未回報 checks / CI。
- raw output +180.1% 已於 PR body 揭露為 cost / observability risk。
- 本階段不可 merge、不可 deploy。

## 2. Gate Review

| gate | 結果 | 判定 | 是否阻擋 merge | 是否阻擋 deploy |
| -- | -- | -- | -- | -- |
| structure gate | B5 12/12 成功，JSON parse / validation / qualityMeta / answer contract / distractorDesign key / student leakage failure 全 0 | 通過 | 否 | 否 |
| duration gate | B5 80.6s，main 82.5s，B5 快 2.3% | 通過 | 否 | 否 |
| budget warning gate | `overBudgetItemCount = 0`，`QUALITY_META_OVER_BUDGET = 0`，`SINGLE_DISTRACTOR_OVER_BUDGET = 0` | 通過 | 否 | 否 |
| leakage gate | student leakage = 0 | 通過 | 否 | 否 |
| raw output risk | B5 raw output 相對 main +180.1% | risk disclosure | 不一定，需 reviewer 明確接受 | 需 release decision |
| CI checks | GitHub 回報 no checks reported | 待補人工檢查 | 不一定 | 需人工 smoke |

判讀：

- B5 的結構、時間、budget warning、student leakage gate 均已過關。
- 唯一主要 release risk 是 raw output +180.1%。
- GitHub 無 CI checks，不表示失敗，但 merge/deploy 前不能把 CI 視為已保護。

## 3. Raw Output Risk Review

raw output +180.1% 的主要來源是 `qualityMeta` 與其內部品質說明欄位。這些欄位承擔以下用途：

- 保存誘答設計依據。
- 保存錯誤選項迷思標籤與教師解析資訊。
- 支援審題、人工可用率判斷與後續診斷。
- 降低學生版外洩內部資訊的風險，因內部設計資訊有明確欄位邊界。

因此 `qualityMeta` 是品質提升機制，不宜為了壓 raw output 直接移除。

目前 gate 判讀：

- duration gate 已通過，表示 raw output 增加尚未在 B5 測試中表現為生成時間退化。
- budget warning gate 已通過，表示單題與 `qualityMeta` 長度未超過本批設定的 warning threshold。
- raw output +180.1% 仍可能造成 token 成本、儲存成本、log / observability 資料量增加。

若後續實測成本偏高，建議啟動下列獨立工項，而不是在 PR #2 內臨時刪欄位：

- `qualityMeta` tiered detail：依題型、科目、審題模式輸出不同詳細度。
- teacher-review mode：教師審題時才產生完整內部設計說明。
- debug mode：僅在診斷或 A/B 時輸出完整 `qualityMeta`。
- `correctReason / distractorDesign` 第二輪壓縮：保留語意但再縮短文字量。

Release note 必填風險：

```text
本版本引入 qualityMeta 與誘答設計診斷資訊。B5 測試中結構、duration、budget warning 與 student leakage gates 均通過，但 raw output 相對 main 增加約 +180.1%。此為 cost / observability risk disclosure；deploy 前需確認成本、log 量與觀測方案可接受，並準備 rollback plan。
```

## 4. Merge 前條件

merge PR #2 前至少需完成：

- [ ] PR reviewer 已閱讀 PR body 的 `Known Risks`。
- [ ] reviewer 明確接受 raw output +180.1% 作為 cost / observability risk。
- [ ] 確認 stacked PR base 正確：`codex/prompt-quality-enhancement-20260620`，不是 main。
- [ ] 確認 PR #1 仍為 Draft，或其狀態與 PR #2 相容。
- [ ] 再跑一次 final smoke：
  - [ ] `npm test`
  - [ ] `npm run check`
  - [ ] `node --check worker/src/prompts.js`
  - [ ] `node --check frontend/src/core/outputDiagnostics.js`
  - [ ] `node --check frontend/src/core/normalizeItem.js`
  - [ ] `node --check frontend/src/core/validateGeneratedPaper.js`
  - [ ] `node --check frontend/src/core/schema.js`
  - [ ] `node --check frontend/src/core/itemViews.js`
- [ ] 確認未納入 `tmp/`。
- [ ] 確認未納入 repo 外 raw output。
- [ ] 確認未處理 npm audit。
- [ ] 確認未動 stash。
- [ ] 確認 merge 不會觸發 main deploy。

merge 判斷：

- 若 reviewer 接受 raw output risk，且 final smoke 通過，可以考慮從 Draft 轉 Ready for review。
- 若 reviewer 不接受 raw output risk，PR #2 應維持 Draft，並另開 `qualityMeta` 分層或 debug mode 設計批。

## 5. Deploy 前條件

deploy 前條件比 merge 更嚴格。即使 PR #2 後續可 merge，也不等於可直接 deploy。

deploy 前至少需完成：

- [ ] main 上完成測試。
- [ ] Worker / Pages 部署環境確認。
- [ ] env / secret 未變更。
- [ ] 不含 API key / token / header。
- [ ] release note 已揭露 raw output / cost risk。
- [ ] 至少完成等待文案或進度 UI MVP 決策。
- [ ] 有 rollback plan。
- [ ] 有 deploy 後觀測項目：
  - [ ] 平均生成時間。
  - [ ] 失敗率。
  - [ ] validation failure。
  - [ ] raw output / `qualityMeta` length sample。
  - [ ] 使用者等待回饋。

deploy 判斷：

- PR #2 目前不建議直接 deploy。
- deploy 前需另做 release risk review，並確認 raw output +180.1% 的 cost / observability risk 已被接受。

## 6. Reviewer Checklist

Reviewer 可勾選：

- [ ] PR base / head 正確。
- [ ] PR 維持 Draft。
- [ ] 變更範圍符合 generation-stabilization。
- [ ] 測試摘要可信。
- [ ] B5 gates 結果已閱讀。
- [ ] raw output +180.1% 風險已閱讀。
- [ ] 同意目前不直接 deploy。
- [ ] 同意不處理 npm audit。
- [ ] 同意不處理 `tmp/`。
- [ ] 同意 stash 不動。

如 reviewer 對 raw output 風險仍有疑慮，請不要把 PR #2 轉 Ready for review；應先決定是否啟動 `qualityMeta` 分層或 debug mode。

## 7. 建議決策

目前建議：

- PR #2 可以維持 Draft 並進 review。
- 不建議現在 merge。
- 不建議現在 deploy。
- 若 reviewer 接受 raw output risk，可考慮將 PR 從 Draft 轉 Ready for review。
- 若 reviewer 不接受 raw output risk，下一步應規劃 `qualityMeta` tiered detail / teacher-review mode / debug mode，而不是 merge。

本階段不建議事項：

- 不 merge。
- 不 deploy。
- 不 push main。
- 不動 stash。
- 不處理 `tmp/`。
- 不處理 npm audit vulnerability。
- 不做 npm audit fix。
- 不重跑生成。
- 不追加功能程式或 prompt 修補。

---

結論：PR #2 的 release risk 已被整理成可審核 checklist。下一步是 reviewer 閱讀 PR body、B5 gates 與本 checklist，決定是否接受 raw output +180.1% 作為 release risk disclosure；在此之前，PR #2 應維持 Draft，不應 merge 或 deploy。
