# 任務 5C-7：B5 deploy gate 與 raw output 風險決策

日期：2026/6/21  
性質：決策文件，只做 deploy gate 重新判讀，不改功能程式、不改 prompt、不重跑生成。

## 1. 背景

目前 B5 狀態如下：

| 指標 | B5 結果 | 判定 |
| -- | --: | -- |
| 整卷成功率 | 12/12 | 通過 |
| 國語 / 數學 | 6/6、6/6 | 通過 |
| JSON parse failure | 0 | 通過 |
| validation failure | 0 | 通過 |
| qualityMeta failure | 0 | 通過 |
| answer contract failure | 0 | 通過 |
| distractorDesign key failure | 0 | 通過 |
| student leakage | 0 | 通過 |
| totalDuration | 80.6s，main 82.5s | B5 快 2.3% |
| overBudgetItemCount | 0 | 通過 |
| QUALITY_META_OVER_BUDGET | 0 | 通過 |
| SINGLE_DISTRACTOR_OVER_BUDGET | 0 | 通過 |
| raw output 相對 main | +180.1% | 仍需決策 |

B5 已通過結構、等待時間與 budget warning 的主要檢核，但 raw output 相對 main 仍高出 180.1%。這表示目前剩下的問題已不是單一題位輸出失控，而是 qualityMeta 架構本身帶來的輸出成本與可觀測性風險。

## 2. 原本 deploy gate 問題

原本 deploy gate 的判斷邏輯：

- structure gate 必須通過。
- duration 相對 main 不應高於 30%。
- raw output 相對 main 若高於 100%，列為 deploy blocker。
- budget warning 不應持續存在。

目前出現的新情況：

- B5 duration 已不慢於 main。
- budget warnings 已歸零。
- structure gate 全綠。
- 但 raw output 仍高於 main 180.1%。

也就是說，原本 raw output gate 的保守判斷仍會阻擋 deploy，但其他實際執行風險指標已經收斂。若繼續把 raw output +100% 當作唯一 hard blocker，可能會讓 qualityMeta 這類品質提升架構永遠無法進入後續 PR readiness 或受控實測。

## 3. Raw Output +180.1% 的性質判讀

raw output 增加主要可能來自 qualityMeta 架構本身，而不是單一欄位失控。5C-4 與 5C-5 已針對數學題的 qualityMeta / distractorDesign 做 targeted compact；5C-6 顯示 budget warnings 全數歸零，但 raw output 相對 main 仍約 +180.1%，代表固定欄位與整體 JSON 結構成本仍在。

qualityMeta 是 PR #1 品質提升的核心成果，不宜直接移除。它承載誘答迷思、正答理由、教師審題資訊與 selfCheck，這些是新版命題品質與後續診斷價值的主要來源。

raw output 增加不等於使用者等待時間一定增加。本輪 B5 totalDuration 為 80.6s，main 為 82.5s，B5 反而快 2.3%。因此 raw output 不應單獨被視為 latency 失敗。

但 raw output 增加仍代表風險：

- token cost 可能增加。
- 儲存與日誌資料量可能增加。
- debug / observability 資料處理成本可能增加。
- 未來題數擴大或題組長文變多時，輸出量風險可能放大。

因此 raw output 較合理的定位，是 cost / observability risk 指標，而不是在 structure、duration、budget warning 全綠時仍單獨硬擋 deploy 的唯一 blocker。

## 4. Gate 重新定義建議

### Structure gate

以下全部必須通過：

- 成功率 100%。
- JSON parse failure 0。
- validation failure 0。
- qualityMeta failure 0。
- answer contract failure 0。
- distractorDesign key failure 0。
- student leakage 0。

### Duration gate

建議：

- 標準整卷 totalDuration 相對 main 不高於 +30%。
- 若高於 +30%，列為 deploy blocker。
- 若不高於 +30%，可通過。

### Budget warning gate

建議：

- overBudgetItemCount = 0。
- QUALITY_META_OVER_BUDGET = 0。
- SINGLE_DISTRACTOR_OVER_BUDGET = 0。
- 若持續出現 warning，列為修正項。

### Raw output / cost risk gate

#### 方案 A：維持 hard blocker

- raw output 相對 main 高於 +100% 即阻擋 deploy。
- 優點：最保守，可避免 token cost 或資料量在未充分觀測前放大。
- 缺點：可能讓 qualityMeta 架構永遠無法進入實測；即使 structure、duration、budget warning 全通過，仍因架構性欄位成本被阻擋。

#### 方案 B：改為 risk disclosure gate

- 若 structure / duration / budget warning 全通過，raw output 高於 +100% 不直接阻擋 deploy。
- 但需在 PR / release note 中明確揭露：
  - raw output 增幅。
  - 成本風險。
  - 後續監測方式。
  - 若實際使用成本過高，需啟動 tiered qualityMeta / debug mode。

建議採用方案 B。理由是 B5 已通過目前最直接影響使用者體驗與資料正確性的 gate；raw output 增幅屬 qualityMeta 架構成本，應轉為 release risk / cost risk disclosure，並用後續監測與降級方案控管，而不是作為唯一 hard blocker。

## 5. 建議決策

建議目前將 B5 標記為「PR readiness candidate」，但仍不直接 deploy。

具體決策：

- B5 可進入 PR 整理與 final review。
- raw output +180.1% 改列為 release risk / cost risk disclosure。
- 不再把 raw output +100% 作為唯一 hard blocker。
- 仍需在 PR 說明中明確揭露 qualityMeta 帶來的輸出成本。
- 若未來實測顯示 token 成本或 latency 惡化，需啟動：
  - qualityMeta tiered detail。
  - teacher-review mode。
  - debug mode。
  - 或進一步壓縮 distractorDesign / correctReason。

此決策不是直接放行 deploy，而是把判斷從「單一 raw output 比例硬擋」改為「多 gate 通過後的成本風險揭露與受控審查」。

## 6. 後續任務建議

1. 5C-8：PR readiness 風險摘要與 merge 條件清單。
2. 5B-impl：同步生成進度 UI MVP。
3. 5D：分批生成 POC，可延後，因 B5 duration 已通過。
4. 5E：非同步 job queue 技術評估，暫不優先。

目前不建議立即進分批生成或非同步架構，原因：

- B5 duration 已不慢於 main。
- 當前更需要的是 PR 風險整理與成本揭露。
- 分批 / 非同步會大幅擴大架構變更面。
- 若現在急著導入分批或 job queue，會把 prompt 品質批與生成流程架構批混在一起，增加 review 和回歸成本。

## 7. 決策結論

- B5 通過 structure gate。
- B5 通過 duration gate。
- B5 通過 budget warning gate。
- raw output 相對 main 仍增加 180.1%，仍是風險。
- B5 可進 PR readiness。
- B5 不建議未經 release risk review 直接 deploy。

結論：

> B5 通過 structure gate、duration gate 與 budget warning gate；raw output 相對 main 仍增加 180.1%，應列為 cost / observability risk disclosure，而非單一 hard deploy blocker。B5 可進入 PR readiness 與 final review，但不建議未經 release risk review 直接 deploy。
