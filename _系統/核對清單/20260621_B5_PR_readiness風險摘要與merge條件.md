# 任務 5C-8：B5 PR Readiness 風險摘要與 Merge 條件清單

日期：2026/6/21  
性質：PR readiness 文件，只整理風險、界線、merge / deploy 條件；不改功能程式、不改 prompt、不重跑生成。

## 1. 分支與 PR 關係

- PR #1：`codex/prompt-quality-enhancement-20260620`
- 穩定化分支：`codex/generation-stabilization-20260621`
- `generation-stabilization` 是從 PR #1 分支開出，不是從 `main` 直接開出。

若後續開 PR，base 應優先確認：

- base：`codex/prompt-quality-enhancement-20260620`
- compare：`codex/generation-stabilization-20260621`

不應直接對 `main` 開 PR，除非先重新整理 stacked PR 關係，避免把 PR #1 與穩定化批全部混在一個 main PR 中。此批應被視為 PR #1 之上的生成穩定化 / prompt 瘦身補強層。

## 2. B5 現況摘要

| gate | 結果 | 判定 |
| -- | -- | -- |
| structure gate | 12/12 成功，JSON / validation / contract failure 全 0 | 通過 |
| duration gate | B5 80.6s，main 82.5s，B5 快 2.3% | 通過 |
| budget warning gate | overBudgetItemCount 0，qualityMeta / singleDistractor warning 0 | 通過 |
| leakage gate | student leakage 0 | 通過 |
| raw output risk | B5 相對 main +180.1% | 風險揭露 |
| deploy gate | 未建議直接 deploy | 暫緩 |

固定判斷句：

> B5 可進 PR readiness 與 final review；但不得視為可直接 deploy。raw output +180.1% 應在 PR / release risk 中明確揭露。

## 3. 已完成的主要修正

- prompt pruning：刪減與題位制衝突或重複的舊提示，降低 AI 認知負擔。
- qualityMeta compact：將命題品質欄位收斂為較短的 `qualityMeta` 輸出契約，避免 teacherExplanation 等欄位膨脹。
- options array contract：明確要求選項必須是 JSON array，避免 AI 回傳 `{ "A": "...", "B": "..." }` 形式破壞前端。
- answer option-code contract：明確要求選擇題 `answer` 必須是 A/B/C/D，不得是選項文字。
- distractorDesign wrong-option-code key contract：要求 `qualityMeta.distractorDesign` 只能以錯誤選項代號作 key，且不可包含正答 key。
- output budget diagnostics：新增 repo 內 helper 與 repo 外分析流程，追蹤 raw output、student item、qualityMeta、distractorDesign、single distractor 等長度與 warning。
- 數學 qualityMeta / distractorDesign targeted compact：針對數學超 budget 題位壓縮 correctReason、teacherExplanation 與各錯誤選項設計欄位；5C-5 / 5C-6 顯示 warning 歸零。
- 生成等待 UX 與分批 / 非同步方案規劃：整理同步等待、分批生成、進度 UI、job queue 的取捨，不在本批擴大架構變更。
- 生成進度 UI 規格：定義後續同步生成進度提示的 MVP 方向，降低長時間等待的不確定感。
- deploy gate 與 raw output 風險重新判讀：將 raw output +180.1% 從唯一 hard deploy blocker 調整為 cost / observability risk disclosure，但仍不建議直接 deploy。

## 4. 已完成驗證摘要

| 驗證項目 | 類型 | 摘要 |
| -- | -- | -- |
| 3B qualityMeta compact 完整小樣本 | repo 外生成測試 | 驗證 compact 後 `qualityMeta` 結構可生成，並觀察 raw output / duration 變化。 |
| 3D options contract smoke | repo 外生成測試 | 驗證選項陣列契約，避免 options object 破壞前端與 validate。 |
| 4A B3 vs main 小樣本 A/B | repo 外生成測試 | 比對 main 與 B3 在小樣本下的成功率、duration、raw output。 |
| 4B 小型整卷 | repo 外生成測試 | 驗證小型整卷生成流程與基本結構。 |
| 4C B3 標準整卷阻擋 | repo 外生成測試 | 發現 B3 標準整卷仍有阻擋問題，促成後續 answer / distractorDesign contract 修正。 |
| 4E 國語 answer / distractorDesign 回歸 | repo 外生成測試 | 驗證國語題 answer A/B/C/D 與 distractorDesign key 契約穩定。 |
| 4F B4 標準整卷 | repo 外生成測試 | B4 12/12 成功，structure gate 通過，但 duration +26.4%、raw output +181.6%，deploy gate 未通過。 |
| 5C-5 數學 compact 回歸 | repo 外生成測試 | 3 題數學超 budget 題位 3/3 成功，`SINGLE_DISTRACTOR_OVER_BUDGET` 2 -> 0，`QUALITY_META_OVER_BUDGET` 3 -> 1。 |
| 5C-6 B5 vs main 標準整卷 | repo 外生成測試 | B5 12/12 成功，duration -2.3%，budget warnings 歸零；raw output 仍 +180.1%。 |
| npm test 最終狀態 | repo 內驗證 | 5C-4 程式變更後已通過 19 檔、172 tests；其後僅文件 commit。 |
| npm run check 狀態 | repo 內驗證 | 5C-4 程式變更後已通過核心純函式層檢查；其後僅文件 commit。 |
| node --check 狀態 | repo 內驗證 | 5C-4 程式變更後已對指定核心檔案通過語法檢查；其後僅文件 commit。 |

## 5. 仍存在的風險

### 風險一：raw output +180.1%

- 性質：cost / observability risk。
- 不是目前唯一 hard blocker。
- 需於 PR / release note 揭露。
- 後續若成本或 latency 實測惡化，需啟動：
  - qualityMeta tiered detail。
  - teacher-review mode。
  - debug mode。
  - 進一步壓縮 correctReason / distractorDesign。

### 風險二：B5 尚未 deploy 實測

- 目前只有本機 / repo 外生成測試。
- 尚未進 Pages / Worker production deploy。
- 不應直接上線。
- deploy 前仍需 release risk review 與回滾方案。

### 風險三：stacked branch 關係

- `generation-stabilization` 疊在 PR #1 上。
- merge 前需確認 base branch 與 commit 範圍。
- 避免誤把未準備好的 PR #1 直接推 main。
- 若要改成對 main PR，需先重新整理 stacked PR 或 rebase 策略。

### 風險四：tmp/ 與 stash

- 既存 untracked `tmp/` 不處理。
- `stash@{0}` 仍不可動。
- merge 前須重新確認工作樹與 stash 邊界。
- staging 時必須只 stage 明確列名檔案，避免 repo 外或暫存資料混入。

## 6. PR Readiness 條件

可以開 PR / 更新 PR 的條件：

- repo 工作樹乾淨，除了既存 untracked `tmp/` 明確排除。
- feature branch 已 push。
- `npm test` 通過。
- `npm run check` 通過。
- `node --check` 通過。
- B5 標準整卷 12/12 成功。
- raw output risk 已記錄。
- PR description 必須包含 gates 結果與風險揭露。
- PR 應維持 Draft，直到 release risk review 完成。

目前 B5 可進入 PR readiness 與 final review，但不代表可直接 deploy。

## 7. Merge 條件

可以 merge 的條件：

- PR review 通過。
- stacked PR base 確認無誤。
- raw output +180.1% 已被接受為 cost / observability risk。
- release risk review 完成。
- 至少再跑一次最終 smoke，確認：
  - JSON parse failure 0。
  - validation failure 0。
  - student leakage 0。
  - answer / distractorDesign contract 0 failure。
- 校內使用情境可接受 80-90 秒等候，或同步生成進度 UI MVP 已列入 merge 後優先工作。
- 未處理 npm audit vulnerability 已被明確排除，不混入本 PR。

## 8. Deploy 條件

deploy 條件比 merge 更嚴格：

- merge 後 main 測試通過。
- Worker / Pages 部署前確認 env / secret 未變更。
- 不含 raw output 檔案。
- 不含 API key / token / header。
- 進度 UI 或等待文案至少有 MVP，或明確接受現有等待體感。
- release note 揭露：
  - qualityMeta 新增帶來 raw output 增加。
  - 成本 / latency 需觀察。
  - 若成本異常，啟動 tiered qualityMeta / debug mode。
- deploy 後需有回滾方案。

## 9. PR Description 草稿

```markdown
## Summary

本 PR 是 PR #1（prompt quality enhancement）之上的生成穩定化與 prompt 瘦身補強批。目標是讓新版 `qualityMeta`、answer contract、options array contract 與 distractorDesign key contract 在整卷生成下穩定，並建立 output budget diagnostics 與 deploy gate 判讀。

## What Changed

- 補強 answer 必須為 A/B/C/D 的 prompt contract。
- 補強 options 必須為 JSON array 的 prompt contract。
- 補強 `qualityMeta.distractorDesign` 必須使用錯誤選項代號 key，且不得包含正答 key。
- 新增 output budget diagnostics，用於追蹤 raw output、qualityMeta、distractorDesign 與 single distractor 長度。
- 對數學題新增 `qualityMeta / distractorDesign` targeted compact contract。
- 整理生成等待 UX、分批生成、進度 UI、deploy gate 與 raw output 風險決策文件。

## Validation

- `npm test`：19 檔、172 tests passed（5C-4 程式變更後；其後僅文件變更）。
- `npm run check`：通過（5C-4 程式變更後；其後僅文件變更）。
- `node --check`：指定核心檔案通過（5C-4 程式變更後；其後僅文件變更）。
- repo 外生成測試：
  - B4 標準整卷：12/12 成功，structure gate 通過。
  - 5C-5 數學 compact 回歸：3/3 成功，budget warnings 明顯下降。
  - B5 vs main 標準整卷：B5 12/12 成功，國語 6/6、數學 6/6。

## Gates

- Structure gate：通過。
- Duration gate：通過。B5 80.6s，main 82.5s，B5 快 2.3%。
- Budget warning gate：通過。overBudgetItemCount = 0，`QUALITY_META_OVER_BUDGET = 0`，`SINGLE_DISTRACTOR_OVER_BUDGET = 0`。
- Leakage gate：通過。student leakage = 0。
- Raw output risk：需揭露。B5 raw output 相對 main +180.1%。

## Known Risks

- `qualityMeta` 架構使 raw output 明顯高於 main，可能增加 token cost、儲存與 observability 成本。
- B5 尚未 deploy 實測，不建議直接上線。
- 本分支疊在 PR #1 上，開 PR 時需確認 stacked base。
- 既存 untracked `tmp/` 與 stash 不屬於本 PR，請勿混入。

## Not Included

- 不包含分批生成 POC。
- 不包含非同步 job queue。
- 不包含 npm audit vulnerability 處理。
- 不包含 raw output JSON 或任何 repo 外生成產物。
- 不包含 API key / token / header。

## Deployment Recommendation

B5 可進入 PR readiness 與 final review，但不建議未經 release risk review 直接 deploy。raw output +180.1% 應列為 cost / observability risk disclosure；若實際使用成本或 latency 惡化，需啟動 tiered qualityMeta / teacher-review mode / debug mode 或進一步 compact。
```

## 10. 下一步建議

1. 更新 / 開啟 generation-stabilization stacked PR。
2. PR 維持 Draft。
3. 補 PR description。
4. 做 final smoke checklist。
5. 再決定是否進 5B-impl 同步生成進度 UI MVP。
6. 暫不進完整非同步 job queue。

目前已經不是繼續修 prompt 的階段，而是整理 PR 風險、merge 邊界與上線條件。B5 的技術穩定性已經足以進入送審前整理；是否 deploy 則需 release risk review 後再決定。
