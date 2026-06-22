# PR #3 Release Risk Package：Release Note、Rollback Plan 與 Deploy Control

- PR：#3 https://github.com/smallcannon-arch/exam-wizard-next/pull/3
- 性質：release risk package 文件，用於 merge / deploy 前風險接受與上線控管。
- 狀態：PR #3 已 Ready for review；本文件不是 merge approval，也不是 deploy approval。

---

## 1. 目前狀態摘要

| 項目 | 狀態 |
|---|---|
| PR #3 | OPEN / Ready for review |
| Base / Head | main <- codex/release-prompt-quality-stabilized-20260621 |
| Merge state | CLEAN |
| Final smoke | 通過 |
| Structure gate | 通過 |
| Duration gate | 通過 |
| Budget warning gate | 通過 |
| Leakage gate | 通過 |
| Raw output risk | +180.1%，cost / observability risk |
| main merge deploy risk | merge into main 會觸發 GitHub Pages deploy workflow |
| Deploy approval | 尚未核准 |
| Merge approval | 尚未核准 |

---

## 2. Release Note 草稿

### Summary

本版本整合 PR #1 與 PR #2 的最終成果，透過 PR #3 作為 main-facing 整合 PR 進行 release review。

- PR #1：命題提示詞品質增強批。
- PR #2：生成流程穩定化與 output budget diagnostics。
- PR #3：main-facing 整合 PR，內容等於 PR #1 + PR #2 的最終狀態。

此版本的目標是提升命題提示詞品質、強化輸出格式契約、補足學生版投影與 validation 邊界，並建立 output budget diagnostics，讓新版題目品質與生成穩定性可被檢查與追蹤。

### What changed

- few-shot prompt-ready examples。
- `qualityMeta` / canonical item 架構。
- student item projection。
- subject / questionType-aware prompt pruning。
- qualityMeta compact output contract。
- options array contract。
- answer option-code contract。
- distractorDesign wrong-option-code key contract。
- 學力檢測題選擇題訊號 v2 validation 修正。
- distractorDesign key normalize 後正答檢查。
- output budget diagnostics。
- 數學 qualityMeta / distractorDesign targeted compact。
- 生成等待 UX 與分批 / 非同步方案規劃文件。

### Validation

- `npm test`：19 files / 181 tests passed。
- `npm run check`：通過。
- `node --check` 指定檔案通過。
- `git diff --check`：通過。
- B5 標準整卷：
  - 12/12 成功。
  - 國語 6/6。
  - 數學 6/6。
  - JSON parse failure 0。
  - validation failure 0。
  - qualityMeta failure 0。
  - answer contract failure 0。
  - distractorDesign key failure 0。
  - student leakage 0。
  - B5 totalDuration 80.6s。
  - main totalDuration 82.5s。
  - B5 快 2.3%。
  - overBudgetItemCount 0。
  - QUALITY_META_OVER_BUDGET 0。
  - SINGLE_DISTRACTOR_OVER_BUDGET 0。

### Known risks

- raw output 相對 main 增加 180.1%。
- 此風險目前列為 cost / observability risk。
- 若實測成本或 latency 惡化，後續需評估：
  - qualityMeta tiered detail。
  - teacher-review mode。
  - debug mode。
  - 進一步壓縮 correctReason / distractorDesign。
- 本版本尚未包含同步生成進度 UI MVP。
- 本版本不包含分批生成 POC。
- 本版本不包含完整非同步 job queue。

---

## 3. Rollback Plan

| 觸發情境 | 觀察指標 | 回滾動作 | 後續處理 |
|---|---|---|---|
| 生成失敗率上升 | JSON parse failure、validation failure、API failure 增加 | 回到 deploy 前 main 穩定版本 | 保留 PR #3 與 diagnostics，另開修正分支分析失敗類型 |
| latency 明顯惡化 | 平均生成時間上升、timeout 增加、使用者等待回報惡化 | 回到 deploy 前 main 穩定版本 | 評估 qualityMeta tiered detail、teacher-review mode、debug mode 或分批生成 |
| 成本或 raw output 異常 | raw output size、token cost、diagnostics 量異常增加 | 回到 deploy 前 main 穩定版本 | 回算 output budget，確認是否需要壓縮 correctReason / distractorDesign |
| 學生版內部欄位外洩 | 學生卷出現 qualityMeta、distractorDesign、teacherExplanation、selfCheck、outputDiagnostics | 立即回到 deploy 前 main 穩定版本 | 視為 leakage incident，補測 student projection 與 render path |
| 題目格式契約回歸 | options、answer、correctAnswer、distractorDesign keys 出現 contract failure | 回到 deploy 前 main 穩定版本 | 補 validation fixture，確認 normalize / validate 邊界 |
| Pages deploy 後正式頁異常 | GitHub Pages build 失敗、前台無法載入、生成流程不可用 | 回到 deploy 前 main 穩定版本或重新部署前一個穩定 artifact | 檢查 Pages workflow、frontend asset、Worker API URL 與 browser console |

Rollback 原則：

- 回到 deploy 前 main 穩定版本。
- 回滾後保留 PR #3 與相關 diagnostics / review 文件作為修正參考。
- 回滾後不得直接 hotfix main，除非另開 emergency fix 流程。
- 回滾後需重新確認 env / secret 未被改動。

---

## 4. Deploy Control Checklist

### Merge 前必檢

- [ ] PR #3 仍為 OPEN。
- [ ] Base / Head 仍為 main <- codex/release-prompt-quality-stabilized-20260621。
- [ ] Merge state 仍為 CLEAN。
- [ ] final smoke 仍有效。
- [ ] PR body 仍保留 raw output +180.1% risk disclosure。
- [ ] 已確認 merge into main 會觸發 GitHub Pages deploy workflow。
- [ ] 已確認 owner 接受 merge 可能觸發 deploy。
- [ ] 已確認不包含 deploy workflow 變更。
- [ ] 已確認不包含 env / secret 變更。
- [ ] 已確認不包含 npm audit fix。
- [ ] 已確認不包含 tmp/。
- [ ] 已確認 stash 未動。

### Merge 後必檢

- [ ] main 已更新到預期 commit。
- [ ] `npm test` 通過。
- [ ] `npm run check` 通過。
- [ ] GitHub Pages workflow 狀態確認。
- [ ] Pages build 成功。
- [ ] 正式頁可載入。
- [ ] 生成流程可用。
- [ ] 學生版無內部欄位外洩。

### Deploy 後觀測

- [ ] 生成成功率。
- [ ] validation failure。
- [ ] JSON parse failure。
- [ ] latency。
- [ ] timeout。
- [ ] raw output / token cost。
- [ ] 使用者等待回報。
- [ ] 是否需要啟動 rollback。

---

## 5. Env / Secret 確認清單

- [ ] 本 PR 不應修改 Worker / Pages env。
- [ ] 本 PR 不應新增 API key。
- [ ] 本 PR 不應提交 `.env`。
- [ ] 本 PR 不應提交 token / header / secret。
- [ ] 部署前需確認 GitHub / Cloudflare / Pages secret 未被更動。
- [ ] 部署前需確認 repo changed files 未包含 secret 類資訊。
- [ ] 部署後若發現 secret 外洩疑慮，立即停止 deploy 並啟動 secret rotation。

---

## 6. Owner 決策欄位

Owner release risk decision:

- [ ] 我接受 raw output +180.1% 作為 cost / observability risk disclosure。
- [ ] 我理解 merge into main 會觸發 GitHub Pages deploy workflow。
- [ ] release note 已完成並可接受。
- [ ] rollback plan 已完成並可執行。
- [ ] env / secret 未變更確認完成。
- [ ] 我接受本次 release 暫不包含同步生成進度 UI MVP。
- [ ] 我同意進入 merge decision。
- [ ] 我同意 deploy 需另行確認，不因 merge 自動視為 deploy approval。

Owner：

Date：

Notes：

---

## 7. 建議結論

- 若 owner 未勾選上述項目：PR #3 維持 OPEN / Ready for review，不 merge、不 deploy。
- 若 owner 勾選並接受 release risk：可進入 merge decision checklist。
- 即使 owner 接受 merge，也不代表自動 deploy approval。
- deploy 仍需 merge 後 main 測試、Pages workflow 確認與 release monitoring。
