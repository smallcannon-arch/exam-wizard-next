# PR #1 / PR #2 Release Train 與 Main Deploy Control 決策

- 日期：2026/6/21
- 性質：release train 與 deploy control 決策文件；不改功能程式、不改 prompt、不重跑生成、不 merge、不 deploy。
- 範圍：PR #1 `codex/prompt-quality-enhancement-20260620` 與 PR #2 `codex/generation-stabilization-20260621`。

## 1. 背景

- PR #1 是「命題提示詞品質增強批」，base 為 `main`，head 為 `codex/prompt-quality-enhancement-20260620`。
- PR #1 品質驗收通過，但新版生成時間增加 90.3%，效能風險明顯，因此不建議單獨 merge / deploy。
- PR #2 是「生成流程穩定化 / prompt output budget hardening 批」，base 為 `codex/prompt-quality-enhancement-20260620`，head 為 `codex/generation-stabilization-20260621`。
- PR #2 疊在 PR #1 上，修正 PR #1 後續發現的效能、結構與 validation contract 風險。
- PR #2 已修正 P1 / P2 reviewer findings，且 B5 通過 structure gate、duration gate、budget warning gate 與 leakage gate。
- B5 raw output 相對 main 仍增加 180.1%，目前列為 cost / observability risk disclosure，而不是唯一 hard blocker。
- `.github/workflows/deploy-pages.yml` 監聽 push 到 `main`；任何 merge 進 `main` 都可能觸發 GitHub Pages deploy。

## 2. 核心風險

若先 merge PR #1 into `main`，GitHub Pages workflow 可能立即因 main push 觸發部署。這會讓 PR #1 的 +90.3% 生成時間風險單獨進入部署流程。

即使隨後立刻 merge PR #2，中間狀態仍可能已被部署，或至少進入 deploy pipeline。因此「PR #1 -> PR #2」不能在未控管 main deploy 的情況下直接操作。

核心判斷：

- PR #1 不應被視為可單獨上線的版本。
- PR #2 不能直接 merge 到 main，因為它是 stacked PR，且 base 是 PR #1 branch。
- PR #1 / PR #2 應視為同一組 release train 進行 release review。
- deploy control 必須先於 main merge 決策。

## 3. 策略選項比較

### A. 先 merge PR #1，再 merge PR #2

優點：

- 保留目前 stacked PR 的自然順序。
- GitHub PR 歷史與 review 脈絡清楚。
- 不需要重建整合 PR。

風險：

- PR #1 merge 進 main 後，可能立即觸發 GitHub Pages deploy。
- PR #1 的 +90.3% 效能風險會單獨進入 main / deploy pipeline。
- 即使很快 merge PR #2，中間狀態仍可能已部署。
- 對 release owner 來說，main 可能短暫存在「品質通過但效能未穩定化」的版本。

是否推薦：

- 不建議，除非已停用、暫停或明確控管 main deploy。

### B. PR #1 + PR #2 作為 release train，先停住不 merge

優點：

- 最保守安全，不會觸發 main deploy。
- 保留 PR #1 / PR #2 的 stacked review 脈絡。
- 不讓 PR #1 的效能風險單獨進入 main。
- 有時間讓 release owner 決定 deploy control 方案。

風險：

- release 推進暫停，功能與修正仍停留在 Draft PR。
- reviewer 需要接受 stacked PR 的閱讀方式。
- 若拖太久，後續可能需要 rebase / refresh checks。

是否推薦：

- 目前最推薦。PR #1 / PR #2 維持 Draft，等待 release owner 決定 deploy control 方式。

### C. 建立整合 PR 對 main

說明：

- 從 `codex/generation-stabilization-20260621` 的最終狀態建立或轉換成一個對 `main` 的整合 PR。
- 整合 PR 會包含 PR #1 + PR #2 的最終結果。
- 目標是避免 PR #1 單獨進 main，讓 main 只接收「品質增強 + 穩定化」後的完整版本。

優點：

- 避免 PR #1 單獨進 main。
- 對 main reviewer 來說，最終狀態明確。
- release decision 可直接針對整合後狀態進行。

風險：

- diff 較大，review 負擔上升。
- PR #1 / PR #2 的脈絡需要重新整理到整合 PR body。
- 可能需要重新跑 final smoke / release risk review。
- 若直接關閉原 stacked PR，會喪失部分 review breadcrumb；若不關閉，則會有多 PR 並存管理成本。

是否適合作為後續 release 推進方案：

- 適合在「不希望 PR #1 曾經單獨進 main」的情境下採用。
- 若 main deploy 無法可靠暫停或控管，整合 PR 是較乾淨的 release 推進方案。

### D. 停用 / 控管 Pages deploy 後，再依 PR #1 -> PR #2 順序 merge

需要確認：

- 誰有權限停用或控管 GitHub Pages deploy。
- 停用 workflow 是否會影響其他部署或同事工作。
- 停用後如何恢復。
- 是否採用暫停 workflow、保護 main、手動 workflow_dispatch、或 release window 內快速連續 merge。
- 是否需要專案 owner 明確決策與紀錄。

優點：

- 保留 stacked PR 的原始 merge 順序。
- 可避免 PR #1 merge 後立刻被部署。
- PR #2 可緊接著補上穩定化修正。

風險：

- 需要 owner / maintainer 權限與明確操作紀錄。
- deploy control 操作本身有風險，可能影響正常 Pages 發布。
- 若控管不完整，仍可能發生 PR #1 中間狀態被部署。

是否推薦：

- 可作為 release 推進方案，但前提是 owner 明確接受並能控管 main deploy。

## 4. 建議決策

目前建議先採策略 B：

- PR #1 維持 Draft。
- PR #2 維持 Draft。
- 不 merge。
- 不 deploy。
- 等 release owner 決定 deploy control 方式。

若要推進 release，建議二選一：

1. 建立整合 PR 對 main，讓 main 只接收 PR #1 + PR #2 的最終狀態。
2. 或先明確停用 / 控管 main Pages deploy，再按 release train 順序 merge PR #1 -> PR #2。

明確不建議：

- 不建議在未控管 main deploy 前 merge PR #1。
- 不建議把 PR #2 直接 merge 到 main。
- 不建議現在 deploy。
- 不建議把 npm audit、tmp/、stash、repo 外 raw output 或非同步 job queue 混入此 release train。

## 5. Release 推進前必要條件

- release owner 接受 PR #1 + PR #2 作為同一 release train。
- raw output +180.1% 被接受為 cost / observability risk disclosure。
- PR #1 的 +90.3% 生成時間歷史風險已被理解，且以 PR #2 B5 duration gate 作為穩定化依據。
- main deploy control 方案明確。
- 決定是否建立整合 PR 對 main。
- 若維持 stacked merge，需明確控管 PR #1 merge 後到 PR #2 merge 前的中間狀態。
- final smoke 需在 merge 前重跑。
- main merge 後需測試。
- deploy 前需 release note。
- deploy 前需 rollback plan。
- deploy 前需確認 Worker / Pages env 與 secret 未變更。
- 既存 `tmp/` 不得 stage / commit / 刪除。
- `stash@{0}` 不得動。
- npm audit vulnerability 不在本 release train 內處理。

## 6. 下一步建議

1. 保持 PR #1 / PR #2 Draft。
2. 不 merge、不 deploy。
3. 請 owner 決定：
   - 是否建立整合 PR 對 main。
   - 或是否能暫停 / 控管 Pages deploy。
4. 決策後再進 merge 操作設計。
5. 若暫不 release，PR #2 維持 Draft review-ready。

## 7. 當前固定結論

PR #1 / PR #2 應視為同一組 stacked release train。PR #1 不應單獨 deploy；PR #2 不應直接 merge main。由於 main push 會觸發 GitHub Pages deploy，目前最安全狀態是兩個 PR 都維持 Draft，等 release owner 決定 main deploy control 方式後，再選擇整合 PR 或受控 stacked merge。
