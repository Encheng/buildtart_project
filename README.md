# 🎯 BuildTart 築塔 STUDIO 設定說明

## 📋 方案概述

**混合架構**：
- **Google Apps Script** ➜ 只負責產品查詢 (低風險)
- **Google Forms** ➜ 處理訂單提交 (官方安全防護)
- **自動庫存管理** ➜ 表單提交觸發器自動更新庫存

### 🔒 安全優勢
- ✅ **官方防護** - Google Forms 內建 spam 防護
- ✅ **零 API Key 風險** - 前端無敏感資訊
- ✅ **資料驗證** - 必填欄位、格式檢查
- ✅ **提交限制** - 防止大量攻擊
- ✅ **免費穩定** - Google 官方維護
- ✅ **自動庫存** - 表單提交後自動扣減庫存

## 🛠️ 設定步驟

### 步驟 1: 更新 Google Apps Script

1. **使用完整程式碼**
   - 將 `google-apps-script.gs` 內容複製到您的 Google Apps Script
   - 更新 `SHEET_ID` 為您的實際 Google Sheets ID

2. **設定自動庫存管理**
   - 執行 `setupFormSubmitTrigger()` 函數設定表單提交觸發器
   - 或手動在 Apps Script 編輯器中設定觸發器：
     - 函數：`onFormSubmit`
     - 事件來源：來自試算表
     - 事件類型：表單提交時

3. **重新部署 Web App**
   - 建立新的部署版本
   - 複製新的 Web App URL

### 步驟 2: 建立 Google Forms

1. **前往 Google Forms**
   - 訪問 [forms.google.com](https://forms.google.com)
   - 點擊「建立新表單」

2. **設定表單基本資訊**
   ```
   標題：BuildTart 築塔 - 線上訂購
   說明：請填寫以下資訊完成訂單，我們會盡快與您聯繫確認。
   ```

3. **建立表單欄位** (按順序建立)

#### 欄位 1: 客戶姓名
- **類型**: 簡答
- **問題**: 客戶姓名 *
- **設定**: 必填、字數限制 1-50 字

#### 欄位 2: 聯絡電話
- **類型**: 簡答
- **問題**: 聯絡電話 *
- **設定**: 必填、正規表達式驗證 `[\d\-\+\(\)\s]{8,15}`

#### 欄位 3: IG 帳號
- **類型**: 簡答
- **問題**: IG 帳號 *
- **設定**: 必填、字數限制 1-50 字

#### 欄位 4: 取貨日期
- **類型**: 日期
- **問題**: 取貨日期 *
- **設定**: 必填

#### 欄位 5: 交易方式
- **類型**: 單選
- **問題**: 交易方式 *
- **選項**: 
  - 新竹-面交 (19:00)
  - 新竹-外送 (20:00~22:00, 無法指定時間)
  - 台中-外送 (14:00~16:00, 無法指定時間)
- **設定**: 必填

#### 欄位 6: 配送地址
- **類型**: 段落
- **問題**: 配送地址 *
- **說明**: 縣市 + 鄉鎮市區 + 詳細地址
- **設定**: 必填

#### 欄位 7: 訂單內容
- **類型**: 段落
- **問題**: 訂單內容 *
- **說明**: 此欄位會自動填入您選購的產品資訊，包含訂購日期
- **設定**: 必填

#### 欄位 8: 總金額
- **類型**: 簡答
- **問題**: 總金額 (NT$) *
- **設定**: 必填、數字驗證

#### 欄位 9: 特殊需求
- **類型**: 段落
- **問題**: 特殊需求或備註
- **設定**: 字數限制 500 字

### 步驟 3: 啟用安全設定

1. **設定提交限制**
   - 在「回應」頁籤中
   - 勾選「限制為 1 次回應」(可選)
   - 勾選「編輯回應」(讓客戶可以修改)

2. **設定確認頁面**
   - 在「簡報」頁籤中
   - 自訂確認訊息：
   ```
   ✅ 訂單提交成功！

   感謝您的訂購，我們已收到您的訂單資訊。
   我們會在 2 小時內與您聯繫確認訂單詳情。

   如有急件需求，請直接致電：[您的電話號碼]

   BuildTart 築塔 敬啟
   ```

### 步驟 4: 取得表單欄位 ID

1. **開啟表單預填連結**
   - 在表單編輯頁面，點擊右上角「⋮」
   - 選擇「取得預填連結」
   - 隨意填入一些測試資料
   - 點擊「取得連結」

2. **複製欄位 ID**
   - 從產生的 URL 中找到類似 `entry.123456789` 的參數
   - 記錄每個欄位對應的 entry ID：

   ```javascript
   // 範例 URL：
   // https://docs.google.com/forms/d/e/1FAIpQLSe.../viewform?entry.123456789=測試姓名&entry.987654321=0912345678...

   const FORM_FIELD_IDS = {
       customerName: 'entry.123456789',        // 客戶姓名
       customerPhone: 'entry.987654321',       // 聯絡電話
       customerInstagram: 'entry.555666777',   // IG 帳號
       pickupDate: 'entry.111222333',          // 取貨日期
       deliveryMethod: 'entry.444555666',      // 交易方式
       customerAddress: 'entry.777888999',     // 配送地址
       orderSummary: 'entry.888999000',        // 訂單內容
       totalAmount: 'entry.222333444',         // 總金額
       specialRequests: 'entry.666777888'      // 特殊需求
   };
   ```

### 步驟 5: 更新前端程式碼

1. **更新 JavaScript 檔案**
   - 將 `hybrid-script.js` 內容複製到您的 `script.js`
   - 更新以下設定：

   ```javascript
   // 更新 Google Apps Script URL
   const GOOGLE_SCRIPT_URL = 'YOUR_ACTUAL_SCRIPT_URL';

   // 更新 Google Forms URL
   const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform';

   // 在 redirectToGoogleForm 函數中更新欄位 ID
   const params = new URLSearchParams({
       'entry.123456789': orderData.customerName,          // 客戶姓名
       'entry.987654321': orderData.customerPhone,         // 聯絡電話
       'entry.555666777': orderData.customerInstagram,     // IG 帳號
       'entry.111222333': orderData.pickupDate,            // 取貨日期
       'entry.444555666': orderData.deliveryMethod,        // 交易方式
       'entry.777888999': orderData.customerAddress,       // 配送地址
       'entry.888999000': orderData.orderSummary,          // 訂單內容
       'entry.222333444': orderData.totalAmount,           // 總金額
       'entry.666777888': orderData.specialRequests        // 特殊需求
   });
   ```

2. **添加網站圖標**
   - 將 `favicon.ico` 和 `threads.png` 放置在網站根目錄
   - 確保 HTML 中已包含 favicon 引用：
   ```html
   <link rel="icon" type="image/x-icon" href="favicon.ico">
   ```

### 步驟 6: 設定 Google Sheets 接收訂單

1. **連結回應到 Sheets**
   - 在 Google Forms 中，點擊「回應」頁籤
   - 點擊綠色的「建立試算表」圖示
   - 選擇「建立新試算表」
   - 命名為「BuildTart 訂單記錄」

2. **自訂欄位標題** (可選)
   - 在生成的 Google Sheets 中
   - 可以重新命名欄位標題使其更易讀

## 🧪 測試流程

### 測試 1: 產品查詢功能
1. 開啟您的網站
2. 選擇不同日期
3. 確認產品資料正確載入

### 測試 2: 訂單流程
1. 選擇一些產品加入訂單
2. 填寫客戶資訊
3. 點擊「提交訂單」
4. 確認正確跳轉到 Google Forms
5. 檢查資料是否正確預填
6. 完成表單提交
7. 確認資料出現在 Google Sheets 中

### 測試 3: 安全性測試
1. 嘗試快速重複提交 (應該被限制)
2. 提交無效資料格式 (應該顯示錯誤)


## 🚀 進階功能

### 自動通知設定
1. **Email 通知**
   - 在 Google Forms 設定中啟用「新回應時傳送電子郵件通知」
   - 每當有新訂單時您會收到 Email

### 客製化確認頁面
1. **自訂 CSS**
   - 在 Google Forms 中選擇主題

2. **重導向功能**
   - 可以設定提交後跳轉到您的感謝頁面

## 🔧 常見問題

### Q: Google Forms 可以客製化外觀嗎？
**A**: 可以選擇主題色彩和上傳 Logo，但樣式客製化有限。

### Q: 如果客戶不小心重複提交怎麼辦？
**A**: 可以在 Google Forms 設定中啟用「限制為 1 次回應」，但建議不要啟用以免影響正常客戶。

### Q: 可以自動扣除庫存嗎？
**A**: 是的！系統會在顧客提交 Google Forms 後自動扣除庫存。確保已設定表單提交觸發器。

### Q: 訂單資料的安全性如何？
**A**: Google Forms 的安全性由 Google 負責，符合國際安全標準，比自製系統更安全。

## 🎨 網站功能

### 視覺設計
- 🎯 **品牌識別** - Logo 和品牌色彩設計
- 📱 **響應式設計** - 支援手機和桌機瀏覽
- 🌟 **載入動畫** - 精美的蛋糕製作動畫
- 🗺️ **地址選擇** - 台灣縣市鄉鎮區選擇器

### 社群媒體
- 📸 **Instagram** - 連結到 @buildtart.studio
- 🧵 **Threads** - 連結到 @buildtart.studio
- 🔗 **Footer 位置** - 簡約白色線條圖標

### 交易功能
- 📅 **智慧交易選項** - 根據選擇日期自動切換：
  - 週一～週五：新竹面交、外送
  - 週六～週日：台中外送
- 🕒 **時區修正** - 正確顯示今日日期
- 💫 **載入狀態** - 美觀的產品載入動畫

### 庫存管理
- 📊 **即時庫存** - 顯示剩餘數量和庫存狀態
- 🔄 **自動扣庫存** - 表單提交後自動更新
- 📈 **庫存警示** - 庫存不足時顯示警告

## 📞 技術支援

如果在設定過程中遇到問題：

1. **檢查步驟**：確認每個步驟都正確完成
2. **測試連結**：確認所有 URL 都正確無誤
3. **權限設定**：確認 Google Apps Script 和 Google Forms 的權限正確
4. **瀏覽器測試**：嘗試不同瀏覽器測試
5. **觸發器檢查**：確認表單提交觸發器已正確設定

**最後提醒**：記得定期備份您的 Google Sheets 資料，並且妥善保管各種 URL 和設定資訊。

## 📁 檔案結構

```
buildtart.com.tw/
├── index.html              # 主要網頁
├── styles.css              # 樣式表
├── hybrid-script.js        # 前端 JavaScript
├── google-apps-script.gs   # 後端 Google Apps Script
├── favicon.ico            # 網站圖標
├── threads.png            # Threads 社群媒體圖標
├── logo.jpg               # 品牌 Logo
└── README.md              # 設定說明文件
```