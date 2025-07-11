// Google Apps Script Web App URL (只處理產品查詢)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydEGL73QnGDtgpzLrTtGsLEoNBj1g2jfIs_duiE4hON3iHD2xtoD2NTMa--rvDrqNh/exec';

// Google Forms URL (處理訂單提交)
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfNHI38AKIzed7cHfOdc5HHHi57fCKWv7jy-j_5kGRJpGehUQ/viewform';

// 全域變數
let products = [];
let orderItems = [];
let totalAmount = 0;

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    updateCurrentYear();
});

// 初始化頁面
function initializePage() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateSelect').value = today;

    loadProducts();
    setupScrolling();

    // 移除原本的表單提交事件，改用新的訂單處理
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);
}

// 設定滾動功能
function scrollToProducts() {
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function setupScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// 載入產品數據
async function loadProducts() {
    const selectedDate = document.getElementById('dateSelect').value;
    const productsContainer = document.getElementById('productsContainer');

    try {
        productsContainer.innerHTML = '<div class="loading">載入中...</div>';

        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts&date=${selectedDate}`);
        const data = await response.json();

        if (data.success) {
            products = data.products || [];
            displayProducts(products);
        } else {
            throw new Error(data.message || '載入產品資料失敗');
        }
    } catch (error) {
        console.error('載入產品時發生錯誤:', error);
        productsContainer.innerHTML = `
            <div class="error-message">
                <h3>載入失敗</h3>
                <p>暫時無法載入產品資料，請稍後再試。</p>
            </div>`;
    }
}

// 顯示產品
function displayProducts(products) {
    const productsContainer = document.getElementById('productsContainer');

    if (products.length === 0) {
        productsContainer.innerHTML = `
            <div class="text-center">
                <h3>今日暫無產品</h3>
                <p>請選擇其他日期或稍後再來看看</p>
            </div>`;
        return;
    }

    let html = '';
    products.forEach(product => {
        const stockClass = getStockClass(product.remaining, product.total);
        const stockText = getStockText(product.remaining, product.total);
        const isAvailable = product.remaining > 0;

        html += `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image">🧁</div>
                <div class="product-info">
                    <h3 class="product-name">${escapeHtml(product.name)}</h3>
                    <p class="product-description">${escapeHtml(product.description)}</p>
                    <p class="product-price">NT$ ${product.price}</p>
                    <p class="product-stock ${stockClass}">${stockText}</p>
                    <button class="add-to-order-btn"
                            onclick="addToOrder('${product.id}')"
                            ${!isAvailable ? 'disabled' : ''}>
                        ${isAvailable ? '加入訂單' : '已售完'}
                    </button>
                </div>
            </div>`;
    });

    productsContainer.innerHTML = html;
}

// HTML 跳脫防止 XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// 庫存相關函數
function getStockClass(remaining, total) {
    if (remaining === 0) return 'stock-out';
    if (remaining <= total * 0.3) return 'stock-low';
    return 'stock-available';
}

function getStockText(remaining, total) {
    if (remaining === 0) return '已售完';
    if (remaining <= total * 0.3) return `剩餘 ${remaining} 個 (庫存不足)`;
    return `剩餘 ${remaining} 個`;
}

// 訂單相關函數
function addToOrder(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.remaining === 0) {
        alert('此產品已售完');
        return;
    }

    const existingItem = orderItems.find(item => item.productId === productId);

    if (existingItem) {
        if (existingItem.quantity < product.remaining && existingItem.quantity < 10) {
            existingItem.quantity += 1;
        } else {
            alert('數量已達上限');
            return;
        }
    } else {
        orderItems.push({
            productId: productId,
            name: product.name,
            price: product.price,
            quantity: 1,
            maxQuantity: Math.min(product.remaining, 10)
        });
    }

    updateOrderDisplay();
    updateTotalAmount();
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
}

function updateOrderDisplay() {
    const orderItemsContainer = document.getElementById('orderItems');

    if (orderItems.length === 0) {
        orderItemsContainer.innerHTML = '<p class="text-center">尚未選擇任何產品</p>';
        return;
    }

    let html = '';
    orderItems.forEach(item => {
        html += `
            <div class="order-item" data-product-id="${item.productId}">
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-price">NT$ ${item.price}</div>
                </div>
                <div class="quantity-controls">
                    <button type="button" class="quantity-btn" onclick="updateQuantity('${item.productId}', -1)">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button type="button" class="quantity-btn" onclick="updateQuantity('${item.productId}', 1)">+</button>
                    <button type="button" class="remove-item" onclick="removeFromOrder('${item.productId}')">移除</button>
                </div>
            </div>`;
    });

    orderItemsContainer.innerHTML = html;
}

function updateQuantity(productId, change) {
    const item = orderItems.find(item => item.productId === productId);
    if (!item) return;

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
        removeFromOrder(productId);
        return;
    }

    if (newQuantity > item.maxQuantity) {
        alert('數量已達上限');
        return;
    }

    item.quantity = newQuantity;
    updateOrderDisplay();
    updateTotalAmount();
}

function removeFromOrder(productId) {
    orderItems = orderItems.filter(item => item.productId !== productId);
    updateOrderDisplay();
    updateTotalAmount();
}

function updateTotalAmount() {
    totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('totalAmount').textContent = totalAmount;
}

// 處理訂單提交 - 重導向到 Google Forms
function handleOrderSubmit(e) {
    e.preventDefault();

    // 基本驗證
    if (orderItems.length === 0) {
        alert('請至少選擇一個產品');
        return;
    }

    if (orderItems.length > 10) {
        alert('單次訂單最多10項產品');
        return;
    }

    if (totalAmount > 20000) {
        alert('單次訂單金額不能超過20,000元');
        return;
    }

    // 收集表單資料
    const formData = new FormData(e.target);
    const customerName = formData.get('customerName').trim();
    const customerPhone = formData.get('customerPhone').trim();
    const customerEmail = formData.get('customerEmail').trim();
    const pickupDate = formData.get('pickupDate');
    const pickupTime = formData.get('pickupTime');
    const specialRequests = formData.get('specialRequests').trim();

    // 基本驗證
    if (!customerName) {
        alert('請輸入姓名');
        return;
    }

    if (!customerPhone) {
        alert('請輸入電話號碼');
        return;
    }

    if (!pickupDate) {
        alert('請選擇取貨日期');
        return;
    }

    if (!pickupTime) {
        alert('請選擇取貨時間');
        return;
    }

    // 生成訂單摘要
    const orderSummary = generateOrderSummary();

    // 重導向到 Google Forms 並預填資料
    redirectToGoogleForm({
        customerName,
        customerPhone,
        customerEmail,
        pickupDate,
        pickupTime,
        specialRequests,
        orderSummary,
        totalAmount
    });
}

// 生成訂單摘要
function generateOrderSummary() {
    let summary = '訂單內容：\n';
    orderItems.forEach(item => {
        summary += `• ${item.name} x ${item.quantity} = NT$ ${item.price * item.quantity}\n`;
    });
    summary += `\n總金額：NT$ ${totalAmount}`;
    return summary;
}

// 重導向到 Google Forms
function redirectToGoogleForm(orderData) {
    // 建立 Google Forms URL with 預填參數
    // 注意：這些參數名稱需要對應到您 Google Forms 中的實際欄位 ID
    const params = new URLSearchParams({
        // 基本資料 (請替換為您的實際欄位 ID)
        'entry.1520392480': orderData.customerName,      // 姓名欄位
        'entry.1520001722': orderData.customerPhone,     // 電話欄位
        'entry.1546092137': orderData.customerEmail,     // Email欄位
        'entry.1047149694': orderData.pickupDate,        // 取貨日期欄位
        'entry.82924036': orderData.pickupTime,        // 取貨時間欄位
        'entry.1969932251': orderData.orderSummary,      // 訂單內容欄位
        'entry.247157095': orderData.totalAmount,       // 總金額欄位
        'entry.65985849': orderData.specialRequests    // 特殊需求欄位
    });

    const formUrl = `${GOOGLE_FORM_URL}?${params.toString()}`;

    // 顯示確認訊息
    const confirmed = confirm(
        `即將前往訂單確認頁面\n\n` +
        `訂單摘要：\n${orderData.orderSummary}\n\n` +
        `請確認資料無誤後按「確定」繼續`
    );

    if (confirmed) {
        // 在新視窗開啟 Google Forms
        window.open(formUrl, '_blank');

        // 顯示後續說明
        showFormSubmissionInstructions();
    }
}

// 顯示表單提交說明
function showFormSubmissionInstructions() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message';
    messageDiv.innerHTML = `
        <h3>✅ 訂單資料已準備完成</h3>
        <p><strong>接下來請：</strong></p>
        <ol style="text-align: left; margin-left: 20px;">
            <li>在新開啟的視窗中確認訂單資料</li>
            <li>完成人機驗證 (如果需要)</li>
            <li>點擊「提交」按鈕</li>
            <li>我們會盡快與您聯繫確認訂單</li>
        </ol>
        <p style="margin-top: 15px;">
            <small>💡 提示：您可以關閉此頁面，訂單資料已安全傳送到確認表單中</small>
        </p>
    `;

    const form = document.querySelector('.order-form-container');
    form.insertBefore(messageDiv, form.firstChild);

    // 清空當前訂單 (因為已經轉到 Google Forms)
    setTimeout(() => {
        orderItems = [];
        updateOrderDisplay();
        updateTotalAmount();
        document.getElementById('orderForm').reset();
    }, 2000);

    // 5秒後移除訊息
    setTimeout(() => messageDiv.remove(), 10000);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
}

// 載入可用日期 (額外功能)
async function loadAvailableDates() {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailableDates`);
        const data = await response.json();

        if (data.success && data.data) {
            const dateSelect = document.getElementById('dateSelect');
            const pickupDateSelect = document.getElementById('pickupDate');

            // 更新日期選項 (可選功能)
            data.data.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = formatDisplayDate(date);
                // 可以加到 select 中，但現在先保持簡單
            });
        }
    } catch (error) {
        console.error('載入可用日期失敗:', error);
    }
}

// 格式化顯示日期
function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
}

// 更新footer年份
function updateCurrentYear() {
    const currentYear = new Date().getFullYear();
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = currentYear;
    }
}