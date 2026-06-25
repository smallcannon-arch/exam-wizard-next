# exam-wizard-next 10I-C 混合題型後端驗證進度快照

## 一句話現況

exam-wizard-next 已完成 50 題選擇題 production 穩定化與 partial result 容錯上線；混合題型的後端 contract、typed gate 與 44 題 regression 已通過，但前端仍維持 stopgap，只開放標準四選一選擇題。下一階段重點為 10I-D 前端題型分流與 10I-E 正式解鎖混合題型。

## 已完成

- 50 題長生成已改成 async job + batch progress。
- Worker 已補 safe diagnostics、qualityMeta gate、retry/backoff、upstream status、contract violation diagnostics。
- partial result 架構已上線：
  - 後端不再 all-or-nothing。
  - 前端可顯示 completed / partial / failed。
  - 有缺題時正式輸出會被擋住。
- production UI 目前仍以 stopgap 鎖定「標準四選一選擇題」。
- 10I-A prompt contract 已完成：
  - 移除全域 A/B/C/D answer 矛盾。
  - 改為依題型定義 answer 與 options。
- 10I-B Worker typed gate 已完成並部署：
  - gate 以藍圖 requested slot 的 questionType 為權威。
  - 不信任模型自報 questionType。
- 10I-C 後端觀察已通過：
  - 是非題 4/4 pass。
  - 填充題 4/4 pass。
  - 學力檢測題 4/4 pass。
  - 44 題 mixed regression：44/44 completed。
  - 題型分布正確：20 選擇、10 是非、10 填充、4 學力檢測。
  - qualityMeta：44/44 present。
  - contract violation：none。
  - leakage：none。

## production 現狀

- Worker 已部署 typed gate。
- Worker version：4550f58a-c512-4db7-81cd-8bc6e9793b53。
- /health 正常。
- Pages 仍維持 stopgap UI，只讓老師選擇「選擇題」。
- 模型：gemini-3.5-flash。
- Git：main...origin/main 同步乾淨。

## 目前真正可對外使用的範圍

可正式使用：

- 標準四選一選擇題。
- 50 題生成。
- async progress。
- partial fallback。

尚未對老師開放：

- 是非題。
- 填充題。
- 學力檢測題／情境題組。
- 混合題型。

後端已證明混合題型可以生成並通過 typed gate；目前卡點已轉移到前端呈現、validation、匯出邏輯。

## 與前一份進度報告的差異

- 原本 10I-B 仍為 Draft / 未 deploy，現在 typed gate 已部署。
- 原本 10I-C 是下一步，現在已通過後端 regression。
- 原本 44 題 mixed regression 失敗並卡在 20/44，現在已 44/44 completed。
- 原本混合題型失敗原因是選擇題 contract 錯套到非選擇題，現在後端 typed gate 已修復此問題。

## 部署原則更新

10I 系列採「後端可觀察、前端不解鎖」策略。Worker typed gate 可先部署至 production，以便在 UI stopgap 保護下執行 observation / regression；但 Pages 前端維持選擇題限制，直到 10I-D 前端 validation / render / export 完成，且 10I-E 三層對齊驗證通過後，才正式開放混合題型給老師使用。

## 剩餘路線

1. 10I-D：前端按題型分流呈現 / validation / 匯出。
2. 10I-E：三層對齊後解除 stopgap，正式開放混合題型。
3. 觀察第一筆真實 partial production case，確認 UI 實際缺口呈現。
4. 後續再決定 10G targeted regeneration 是否優先。

## 風險與注意事項

- 目前不能對外宣稱「混合題型 production 已可用」。
- 正確說法是：「混合題型後端生成與 typed gate 已通過 regression；production UI 尚未開放，前端呈現與匯出仍待完成。」
- 題型術語需統一：
  - 若後端型別為「學力檢測」，前端或教師語境為「情境題組」，文件中暫用「學力檢測題／情境題組」。
- 10I-D 是下一個高風險點，因為 validation、render、export 三處若未依題型分流，會再次出現選擇題規則錯套到非選擇題的問題。
