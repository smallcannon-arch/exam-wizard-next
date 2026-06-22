# 任務 5C-9：B5 Final Smoke 與 PR 準備紀錄

日期：2026/6/21  
性質：送審前 final smoke checklist 與 Draft PR / stacked PR review 準備；不改功能程式、不改 prompt、不重跑生成。

## 1. 分支狀態

| 項目 | 結果 |
| -- | -- |
| current branch | `codex/generation-stabilization-20260621` |
| latest commit | `9405ae5 docs(stabilization): 建立 B5 PR readiness 與 merge 條件清單` |
| working tree | 除既存 `?? tmp/` 外無其他未提交變更 |
| untracked tmp/ | 保持不處理 |
| stash | `stash@{0}: On codex/prompt-quality-enhancement-20260620: wip: local changes excluded from prompt-quality PR`，保持不動 |
| main | 未推送 |
| deploy | 未執行 |

本次執行過的確認指令：

```text
git status -sb
git branch --show-current
git log --oneline --decorate -10
git stash list
```

## 2. Stacked PR 檢查

| 項目 | 結果 |
| -- | -- |
| PR #1 branch | `codex/prompt-quality-enhancement-20260620` |
| stabilization branch | `codex/generation-stabilization-20260621` |
| 建議 PR base | `codex/prompt-quality-enhancement-20260620` |
| 是否可直接對 main 開 PR | 不建議 |
| 待確認事項 | 開 PR 前再次確認 base / compare 與 GitHub 上 PR #1 狀態；若要改對 main，需先整理 stacked branch。 |

本地檢查結果：

- `codex/prompt-quality-enhancement-20260620` 本地存在。
- `codex/generation-stabilization-20260621` 本地存在且為目前分支。
- merge-base：`f2892137e9324baef9bac0495d556903d75e1e85`
- PR #1 branch HEAD：`f289213 docs(ab): 記錄 Run 1R 品質通過與效能風險結論`
- `codex/prompt-quality-enhancement-20260620..codex/generation-stabilization-20260621` 顯示 stabilization 批 commit 疊在 PR #1 之上。

## 3. Final Smoke 結果

| 檢查 | 結果 |
| -- | -- |
| npm test | 通過，19 檔、172 tests passed |
| npm run check | 通過，核心純函式層檢查通過 |
| node --check prompts.js | 通過 |
| node --check outputDiagnostics.js | 通過 |
| node --check normalizeItem.js | 通過 |
| node --check validateGeneratedPaper.js | 通過 |
| node --check schema.js | 通過 |
| node --check itemViews.js | 通過 |

node --check 實際檢查檔案：

```text
worker/src/prompts.js
frontend/src/core/outputDiagnostics.js
frontend/src/core/normalizeItem.js
frontend/src/core/validateGeneratedPaper.js
frontend/src/core/schema.js
frontend/src/core/itemViews.js
```

## 4. B5 Gates 摘要

| gate | 結果 | 判定 |
| -- | -- | -- |
| structure gate | 12/12 成功，failure 全 0 | 通過 |
| duration gate | B5 80.6s，main 82.5s | 通過 |
| budget warning gate | overBudgetItemCount 0 | 通過 |
| leakage gate | student leakage 0 | 通過 |
| raw output risk | +180.1% | risk disclosure |
| deploy recommendation | 不直接 deploy | 暫緩 |

B5 可進入 PR readiness 與 final review，但不得視為可直接 deploy。raw output +180.1% 需在 PR / release risk 中明確揭露。

## 5. PR Description 最終草稿

```markdown
## Summary

本 PR 是 PR #1（`codex/prompt-quality-enhancement-20260620`）之上的 generation stabilization / prompt slimming 批。目標是讓新版 `qualityMeta`、answer contract、options array contract 與 `distractorDesign` key contract 在整卷生成下穩定，並建立 output budget diagnostics 與 deploy gate 判讀。

本 PR / 分支應維持 Draft，直到 release risk review 完成。

## What Changed

- 補強選擇題 `answer` 必須為 A/B/C/D 的 prompt contract。
- 補強 `options` 必須為 JSON array 的 prompt contract。
- 補強 `qualityMeta.distractorDesign` 必須使用錯誤選項代號作為 key，且不得包含正答 key。
- 新增 output budget diagnostics，追蹤 raw output、student item、qualityMeta、distractorDesign、single distractor 長度與 warning。
- 對數學題新增 `qualityMeta / distractorDesign` targeted compact contract。
- 建立生成等待 UX、分批生成、進度 UI、deploy gate 與 raw output 風險決策文件。
- 建立 PR readiness 風險摘要與 merge / deploy 條件清單。

## Validation

- `npm test`：通過，19 檔、172 tests passed。
- `npm run check`：通過，核心純函式層檢查通過。
- `node --check`：
  - `worker/src/prompts.js`
  - `frontend/src/core/outputDiagnostics.js`
  - `frontend/src/core/normalizeItem.js`
  - `frontend/src/core/validateGeneratedPaper.js`
  - `frontend/src/core/schema.js`
  - `frontend/src/core/itemViews.js`
- repo 外生成測試：
  - B4 標準整卷：12/12 成功，structure gate 通過。
  - 5C-5 數學 compact 回歸：3/3 成功，budget warnings 明顯下降。
  - B5 vs main 標準整卷：B5 12/12 成功，國語 6/6、數學 6/6。

## Gates

- Structure gate：通過。B5 12/12 成功，JSON parse / validation / qualityMeta / answer contract / distractorDesign key / student leakage failure 全 0。
- Duration gate：通過。B5 80.6s，main 82.5s，B5 快 2.3%。
- Budget warning gate：通過。`overBudgetItemCount = 0`，`QUALITY_META_OVER_BUDGET = 0`，`SINGLE_DISTRACTOR_OVER_BUDGET = 0`。
- Leakage gate：通過。student leakage = 0。
- Raw output risk：需揭露。B5 raw output 相對 main +180.1%。

## Known Risks

- raw output +180.1% 為 cost / observability risk disclosure。它不再是唯一 hard deploy blocker，但必須在 review / release note 中明確揭露。
- B5 尚未 deploy 實測，不建議直接 deploy。
- 本分支疊在 PR #1 上，開 PR 時 base 應確認為 `codex/prompt-quality-enhancement-20260620`。
- 若實際使用成本或 latency 惡化，需啟動 tiered qualityMeta / teacher-review mode / debug mode 或進一步 compact。

## Not Included

- 不包含 npm audit vulnerability 修補。
- 不包含 `tmp/`。
- 不動 stash。
- 不 push main。
- 不包含分批生成 POC。
- 不包含非同步 job queue。
- 不包含 raw output JSON 或任何 repo 外生成產物。
- 不包含 API key / token / header。

## Deployment Recommendation

不建議直接 deploy。B5 可進入 PR readiness 與 final review，但 deploy 前需另做 release risk review，確認 raw output +180.1% 的 cost / observability risk 已被接受，並準備回滾方案。

## Reviewer Notes

- 這是 stacked PR，base 建議為 `codex/prompt-quality-enhancement-20260620`，compare 為 `codex/generation-stabilization-20260621`。
- 請優先 review prompt / schema contract 穩定性、diagnostics 是否合理、以及 raw output risk 是否可接受。
- 請不要把既存 untracked `tmp/`、stash 或 npm audit vulnerability 混入本 PR。
- 若 reviewer 不接受 raw output +180.1%，建議不要繼續小修 prompt，而是啟動 tiered qualityMeta / teacher-review mode / debug mode 的獨立設計。
```

## 6. 下一步建議

1. 更新或建立 generation-stabilization stacked Draft PR。
2. PR base 應確認為 `codex/prompt-quality-enhancement-20260620`。
3. 貼上 PR description。
4. 等 review。
5. 若 review 接受 raw output risk，再決定 merge 條件。
6. deploy 前需另做 release risk review。

完成本文件後，這批可從「開發中」轉為「待審查」。目前不要再追加功能，避免把已經穩住的 B5 拉回不穩定狀態。
