# PR #2 Release Risk Review 決策紀錄

- 建立日期：2026-06-22
- PR：#2
- URL：https://github.com/smallcannon-arch/exam-wizard-next/pull/2
- 用途：記錄 PR #2 release risk review 的決策選項與後續路線。
- 性質：文件決策紀錄；不代表已 merge、已 deploy，或已接受 production release。

---

## 1. 審查範圍

| 項目 | 內容 |
| -- | -- |
| PR number | #2 |
| PR 狀態 | `OPEN / Draft` |
| base | `codex/prompt-quality-enhancement-20260620` |
| head | `codex/generation-stabilization-20260621` |
| 最新 commit | `31c25ae docs(stabilization): 新增 PR2 release risk review checklist` |
| 審查目的 | 判斷 raw output +180.1% 是否可接受為 release risk |
| 是否審查 deploy | 否，本輪只審查 release risk |

本輪只處理 release risk decision log，不改功能程式、不改 prompt、不重跑生成、不 merge、不 deploy。

## 2. 已通過 Gate

| gate | 結果 | 判定 |
| -- | -- | -- |
| structure gate | B5 12/12 成功，JSON parse / validation / qualityMeta / answer contract / distractorDesign key / student leakage failure 全 0 | 通過 |
| duration gate | B5 80.6s，main 82.5s，B5 快 2.3% | 通過 |
| budget warning gate | `overBudgetItemCount = 0`，`QUALITY_META_OVER_BUDGET = 0`，`SINGLE_DISTRACTOR_OVER_BUDGET = 0` | 通過 |
| leakage gate | student leakage 0 | 通過 |
| final smoke | `npm test`、`npm run check`、指定核心檔案 `node --check` 通過 | 通過 |

判定：B5 的結構、時間、budget warning、學生版外洩與 final smoke 均已符合本批 merge review 前的技術基本線。

## 3. 仍存在風險

### Raw Output +180.1%

- 性質：cost / observability risk。
- 主要原因：`qualityMeta` 架構本身帶來的輸出增加。
- 目前不直接造成 duration 退化；B5 duration gate 已通過。
- 仍可能造成 token 成本、儲存成本、log / diagnostics 體積、未來擴題成本上升。
- 此風險已於 PR body、review readiness check 與 release risk checklist 中揭露。

若後續實測成本偏高，需啟動：

- `qualityMeta` tiered detail。
- teacher-review mode。
- debug mode。
- `correctReason / distractorDesign` 第二輪壓縮。

### 尚未 Production Deploy

- 本輪只有本機與 repo 外生成測試。
- 尚未在 production Worker / Pages 驗證。
- 不建議直接 deploy。
- deploy 前仍需 release checklist、rollback plan 與部署後觀測項目。

### Stacked PR 風險

- PR #2 疊在 PR #1 上。
- merge 前須再次確認 base branch 與 PR #1 狀態。
- 不可直接推 main。
- 不可將 PR #2 誤當成直接對 main 的 release PR。

## 4. 決策選項

### A. 維持 Draft

適用條件：

- reviewer 尚未接受 raw output +180.1%。
- 希望先補 `qualityMeta` tiered detail / debug mode。
- 不急著 merge。

結果：

- PR #2 保持 Draft。
- 不進 merge review。
- 不 deploy。
- 等 reviewer 補意見或啟動 5C-14。

### B. 轉 Ready for review

適用條件：

- reviewer 接受 raw output +180.1% 作為 release risk disclosure。
- reviewer 願意讓 PR 進入正式 code review。
- reviewer 理解 Ready for review 不代表可 merge / deploy。

結果：

- PR #2 可從 Draft 轉 Ready for review。
- 進正式 review。
- merge 前仍需 final smoke。
- deploy 前仍需 release checklist 與 rollback plan。

### C. 要求補修

適用條件：

- reviewer 不接受 raw output +180.1%。
- reviewer 要求先降低 raw output。
- reviewer 認為 cost / observability risk 不可接受。

結果：

- PR #2 不進 merge。
- PR #2 不進 deploy。
- 下一步應規劃 `qualityMeta` tiered detail / debug mode。
- 補修範圍應限制在 raw output / `qualityMeta` 詳細度控制，不應擴張到分批生成或非同步 job queue。

## 5. 建議決策

依目前資料，建議：

- PR #2 可維持 Draft 並進 release risk review。
- 若 reviewer 接受 raw output +180.1% 風險，可轉 Ready for review。
- 不建議現在 merge。
- 不建議現在 deploy。
- 不建議再追加無關功能。
- 若要求補修，下一步應限定在 `qualityMeta` tiered detail / debug mode，不應擴張到分批生成或非同步 job queue。

本批已經不是「能不能跑」的問題，而是「是否接受品質資料帶來的成本」。若接受，進 review；若不接受，開 5C-14 做輸出分層，而不是在 PR #2 繼續零碎修補。

## 6. Reviewer 簽核欄位

- [ ] 已閱讀 B5 gates。
- [ ] 已閱讀 raw output +180.1% 風險。
- [ ] 接受 raw output 風險作為 release risk disclosure。
- [ ] 不接受 raw output 風險，要求補修。
- [ ] 同意 PR #2 繼續維持 Draft。
- [ ] 同意 PR #2 可轉 Ready for review。
- [ ] 不同意 merge。
- [ ] 不同意 deploy。
- [ ] 確認不處理 npm audit。
- [ ] 確認不處理 `tmp/`。
- [ ] 確認 stash 不動。

備註：以上勾選應由 reviewer / release risk owner 判斷；本文件只提供決策框架。

## 7. 後續路線

### 若選 A：維持 Draft

- 維持 Draft。
- 等 reviewer 補意見。
- 不新增功能。
- 不 merge。
- 不 deploy。

### 若選 B：轉 Ready for review

- 將 PR #2 轉 Ready for review。
- 進正式 review。
- merge 前再跑 final smoke。
- deploy 前另做 release checklist。

### 若選 C：要求補修

- 開任務 5C-14：`qualityMeta` tiered detail / debug mode 設計。
- 不進 merge。
- 不進 deploy。
- 不擴張到分批生成或非同步 job queue。

## 8. 本階段禁止事項

- 不 merge PR #2。
- 不把 PR #2 轉 Ready，除非 reviewer 接受 raw output 風險。
- 不 deploy。
- 不 push main。
- 不處理 `tmp/`。
- 不動 stash。
- 不修 npm audit。
- 不追加 unrelated 功能。
- 不重跑大型生成。

---

結論：PR #2 已具備 release risk review 的決策資料。下一步應由 reviewer 勾選本紀錄，決定 PR #2 維持 Draft、轉 Ready for review，或進入 5C-14 補修；目前仍不建議 merge 或 deploy。
