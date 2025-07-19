// Google Apps Script Web App URL (只處理產品查詢)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxKkyJZYn2d1nnP01LC5xDrxPNsazUz8FNRLi4LuYV7LOWT8NH34xLx4zhhbVyCPw8J/exec';

// Google Forms URL (處理訂單提交)
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfNHI38AKIzed7cHfOdc5HHHi57fCKWv7jy-j_5kGRJpGehUQ/viewform';

// 全域變數
let products = [];
let orderItems = [];
let totalAmount = 0;
let taiwanAddressData = null;

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    updateCurrentYear();
    loadTaiwanAddressData();
});

// 初始化頁面
function initializePage() {
    // 修正時區問題，使用本地時間
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    document.getElementById('dateSelect').value = todayString;

    loadProducts();
    loadAvailableDates();
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
        productsContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-animation">
                    <div class="cake-loader">
                        <div class="cake-layer layer-1"></div>
                        <div class="cake-layer layer-2"></div>
                        <div class="cake-layer layer-3"></div>
                        <div class="cake-topping">🍓</div>
                    </div>
                    <div class="loading-text">正在準備美味甜點...</div>
                    <div class="loading-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
        `;

        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts&date=${selectedDate}`);
        const data = await response.json();

        if (data.success) {
            products = data.products || [];
            displayProducts(products);
        } else {
            throw new Error(data.message || '載入產品資料失敗');
        }
    } catch (error) {
        console.error('載入商品時發生錯誤:', error);
        productsContainer.innerHTML = `
            <div class="error-message">
                <h3>載入失敗</h3>
                <p>暫時無法載入商品資料，請稍後再試。</p>
            </div>`;
    }
}

// 載入可用日期
async function loadAvailableDates() {
    try {
        console.log('開始載入可用日期...');
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailableDates`);
        const data = await response.json();
        console.log('載入可用日期回應:', data);

        if (data.success) {
            // 根據 createResponse 函數的邏輯，陣列會被設定為 products 屬性
            const dates = data.products || data.data || [];
            console.log('找到的日期:', dates);
            console.log('data.products:', data.products);
            console.log('data.data:', data.data);
            populateNavDateSelect(dates);
        } else {
            console.error('載入可用日期失敗:', data.message);
        }
    } catch (error) {
        console.error('載入可用日期時發生錯誤:', error);
    }
}

// 填充導航欄日期選擇器
function populateNavDateSelect(dates) {
    console.log('populateNavDateSelect 被調用，日期數量:', dates.length);
    console.log('日期內容:', dates);

    const navDateMenu = document.getElementById('navDateMenu');
    console.log('navDateMenu 元素:', navDateMenu);

    if (!navDateMenu) {
        console.error('找不到 navDateMenu 元素');
        return;
    }

    // 清空現有選項
    navDateMenu.innerHTML = '';

    if (dates.length === 0) {
        console.log('沒有日期資料，顯示暫無可用日期');
        const noDateItem = document.createElement('li');
        noDateItem.className = 'dropdown-item loading';
        noDateItem.textContent = '暫無可用日期';
        navDateMenu.appendChild(noDateItem);
        return;
    }

    // 添加日期選項
    const currentDate = document.getElementById('dateSelect').value;
    console.log('當前選中的日期:', currentDate);

    dates.forEach((date, index) => {
        console.log(`處理日期 ${index + 1}:`, date);
        const dateItem = document.createElement('li');
        dateItem.className = 'dropdown-item';
        dateItem.textContent = formatDisplayDate(date);
        dateItem.setAttribute('data-date', date);
        dateItem.addEventListener('click', function(e) {
            e.preventDefault();
            onNavDateSelect(date);
        });

        // 高亮當前選中的日期
        if (date === currentDate) {
            dateItem.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        }

        navDateMenu.appendChild(dateItem);
        console.log(`已添加日期項目:`, dateItem);
    });

    console.log('所有日期項目已添加完成，總共:', dates.length, '個');
}

// 處理導航欄日期選擇
function onNavDateSelect(selectedDate) {
    if (selectedDate) {
        // 同步更新產品區域的日期選擇器
        document.getElementById('dateSelect').value = selectedDate;

        // 載入對應日期的產品
        loadProducts();

        // 滾動到產品區域
        document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    }
}

// 處理產品區域日期選擇變化
function onDateSelectChange() {
    const dateSelect = document.getElementById('dateSelect');
    const selectedDate = dateSelect.value;

    // 高亮導航欄對應的日期項目
    highlightNavDateItem(selectedDate);

    // 載入對應日期的產品
    loadProducts();
}

// 高亮導航欄對應的日期項目
function highlightNavDateItem(selectedDate) {
    const navDateMenu = document.getElementById('navDateMenu');
    const dateItems = navDateMenu.querySelectorAll('.dropdown-item');

    dateItems.forEach(item => {
        if (item.getAttribute('data-date') === selectedDate) {
            item.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        } else {
            item.style.backgroundColor = '';
        }
    });
}

// 顯示產品
function displayProducts(products) {
    const productsContainer = document.getElementById('productsContainer');

    if (products.length === 0) {
        productsContainer.innerHTML = `
            <div class="no-products-message">
                <h3>今日暫無商品</h3>
                <p>請選擇其他日期或稍後再來看看</p>
            </div>`;
        return;
    }

    // 將產品按照產品名稱進行 grouping
    const groupedProducts = groupProductsByName(products);

    let html = '';
    groupedProducts.forEach(group => {
        const productImageHtml = group.imageUrl ?
            `<img src="${escapeHtml(group.imageUrl)}" alt="${escapeHtml(group.name)}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div class="product-image-fallback" style="display:none;">🧁</div>` :
            `<div class="product-image-fallback">🧁</div>`;

        let priceDisplay = '';
        let typeSelector = '';
        let addToOrderButton = '';
        let stockDisplay = '';

        if (group.variants.length > 1) {
            // 多個類型：顯示類型選擇器
            const groupId = `group_${group.name.replace(/\s+/g, '_')}`;
            priceDisplay = `<p class="product-price" id="price-${groupId}">請選擇類型</p>`;

            typeSelector = `
                <div class="size-selector">
                    <label for="type-${groupId}">類型選擇：</label>
                    <select id="type-${groupId}" onchange="updateProductPrice('${groupId}')">
                        <option value="">請選擇類型</option>
                        ${group.variants.map(variant =>
                            `<option value="${variant.id}" data-price="${variant.price}" data-remaining="${variant.remaining}" data-total="${variant.total}">
                                ${variant.type} - NT$ ${variant.price}
                            </option>`
                        ).join('')}
                    </select>
                </div>`;

            stockDisplay = `<p class="product-stock" id="stock-${groupId}">請先選擇類型</p>`;

            addToOrderButton = `
                <button class="add-to-order-btn" id="btn-${groupId}"
                        onclick="addVariantToOrder('${groupId}')" disabled>
                    請先選擇類型
                </button>`;
        } else {
            // 單一類型：直接顯示
            const variant = group.variants[0];
            const stockClass = getStockClass(variant.remaining, variant.total);
            const stockText = getStockText(variant.remaining, variant.total);
            const isAvailable = variant.remaining > 0;

            priceDisplay = `<p class="product-price">NT$ ${variant.price}</p>`;

            // 顯示類型資訊
            typeSelector = `
                <div class="product-type-info">
                    <span class="type-label">類型：</span>
                    <span class="type-value">${variant.type}</span>
                </div>`;

            stockDisplay = `<p class="product-stock ${stockClass}">${stockText}</p>`;

            addToOrderButton = `
                <button class="add-to-order-btn"
                        onclick="addToOrder('${variant.id}')"
                        ${!isAvailable ? 'disabled' : ''}>
                    ${isAvailable ? '加入訂單' : '已售完'}
                </button>`;
        }

        html += `
            <div class="product-card" data-product-name="${escapeHtml(group.name)}">
                <div class="product-image">
                    ${productImageHtml}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${escapeHtml(group.name)}</h3>
                    <p class="product-description">${escapeHtml(group.description)}</p>
                    ${priceDisplay}
                    ${stockDisplay}
                    ${typeSelector}
                    ${addToOrderButton}
                </div>
            </div>`;
    });

    productsContainer.innerHTML = html;
}

// 將產品按照產品名稱進行 grouping
function groupProductsByName(products) {
    const groups = {};

    products.forEach(product => {
        if (!groups[product.name]) {
            groups[product.name] = {
                name: product.name,
                description: product.description,
                imageUrl: product.imageUrl,
                variants: []
            };
        }

        groups[product.name].variants.push({
            id: product.id,
            type: product.type,
            price: product.price,
            total: product.total,
            remaining: product.remaining
        });
    });

    // 將物件轉換為陣列並按類型排序
    return Object.values(groups).map(group => {
        group.variants.sort((a, b) => {
            const typeOrder = { '小塔': 1, '大塔': 2, '其他': 3 };
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });
        return group;
    });
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

// 更新產品價格和庫存顯示
function updateProductPrice(groupId) {
    const typeSelect = document.getElementById(`type-${groupId}`);
    const priceDisplay = document.getElementById(`price-${groupId}`);
    const stockDisplay = document.getElementById(`stock-${groupId}`);
    const addButton = document.getElementById(`btn-${groupId}`);

    if (typeSelect.value) {
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const price = selectedOption.getAttribute('data-price');
        const remaining = parseInt(selectedOption.getAttribute('data-remaining'));
        const total = parseInt(selectedOption.getAttribute('data-total'));

        priceDisplay.textContent = `NT$ ${price}`;

        // 更新庫存顯示
        const stockClass = getStockClass(remaining, total);
        const stockText = getStockText(remaining, total);
        stockDisplay.textContent = stockText;
        stockDisplay.className = `product-stock ${stockClass}`;

        // 更新按鈕狀態
        if (remaining > 0) {
            addButton.textContent = '加入訂單';
            addButton.disabled = false;
        } else {
            addButton.textContent = '已售完';
            addButton.disabled = true;
        }
    } else {
        priceDisplay.textContent = '請選擇類型';
        stockDisplay.textContent = '請先選擇類型';
        stockDisplay.className = 'product-stock';
        addButton.textContent = '請先選擇類型';
        addButton.disabled = true;
    }
}

// 變體產品加入訂單
function addVariantToOrder(groupId) {
    const typeSelect = document.getElementById(`type-${groupId}`);
    if (!typeSelect.value) {
        alert('請先選擇類型');
        return;
    }

    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const productId = selectedOption.value;
    const price = parseInt(selectedOption.getAttribute('data-price'));
    const remaining = parseInt(selectedOption.getAttribute('data-remaining'));

    // 找到對應的產品資料
    const product = products.find(p => p.id === productId);
    if (!product) {
        alert('找不到此產品');
        return;
    }

    if (remaining === 0) {
        alert('此產品已售完');
        return;
    }

    const existingItem = orderItems.find(item => item.productId === productId);

    if (existingItem) {
        if (existingItem.quantity < Math.min(remaining, 10)) {
            existingItem.quantity += 1;
        } else {
            alert('數量已達上限');
            return;
        }
    } else {
        orderItems.push({
            productId: productId,
            name: `${product.name} (${product.type})`,
            price: price,
            quantity: 1,
            maxQuantity: Math.min(remaining, 10)
        });
    }

    updateOrderDisplay();
    updateTotalAmount();
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
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
        orderItemsContainer.innerHTML = '<p class="text-center">尚未選擇任何商品</p>';
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
    const customerInstagram = formData.get('customerInstagram').trim();
    const pickupDate = formData.get('pickupDate');
    const deliveryMethod = formData.get('deliveryMethod');
    const city = formData.get('city');
    const district = formData.get('district');
    const detailAddress = formData.get('detailAddress').trim();
    const customerAddress = `${city}${district}${detailAddress}`;
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

    if (!customerInstagram) {
        alert('請輸入IG帳號');
        return;
    }

    if (!pickupDate) {
        alert('請選擇取貨日期');
        return;
    }

    if (!deliveryMethod) {
        alert('請選擇交易方式');
        return;
    }

    if (!city) {
        alert('請選擇縣市');
        return;
    }

    if (!district) {
        alert('請選擇鄉鎮市區');
        return;
    }

    if (!detailAddress) {
        alert('請輸入詳細地址');
        return;
    }

    // 生成訂單摘要
    const orderSummary = generateOrderSummary();

    // 重導向到 Google Forms 並預填資料
    redirectToGoogleForm({
        customerName,
        customerPhone,
        customerInstagram,
        pickupDate,
        deliveryMethod,
        customerAddress,
        specialRequests,
        orderSummary,
        totalAmount
    });
}

// 生成訂單摘要
function generateOrderSummary() {
    const selectedDate = document.getElementById('dateSelect').value;
    let summary = `訂購日期：${selectedDate}\n訂單內容：\n`;

    orderItems.forEach(item => {
        // 包含產品ID和日期資訊，方便Excel公式解析
        summary += `• ${item.name} (${item.productId}) x ${item.quantity} = NT$ ${item.price * item.quantity}\n`;
    });
    summary += `\n總金額：NT$ ${totalAmount}`;

    // 為了方便Excel解析，額外添加結構化資料
    summary += '\n---產品明細---\n';
    orderItems.forEach(item => {
        summary += `${item.productId}:${item.quantity}:${selectedDate}\n`;
    });

    return summary;
}

// 重導向到 Google Forms
function redirectToGoogleForm(orderData) {
    // 建立 Google Forms URL with 預填參數
    // 注意：這些參數名稱需要對應到您 Google Forms 中的實際欄位 ID
    const params = new URLSearchParams({
        // 基本資料 (請替換為您的實際欄位 ID)
        'entry.1520392480': orderData.customerName,         // 姓名欄位
        'entry.1520001722': orderData.customerPhone,        // 電話欄位
        'entry.1546092137': orderData.customerInstagram,    // IG帳號欄位
        'entry.1047149694': orderData.pickupDate,           // 取貨日期欄位
        'entry.1645634297': orderData.deliveryMethod,       // 交易方式欄位
        'entry.82924036': orderData.customerAddress,      // 配送地址欄位
        'entry.1969932251': orderData.orderSummary,         // 訂單內容欄位
        'entry.247157095': orderData.totalAmount,          // 總金額欄位
        'entry.65985849': orderData.specialRequests       // 特殊需求欄位
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


// 格式化顯示日期
function formatDisplayDate(dateString) {
    console.log('formatDisplayDate 被調用，輸入:', dateString);
    const date = new Date(dateString);
    console.log('轉換後的日期對象:', date);
    const formatted = date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
    console.log('格式化後的日期:', formatted);
    return formatted;
}

// 更新footer年份
function updateCurrentYear() {
    const currentYear = new Date().getFullYear();
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = currentYear;
    }
}

// 更新交易方式選項
function updateDeliveryOptions() {
    const pickupDateInput = document.getElementById('pickupDate');
    const deliveryMethodSelect = document.getElementById('deliveryMethod');

    if (!pickupDateInput.value) {
        deliveryMethodSelect.innerHTML = '<option value="">請先選擇取貨日期</option>';
        return;
    }

    const selectedDate = new Date(pickupDateInput.value);
    const dayOfWeek = selectedDate.getDay(); // 0=週日, 1=週一, ..., 6=週六

    // 清空現有選項
    deliveryMethodSelect.innerHTML = '';

    // 週一～週五 (1-5)：顯示新竹選項
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        deliveryMethodSelect.innerHTML = `
            <option value="">請選擇交易方式</option>
            <option value="新竹-面交 (19:00)">新竹 - 面交 (19:00)</option>
            <option value="新竹-外送 (20:00~22:00, 無法指定時間)">新竹 - 外送 (20:00~22:00, 無法指定時間)</option>
        `;
    }
    // 週六、週日 (6, 0)：顯示台中選項
    else if (dayOfWeek === 6 || dayOfWeek === 0) {
        deliveryMethodSelect.innerHTML = `
            <option value="">請選擇交易方式</option>
            <option value="台中-外送 (14:00~16:00, 無法指定時間)">台中 - 外送 (14:00~16:00, 無法指定時間)</option>
        `;
    }
}

// 載入台灣地址資料
async function loadTaiwanAddressData() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/donma/TaiwanAddressCityAreaRoadChineseEnglishJSON/master/CityCountyData.json');
        taiwanAddressData = await response.json();
        populateCityOptions();
    } catch (error) {
        console.error('載入地址資料失敗:', error);
        // 使用備用的簡化資料
        taiwanAddressData = getBackupAddressData();
        populateCityOptions();
    }
}

// 填充縣市選項
function populateCityOptions() {
    const citySelect = document.getElementById('citySelect');
    if (!citySelect || !taiwanAddressData) return;

    citySelect.innerHTML = '<option value="">請選擇縣市</option>';

    taiwanAddressData.forEach(city => {
        const option = document.createElement('option');
        option.value = city.CityName;
        option.textContent = city.CityName;
        citySelect.appendChild(option);
    });
}

// 更新區域選項
function updateDistricts() {
    const citySelect = document.getElementById('citySelect');
    const districtSelect = document.getElementById('districtSelect');

    if (!citySelect || !districtSelect) return;

    const selectedCity = citySelect.value;

    if (!selectedCity) {
        districtSelect.innerHTML = '<option value="">請先選擇縣市</option>';
        districtSelect.disabled = true;
        return;
    }

    const cityData = taiwanAddressData.find(city => city.CityName === selectedCity);

    if (!cityData) {
        districtSelect.innerHTML = '<option value="">無可用區域</option>';
        districtSelect.disabled = true;
        return;
    }

    districtSelect.innerHTML = '<option value="">請選擇鄉鎮市區</option>';
    districtSelect.disabled = false;

    cityData.AreaList.forEach(area => {
        const option = document.createElement('option');
        option.value = area.AreaName;
        option.textContent = area.AreaName;
        districtSelect.appendChild(option);
    });
}

// 備用地址資料（簡化版）
function getBackupAddressData() {
    return [
        {
            "CityName": "台北市",
            "AreaList": [
                {"AreaName": "中正區"}, {"AreaName": "大同區"}, {"AreaName": "中山區"},
                {"AreaName": "松山區"}, {"AreaName": "大安區"}, {"AreaName": "萬華區"},
                {"AreaName": "信義區"}, {"AreaName": "士林區"}, {"AreaName": "北投區"},
                {"AreaName": "內湖區"}, {"AreaName": "南港區"}, {"AreaName": "文山區"}
            ]
        },
        {
            "CityName": "新北市",
            "AreaList": [
                {"AreaName": "板橋區"}, {"AreaName": "三重區"}, {"AreaName": "中和區"},
                {"AreaName": "永和區"}, {"AreaName": "新莊區"}, {"AreaName": "新店區"},
                {"AreaName": "樹林區"}, {"AreaName": "鶯歌區"}, {"AreaName": "三峽區"},
                {"AreaName": "淡水區"}, {"AreaName": "汐止區"}, {"AreaName": "瑞芳區"}
            ]
        },
        {
            "CityName": "桃園市",
            "AreaList": [
                {"AreaName": "桃園區"}, {"AreaName": "中壢區"}, {"AreaName": "大溪區"},
                {"AreaName": "楊梅區"}, {"AreaName": "蘆竹區"}, {"AreaName": "大園區"},
                {"AreaName": "龜山區"}, {"AreaName": "八德區"}, {"AreaName": "龍潭區"},
                {"AreaName": "平鎮區"}, {"AreaName": "新屋區"}, {"AreaName": "觀音區"}
            ]
        },
        {
            "CityName": "台中市",
            "AreaList": [
                {"AreaName": "中區"}, {"AreaName": "東區"}, {"AreaName": "南區"},
                {"AreaName": "西區"}, {"AreaName": "北區"}, {"AreaName": "北屯區"},
                {"AreaName": "西屯區"}, {"AreaName": "南屯區"}, {"AreaName": "太平區"},
                {"AreaName": "大里區"}, {"AreaName": "霧峰區"}, {"AreaName": "烏日區"}
            ]
        },
        {
            "CityName": "新竹市",
            "AreaList": [
                {"AreaName": "東區"}, {"AreaName": "北區"}, {"AreaName": "香山區"}
            ]
        },
        {
            "CityName": "新竹縣",
            "AreaList": [
                {"AreaName": "竹北市"}, {"AreaName": "竹東鎮"}, {"AreaName": "新埔鎮"},
                {"AreaName": "關西鎮"}, {"AreaName": "湖口鄉"}, {"AreaName": "新豐鄉"},
                {"AreaName": "芎林鄉"}, {"AreaName": "橫山鄉"}, {"AreaName": "北埔鄉"}
            ]
        }
    ];
}