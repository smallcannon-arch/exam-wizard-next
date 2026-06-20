# few-shot 候選範例庫 v0.1

日期：2026-06-20

狀態：候選庫，尚未進入正式提示詞。所有題目皆需經 Smallcannon 准入審核後，才可改為 `prompt_ready`。

## 使用原則

- 本庫用於建立 few-shot 題感種子，重點是「標註品質判準」，不是累積大量題目。
- 題目以公開學力檢測 / TASA 題感與試題分析為參考來源，但不直接照抄原題。
- 所有候選題目前皆為 `candidate`，`promptUseStatus` 皆為 `not_ready_until_teacher_review`。
- 每題的核心價值在於：題幹聚焦、正答唯一、錯誤選項具誘答性、解析能說明學生錯在哪。

## 參考來源

- 縣市學生學習能力檢測試題公告：https://saaassessment.ntcu.edu.tw/ExamRelease
- DSA 國家教育研究院學生學習成就資料：https://tasal.naer.edu.tw/dsa/dsa
- TASA 國小 / 國中國語文公開範例試題與試題品質分析：https://tasal.naer.edu.tw/dsa1/files/tasa/%E7%AF%84%E4%BE%8B%E8%A9%A6%E9%A1%8C%E5%9C%8B%E5%B0%8F%E5%9C%8B%E4%B8%AD%E5%9C%8B%E8%AA%9E%E6%96%87-571816568.pdf
- TASA 國小 / 國中數學公開範例試題與試題品質分析：https://tasal.naer.edu.tw/dsa1/files/tasa/%E7%AF%84%E4%BE%8B%E8%A9%A6%E9%A1%8C%E5%9C%8B%E5%B0%8F%E5%9C%8B%E4%B8%AD%E6%95%B8%E5%AD%B8-51071835%20TASA%20%E5%9C%8B%E5%B0%8F%E5%9C%8B%E4%B8%AD%E6%95%B8%E5%AD%B8-%E5%9C%8B%E5%B0%8F%E5%9C%8B%E4%B8%AD%E6%AE%B5%E6%AD%A3%E5%BC%8F%E6%96%BD%E6%B8%AC%E6%95%B8%E5%AD%B8%E7%A7%91%E5%85%AC%E9%96%8B%E8%A9%A6%E9%A1%8C%28%E4%BF%AE%E6%A8%99%E9%A1%8C%E6%AA%94%29.pdf

## 狀態定義

| 狀態 | 意義 |
|---|---|
| `candidate` | AI 先行整理出的候選題，尚未進提示詞 |
| `teacher_reviewed` | 教師審核通過，可作為標竿題 |
| `rewrite_needed` | 題感可用，但需再改寫 |
| `rejected` | 不適合當 few-shot 標竿題 |
| `prompt_ready` | 可正式放入提示詞末段 |

## 候選題摘要

| exampleId | 科目 | 年級 | 題型 | 認知歷程 | 主打迷思 |
|---|---|---|---|---|---|
| G4_CH_READ_001 | 國語文 | 國小四年級 | 閱讀理解單題 | 理解 | main_idea_confusion, partial_reading |
| G4_CH_REFERENT_002 | 國語文 | 國小四年級 | 閱讀理解單題 | 理解 | referent_confusion, keyword_trap |
| G4_CH_SENTENCE_003 | 國語文 | 國小四年級 | 句式語法 | 應用 | stem_neglect, structure_confusion |
| G4_CH_PUNCT_004 | 國語文 | 國小四年級 | 標點符號 | 應用 | structure_confusion, partial_reading |
| G4_MA_AREA_001 | 數學 | 國小四年級 | 面積與周長 | 程序執行 | formula_transfer_error, unit_conversion_error |
| G4_MA_CLOCK_002 | 數學 | 國小四年級 | 旋轉角 | 解題思考 | time_duration_confusion, concept_inversion |
| G4_MA_GEOMETRY_003 | 數學 | 國小四年級 | 幾何概念 | 概念理解 | single_feature_error, category_as_instance_error |
| G4_MA_EQUATION_004 | 數學 | 國小四年級 | 情境列式 | 程序執行 | unknown_position_error, concept_inversion |

---

## 國語文｜四年級｜閱讀理解｜候選題 001

### 基本資料

- exampleId：G4_CH_READ_001
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 國語文公開範例中「文章主旨 / 低分組受局部資訊吸引」的分析方式，重新設計文本與選項。
- 年級：國小四年級
- 科目：國語文
- 單元：閱讀理解
- objectiveId：待對應
- 認知歷程：理解
- 題型：閱讀理解單題
- 難度：中
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

閱讀短文後，回答問題。

放學後，天空突然下起大雨。小安看見同學小哲站在走廊邊，手裡拿著美勞作品，卻沒有帶傘。小安原本想快點回家，因為媽媽提醒他晚餐前要完成作業。可是他想了想，還是走回教室拿出備用雨衣，陪小哲一起走到校門口。回家後，作業雖然晚了一點才開始寫，小安心裡卻覺得很踏實。

這段文字主要想表達什麼？

### 選項

A. 下雨天一定要準備雨具。  
B. 幫助別人有時需要放慢自己的腳步。  
C. 做作業比幫助同學更重要。  
D. 美勞作品遇到雨很容易壞掉。

### 正答

B

### 正答理由

短文核心不在雨具、作業或美勞作品，而在小安願意暫緩自己回家的計畫，主動幫助同學。

### 這題好在哪

1. 題幹只問「主要想表達什麼」，聚焦主旨理解。
2. 正答需要整合人物行動與心理，不是抓單一關鍵詞。
3. 三個誘答分別對應文本中的局部資訊、價值判斷反轉與物件細節。
4. 選項長度與語氣大致平衡，正答不因字數或語氣突出。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | keyword_trap | 看到「大雨」「沒有帶傘」「雨衣」就把雨具當主旨 | 雨具只是情境，不是文章想表達的核心 |
| C | main_idea_confusion | 把媽媽提醒作業的資訊放大 | 文中小安最後仍幫助同學，重點不是作業優先 |
| D | partial_reading | 注意到「美勞作品」這個具體物件 | 美勞作品只是小哲需要幫助的原因之一 |

### 解析示範

B 正確。小安原本想快點回家，但看見同學有困難，仍選擇幫忙，表示幫助別人有時需要放慢自己的腳步。A、D 都只抓到文中的局部物品；C 則和小安的實際行動相反。

---

## 國語文｜四年級｜指稱理解｜候選題 002

### 基本資料

- exampleId：G4_CH_REFERENT_002
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 國語文閱讀題常見的指稱與局部閱讀錯誤，重新設計情境短文。
- 年級：國小四年級
- 科目：國語文
- 單元：閱讀理解
- objectiveId：待對應
- 認知歷程：理解
- 題型：閱讀理解單題
- 難度：中
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

閱讀短文後，回答問題。

社區花圃裡的向日葵長得很高，管理員伯伯請孩子們幫忙澆水。小芸提著水壺，小達拿著鏟子，把倒下的木牌扶正。伯伯笑著說：「有你們照顧，這裡會越來越漂亮。」孩子們聽了，都露出得意的笑容。

句子中的「這裡」指的是哪裡？

### 選項

A. 小芸的家  
B. 社區花圃  
C. 管理員室  
D. 孩子們的教室

### 正答

B

### 正答理由

前文一直描述孩子們在社區花圃照顧向日葵，因此「這裡」指社區花圃。

### 這題好在哪

1. 題幹聚焦「指稱詞」理解。
2. 正答必須回到前文情境，不可只憑生活經驗猜。
3. 誘答包含人物所在地的常見誤判，能診斷學生是否追蹤上下文。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | life_experience_override | 看到孩子澆水，聯想到在家照顧植物 | 文本沒有提到小芸的家 |
| C | keyword_trap | 看到「管理員伯伯」就聯想到管理員室 | 伯伯是說話者，不代表地點是管理員室 |
| D | referent_confusion | 學生把「孩子們」和學校教室連在一起 | 文中活動地點是社區花圃 |

### 解析示範

B 正確。判斷「這裡」要回到前面的地點線索，短文一開始就說孩子們在社區花圃照顧向日葵，所以「這裡」指社區花圃。

---

## 國語文｜四年級｜句式語法｜候選題 003

### 基本資料

- exampleId：G4_CH_SENTENCE_003
- 狀態：candidate
- 來源類型：teacher_assessment_pattern_adapted
- 來源說明：參考國語句式語法題常見的轉折關係誘答設計，非原題照抄。
- 年級：國小四年級
- 科目：國語文
- 單元：句式語法
- objectiveId：待對應
- 認知歷程：應用
- 題型：句式選擇題
- 難度：中
- copyrightRisk：low_original_candidate
- promptUseStatus：not_ready_until_teacher_review

### 題目

下列哪一組關聯詞填入句中最恰當？

「這條路□□比較遠，□□沿途有樹蔭，走起來很舒服。」

### 選項

A. 因為……所以  
B. 雖然……但是  
C. 只要……就  
D. 不但……而且

### 正答

B

### 正答理由

前半句「比較遠」是不利條件，後半句「有樹蔭、很舒服」是轉折後的優點，應使用「雖然……但是」。

### 這題好在哪

1. 題幹只考一個語意關係：轉折。
2. 四個選項都是常見關聯詞，不是亂湊。
3. 誘答能分辨學生是否混淆因果、條件、遞進與轉折。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | structure_confusion | 看到兩個分句，就套用熟悉的因果句型 | 後句不是前句造成的結果 |
| C | stem_neglect | 只注意「走起來很舒服」，以為是條件達成 | 句中沒有「條件成立就會發生」的關係 |
| D | structure_confusion | 把兩個描述都當成補充說明 | 前後語意一負一正，應是轉折不是遞進 |

### 解析示範

B 正確。「比較遠」和「走起來很舒服」語意相反，後句轉換前句的不利條件，所以用「雖然……但是」最恰當。

---

## 國語文｜四年級｜標點符號｜候選題 004

### 基本資料

- exampleId：G4_CH_PUNCT_004
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 國語文公開範例中標點符號題的「分句關係」設計，重新改寫句子。
- 年級：國小四年級
- 科目：國語文
- 單元：標點符號
- objectiveId：待對應
- 認知歷程：應用
- 題型：標點符號選擇題
- 難度：中
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

下列哪一個標點符號填入□中最恰當？

「早晨的操場很安靜□只有幾隻麻雀在跑道旁跳來跳去。」

### 選項

A. ，  
B. 。  
C. ？  
D. ！

### 正答

A

### 正答理由

前後分句語意連續，後句補充說明操場安靜時的景象，用逗號最恰當。

### 這題好在哪

1. 題目可用語意關係判斷，不靠死背。
2. 四個標點符號各有常見誤用情境。
3. 誘答能診斷學生是否把語氣、句子完整性與補充關係混在一起。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| B | structure_confusion | 以為看到一個完整意思就要句號 | 後句仍接續補充同一個畫面 |
| C | stem_neglect | 沒注意整句不是疑問語氣 | 句中沒有發問 |
| D | life_experience_override | 覺得麻雀跳來跳去很活潑，就選驚嘆號 | 文句語氣平穩，沒有驚訝或強烈情緒 |

### 解析示範

A 正確。後半句補充早晨操場的景象，和前半句關係緊密，用逗號連接最自然。

---

## 數學｜四年級｜面積與周長｜候選題 001

### 基本資料

- exampleId：G4_MA_AREA_001
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 數學公開範例中「面積 / 周長公式與單位混淆」的分析方式，重新設計數值與情境。
- 年級：國小四年級
- 科目：數學
- 單元：面積與周長
- objectiveId：待對應
- 認知歷程：程序執行
- 題型：選擇題
- 難度：中
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

一塊長方形菜圃長 8 公尺、寬 5 公尺。這塊菜圃的面積是多少？

### 選項

A. 13 公尺  
B. 26 公尺  
C. 40 平方公尺  
D. 40 公尺

### 正答

C

### 正答理由

長方形面積為長 × 寬，8 × 5 = 40，單位是平方公尺。

### 這題好在哪

1. 題目數字簡單，焦點放在面積概念與單位。
2. 誘答分別對應加法、周長公式與單位錯誤。
3. 可診斷學生是公式不熟，還是單位概念不清。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | formula_transfer_error | 直接把長和寬相加 | 面積不是長 + 寬 |
| B | formula_transfer_error | 使用周長公式 2 × (8 + 5) | 題目問面積，不是周長 |
| D | unit_conversion_error | 算出 40 但未使用面積單位 | 面積單位應為平方公尺 |

### 解析示範

C 正確。長方形面積是長乘以寬，8 × 5 = 40，因為是面積，所以單位要寫「平方公尺」。

---

## 數學｜四年級｜旋轉角｜候選題 002

### 基本資料

- exampleId：G4_MA_CLOCK_002
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 數學公開範例中「鐘面大格、小格與旋轉角」的分析方式，重新設計題目。
- 年級：國小四年級
- 科目：數學
- 單元：角度與時間
- objectiveId：待對應
- 認知歷程：解題思考
- 題型：選擇題
- 難度：中偏難
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

鐘面上分針從 12 走到 4，分針共旋轉了幾度？

### 選項

A. 20 度  
B. 40 度  
C. 120 度  
D. 240 度

### 正答

C

### 正答理由

鐘面一圈 360 度，共 12 大格，每大格 30 度。從 12 到 4 是 4 大格，30 × 4 = 120 度。

### 這題好在哪

1. 不只考時間讀法，而是考鐘面與角度的表徵轉換。
2. 誘答對應「把數字當度數」「把小格 / 大格混淆」「方向或補角誤判」。
3. 解題步驟可清楚示範每大格 30 度。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | time_duration_confusion | 把 4 大格誤看成 20 分鐘後直接當 20 度 | 分鐘數不等於角度 |
| B | concept_inversion | 把鐘面數字 4 乘以 10 | 每大格是 30 度，不是 10 度 |
| D | concept_inversion | 算成反方向較大的角 | 題目問分針從 12 到 4 的旋轉量，應為 4 大格 |

### 解析示範

C 正確。鐘面 12 大格合起來是 360 度，所以 1 大格是 30 度；從 12 到 4 共有 4 大格，因此是 120 度。

---

## 數學｜四年級｜幾何概念｜候選題 003

### 基本資料

- exampleId：G4_MA_GEOMETRY_003
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 數學公開範例中「直角、垂直與三角形命名」的分析方式，重新設計題目。
- 年級：國小四年級
- 科目：數學
- 單元：三角形
- objectiveId：待對應
- 認知歷程：概念理解
- 題型：選擇題
- 難度：中
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

一個三角形中，有一個角剛好是 90 度。這個三角形一定可以稱為什麼三角形？

### 選項

A. 銳角三角形  
B. 鈍角三角形  
C. 直角三角形  
D. 正三角形

### 正答

C

### 正答理由

有一個角是 90 度的三角形稱為直角三角形。

### 這題好在哪

1. 題目直接測基本定義，適合當概念理解標竿。
2. 誘答能診斷學生是否只憑形狀名稱猜答案。
3. 選項都是三角形分類名稱，形式平衡。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | category_as_instance_error | 以為三角形只要看起來尖就是銳角 | 有 90 度角時，不是銳角三角形 |
| B | single_feature_error | 不清楚 90 度、鈍角和直角的差別 | 鈍角需大於 90 度 |
| D | category_as_instance_error | 把常見的「規則圖形」名稱當答案 | 正三角形強調三邊等長，題幹沒有此條件 |

### 解析示範

C 正確。判斷三角形名稱要看角的性質；只要有一個角是 90 度，就可以稱為直角三角形。

---

## 數學｜四年級｜情境列式｜候選題 004

### 基本資料

- exampleId：G4_MA_EQUATION_004
- 狀態：candidate
- 來源類型：public_assessment_pattern_adapted
- 來源說明：參考 TASA 數學公開範例中「相同份數情境列式」的分析方式，重新設計商品與數字。
- 年級：國小四年級
- 科目：數學
- 單元：未知數與列式
- objectiveId：待對應
- 認知歷程：程序執行
- 題型：選擇題
- 難度：中
- copyrightRisk：low_adapted_not_copied
- promptUseStatus：not_ready_until_teacher_review

### 題目

一個三明治 45 元，一瓶果汁 30 元。小婷買了相同份數的三明治和果汁，共付 300 元。若用 □ 表示各買的份數，下列哪個算式正確？

### 選項

A. 45 + 30 × □ = 300  
B. (45 + 30) × □ = 300  
C. 45 × 30 + □ = 300  
D. 300 ÷ 45 + 30 = □

### 正答

B

### 正答理由

每一組包含一個三明治和一瓶果汁，共 45 + 30 = 75 元，買 □ 組，所以是 (45 + 30) × □ = 300。

### 這題好在哪

1. 題幹明確定義未知數代表「各買的份數」。
2. 誘答可診斷學生是否知道括號代表一組、是否誤解未知數位置。
3. 數字可心算，降低非目標運算負擔。

### 誘答設計

| 選項 | 迷思標籤 | 學生為何可能選 | 錯在哪 |
|---|---|---|---|
| A | unknown_position_error | 只把 □ 放在果汁後面 | 三明治和果汁都買相同份數，兩者都要乘 □ |
| C | concept_inversion | 把兩個單價相乘 | 商品總價應相加後再乘份數 |
| D | unknown_position_error | 直接用總價除以單一商品價格再加另一價格 | 式子沒有表達「相同份數的一組商品」 |

### 解析示範

B 正確。因為每份包含三明治和果汁各一個，一份是 45 + 30 元，買 □ 份就是 (45 + 30) × □ = 300。
