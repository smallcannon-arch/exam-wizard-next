# PR #2 Review Readiness Check

- 檢查日期：2026-06-22
- PR：#2
- URL：https://github.com/smallcannon-arch/exam-wizard-next/pull/2
- Title：`stabilization: prompt output budget and generation reliability hardening`
- 性質：generation-stabilization stacked Draft PR readiness check

---

## 1. PR 基本資訊

| 項目 | 狀態 |
| -- | -- |
| PR number | #2 |
| PR URL | https://github.com/smallcannon-arch/exam-wizard-next/pull/2 |
| Base | `codex/prompt-quality-enhancement-20260620` |
| Head | `codex/generation-stabilization-20260621` |
| Draft | 是，`isDraft: true` |
| State | `OPEN` |
| Merge | 未 merge，`mergedAt: null` |
| Deploy | 未執行；本 PR body 亦明確不建議直接 deploy |

判定：PR #2 的 stacked PR 方向正確，base 並非 main。

## 2. Commit Range 檢查

檢查指令：

```text
git log --oneline codex/prompt-quality-enhancement-20260620..codex/generation-stabilization-20260621
```

結果共 23 個 commits：

```text
7cb2a49 docs(stabilization): 補 B5 final smoke 與 PR 準備紀錄
9405ae5 docs(stabilization): 建立 B5 PR readiness 與 merge 條件清單
c150222 docs(stabilization): 重新判讀 B5 deploy gate 與 raw output 風險
09320a8 docs(diagnostics): 記錄 B5 標準整卷重測結果
923f616 docs(diagnostics): 記錄數學 compact 回歸結果
42eee52 fix(prompts): 壓縮數學誘答設計輸出契約
8b025fd docs(diagnostics): 記錄 4F output budget 回算結果
87290b9 feat(diagnostics): 新增 output budget 診斷工具
da3a566 docs(stabilization): 定義生成進度 UI 規格
de1df15 docs(stabilization): 規劃生成等待 UX 與分批非同步方案
bd949c7 docs(stabilization): 記錄 B4 標準整卷重測結果
1308a6f docs(stabilization): 記錄國語答案契約回歸結果
d4a1bed fix(schema): 穩定答案代號與誘答設計鍵值契約
650ef76 docs(stabilization): 記錄標準整卷壓力測阻擋結果
eafb76f docs(stabilization): 記錄小型整卷壓力測結果
3336d7c docs(stabilization): 記錄 B3 對 main 小樣本 A/B 結果
5c7cb46 docs(stabilization): 記錄 options contract smoke 回歸結果
b17bfee fix(schema): 穩定 options array 輸出與正規化防禦
a43aed7 docs(stabilization): 記錄 qualityMeta compact 完整複測結果
3c9f210 feat(prompts): 壓縮 qualityMeta 輸出契約
add3ded docs(stabilization): 記錄 prompt pruning 效能複測結果
272c1ca feat(prompts): 依科目與題型裁切命題規則
35cd506 docs(stabilization): 新增生成流程穩定化與 prompt 瘦身批規劃
```

判定：commit range 只包含 generation-stabilization / prompt slimming / diagnostics / schema contract / tests / documentation 相關 commits，未混入 main merge、deploy、npm audit 或 stash 內容。

## 3. Changed Files 檢查

檢查指令：

```text
git -c core.quotePath=false diff --name-status codex/prompt-quality-enhancement-20260620..codex/generation-stabilization-20260621
```

PR changed files 共 17 個：

```text
A  _系統/核對清單/20260621_B5_PR_readiness風險摘要與merge條件.md
A  _系統/核對清單/20260621_B5_deploy_gate與raw_output風險決策.md
A  _系統/核對清單/20260621_B5_final_smoke與PR準備.md
A  _系統/核對清單/20260621_output_qualityMeta_budget_diagnostics.md
A  _系統/核對清單/20260621_生成流程穩定化與prompt瘦身批_規劃.md
A  _系統/核對清單/20260621_生成等待UX與分批非同步方案規劃.md
A  _系統/核對清單/20260621_生成進度UI規格.md
M  frontend/src/core/normalizeItem.js
A  frontend/src/core/outputDiagnostics.js
M  frontend/src/core/schema.js
M  frontend/src/core/validateGeneratedPaper.js
M  tests/itemViews.test.js
M  tests/normalizeItem.test.js
A  tests/outputDiagnostics.test.js
M  tests/prompts.test.js
M  tests/validateGeneratedPaper.test.js
M  worker/src/prompts.js
```

檢查結論：

- 不包含 `tmp/`。
- 不包含 stash 內容。
- 不包含 npm audit fix。
- 不包含 repo 外 raw output JSON 或生成產物。
- 不包含 API key / token / header；以 diff 高風險字串掃描未發現 `ghp_`、`gho_`、`AIza`、`sk-`、`Authorization: Bearer`、`apiKey =`、`token =`、`SECRET =` 等明顯機密型態。
- 文件、prompt、schema、diagnostics、tests 變更符合本批 generation-stabilization 範圍。

備註：changed files 中的 `20260621_B5_deploy_gate與raw_output風險決策.md` 是風險判讀文件，不是 raw output 產物。

## 4. Checks / CI 狀態

檢查指令：

```text
gh pr checks 2 --json name,state,bucket,workflow,description,event,link,startedAt,completedAt
```

GitHub CLI 回報：

```text
no checks reported on the 'codex/generation-stabilization-20260621' branch
```

判定：目前未找到 GitHub PR checks / CI 結果。PR #2 的驗證依據仍以本地與 repo 外測試紀錄為主：

- `npm test`：19 檔、172 tests passed。
- `npm run check`：通過。
- `node --check`：`worker/src/prompts.js`、`frontend/src/core/outputDiagnostics.js`、`frontend/src/core/normalizeItem.js`、`frontend/src/core/validateGeneratedPaper.js`、`frontend/src/core/schema.js`、`frontend/src/core/itemViews.js` 通過。
- repo 外 B5 標準整卷測試：12/12 成功。

## 5. PR Body 完整性

PR body 已包含：

- `Summary`
- `What Changed`
- `Validation`
- `Gates`
- `Known Risks`
- `Not Included`
- `Deployment Recommendation`
- `Reviewer Notes`

重點內容檢查：

| 項目 | PR body 狀態 |
| -- | -- |
| B5 structure gate passed | 已寫入：B5 12/12 成功，structure gate 通過 |
| B5 duration gate passed | 已寫入：B5 80.6s，main 82.5s，B5 快 2.3% |
| B5 budget warning gate passed | 已寫入：`overBudgetItemCount = 0`、`QUALITY_META_OVER_BUDGET = 0`、`SINGLE_DISTRACTOR_OVER_BUDGET = 0` |
| raw output +180.1% risk disclosure | 已寫入：cost / observability risk disclosure |
| 不建議直接 deploy | 已寫入：Known Risks 與 Deployment Recommendation 均明確表示不建議直接 deploy |
| 不包含 npm audit | 已寫入 |
| 不包含 `tmp/` | 已寫入 |
| 不包含 main push | 已寫入：不 push main |
| stacked PR / base 非 main | 已寫入：base 為 `codex/prompt-quality-enhancement-20260620` |

小備註：PR body 的 `Not Included` 條列已寫「不 push main」，並在 Reviewer Notes 說明 stacked base；未逐字列出「不 merge main」。但 base/head 設定與 body 內容已足以表達本 PR 不直接進 main。若後續 reviewer 要更嚴格措辭，可另補 PR body，但目前不構成阻擋。

## 6. Release Risk 揭露

PR body 對 release risk 的揭露充足：

- 明確揭露 raw output 相對 main +180.1%。
- 明確定性為 cost / observability risk disclosure。
- 明確說明它不再是唯一 hard deploy blocker，但必須在 review / release note 中揭露。
- 明確說明 B5 尚未 deploy 實測，不建議直接 deploy。
- 明確說明 deploy 前需 release risk review。
- 明確說明 deploy 前需確認 raw output +180.1% 的 cost / observability risk 已被接受。
- 明確要求準備 rollback plan。
- 若實際使用成本或 latency 惡化，PR body 已寫需啟動 tiered qualityMeta / teacher-review mode / debug mode 或進一步 compact。

判定：release risk 揭露足以進入 review，但仍不建議 merge 或 deploy。

## 7. 本機狀態

檢查指令：

```text
git status -sb
git branch --show-current
git stash list
```

結果：

```text
## codex/generation-stabilization-20260621...origin/codex/generation-stabilization-20260621
?? tmp/
```

```text
codex/generation-stabilization-20260621
```

```text
stash@{0}: On codex/prompt-quality-enhancement-20260620: wip: local changes excluded from prompt-quality PR
```

判定：

- 目前分支正確。
- 工作樹除本文件新增外，只有既存 untracked `tmp/`。
- `tmp/` 未 stage、未刪除、未處理。
- stash 未動。
- main 未 push。
- deploy 未執行。

## 8. 是否建議進入 Review

建議：可以進入 Draft PR review。

理由：

- PR #2 base/head 正確，維持 stacked PR。
- PR 仍為 Draft，未 merge。
- Commit range 與 changed files 均符合 generation-stabilization 批次範圍。
- 未發現 `tmp/`、stash、npm audit fix、repo 外 raw output 產物或明顯機密混入。
- PR body 已揭露 B5 gates 與 raw output +180.1% release risk。
- GitHub 目前未回報 checks / CI；需以本地 smoke 與 repo 外生成驗證紀錄作為 review 依據。

Review 重點建議：

- prompt / schema contract 是否過度收斂或影響題目品質。
- `outputDiagnostics` 的 warning gate 是否足夠解釋 output budget。
- raw output +180.1% 是否能被 release 風險接受。
- 若無法接受 raw output 風險，下一步應另開 tiered qualityMeta / teacher-review mode / debug mode，而不是在本 PR 繼續小修 prompt。

## 9. 不建議事項

本階段請不要：

- 不 merge。
- 不 deploy。
- 不 push main。
- 不動 stash。
- 不處理 `tmp/`。
- 不處理 npm audit vulnerability。
- 不做 npm audit fix。
- 不重跑生成。
- 不追加 prompt / schema / 功能修補。

---

結論：PR #2 已具備 Draft PR review 資料完整性，可以送 review；但仍不應 merge 或 deploy，需先完成 release risk review。
