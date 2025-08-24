// Google Apps Script Web App URL (只處理產品查詢)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxKkyJZYn2d1nnP01LC5xDrxPNsazUz8FNRLi4LuYV7LOWT8NH34xLx4zhhbVyCPw8J/exec';

// Google Forms URL (處理訂單提交)
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfNHI38AKIzed7cHfOdc5HHHi57fCKWv7jy-j_5kGRJpGehUQ/viewform';

// 全域變數
let products = [];
let orderItems = [];
let totalAmount = 0;
let taiwanAddressData = null;
let currentSelectedDate = null; // 追蹤當前選擇的商品日期
let isFirstTimeAddingProduct = true; // 追蹤是否為第一次加入商品
let dailyDeliveryCount = 0; // 當日外送訂單數量
const MAX_DAILY_DELIVERY = 6; // 每日最大外送次數

// 優惠碼相關變數
let appliedPromoCode = null; // 目前套用的優惠碼
let originalTotalAmount = 0; // 原始金額（未折扣前）
let discountAmount = 0; // 折扣金額

// 新增：全域資料快取（不包含客戶個人資料）
let globalData = {
    productData: null,
    dailyDeliveryStats: null, // 只儲存統計數據，不儲存個人資料
    maxDelivery: 6,
    loaded: false,
    timestamp: null
};

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    updateCurrentYear();
    loadTaiwanAddressData();
});

// 初始化頁面
async function initializePage() {
    // 修正時區問題，使用本地時間
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    document.getElementById('dateSelect').value = todayString;

    // 首先載入所有完整資料（只調用一次API）
    await loadAllCompleteData();

    // 然後基於資料初始化所有功能
    initializeWithData(todayString);

    setupScrolling();
    setupMobileDropdown();

    // 移除原本的表單提交事件，改用新的訂單處理
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);

    // 添加取貨方式變更監聽器
    setupDeliveryMethodListener();

    // 初始化浮動購物車
    updateFloatingCartBadge();

    // 設定IG連結
    setupInstagramLink();
}

// 設定IG連結
function setupInstagramLink() {
    const igLink = document.getElementById('igLink');
    if (!igLink) return;

    // 檢測是否為行動設備
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // 行動設備：設定為Instagram App深度連結
        igLink.href = 'instagram://user?username=buildtart.studio';

        // 添加點擊事件處理，如果IG App未安裝則回退到網頁版
        igLink.addEventListener('click', function(e) {
            e.preventDefault();

            // 嘗試開啟IG App
            const appUrl = 'instagram://user?username=buildtart.studio';
            const webUrl = 'https://www.instagram.com/buildtart.studio/';

            // 設定超時檢查，如果App沒有開啟則開啟網頁版
            const timeout = setTimeout(() => {
                window.open(webUrl, '_blank');
            }, 2000);

            // 嘗試開啟App
            window.location.href = appUrl;

            // 如果成功開啟App，頁面會失去焦點，清除超時
            window.addEventListener('blur', function() {
                clearTimeout(timeout);
            }, { once: true });
        });
    } else {
        // 桌面設備：保持原本的網頁連結
        igLink.href = 'https://www.instagram.com/buildtart.studio/';
    }
}

// 設定取貨方式變更監聽器
function setupDeliveryMethodListener() {
    const deliveryMethodSelect = document.getElementById('deliveryMethod');
    if (deliveryMethodSelect) {
        deliveryMethodSelect.addEventListener('change', function() {
            const selectedMethod = this.value;

            // 更新地址選項
            if (selectedMethod.includes('新竹')) {
                populateCityOptions('新竹');
            } else if (selectedMethod.includes('臺中')) {
                populateCityOptions('臺中');
            } else if (selectedMethod === '') {
                // 如果沒有選擇取貨方式，根據當前日期決定地址選項
                const pickupDateInput = document.getElementById('pickupDate');
                if (pickupDateInput.value) {
                    const selectedDate = new Date(pickupDateInput.value);
                    const dayOfWeek = selectedDate.getDay();
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        populateCityOptions('新竹');
                    } else if (dayOfWeek === 6 || dayOfWeek === 0) {
                        populateCityOptions('臺中');
                    }
                } else {
                    populateCityOptions();
                }
            }

            // 根據取貨方式設定地址欄位是否必填
            updateAddressRequiredStatus(selectedMethod);
        });
    }
}

// 更新地址欄位必填狀態
function updateAddressRequiredStatus(deliveryMethod) {
    const citySelect = document.getElementById('citySelect');
    const districtSelect = document.getElementById('districtSelect');
    const detailAddress = document.getElementById('detailAddress');

    // 找到地址標籤 - 通過父元素查找
    let addressLabel = null;
    if (citySelect) {
        const formGroup = citySelect.closest('.form-group');
        if (formGroup) {
            addressLabel = formGroup.querySelector('label');
        }
    }

    // 判斷是否為面交
    const isFaceToFace = deliveryMethod.includes('面交');

    if (isFaceToFace) {
        // 面交：地址非必填
        if (citySelect) citySelect.removeAttribute('required');
        if (districtSelect) districtSelect.removeAttribute('required');
        if (detailAddress) detailAddress.removeAttribute('required');

        // 更新標籤文字
        if (addressLabel) {
            addressLabel.innerHTML = '配送地址 <small>(面交不需填)</small>';
        }

        // 清空地址內容
        if (citySelect) citySelect.value = '';
        if (districtSelect) {
            districtSelect.value = '';
            districtSelect.disabled = true;
        }
        if (detailAddress) detailAddress.value = '';

    } else if (deliveryMethod.includes('外送')) {
        // 外送：地址必填
        if (citySelect) citySelect.setAttribute('required', 'required');
        if (districtSelect) districtSelect.setAttribute('required', 'required');
        if (detailAddress) detailAddress.setAttribute('required', 'required');

        // 更新標籤文字
        if (addressLabel) {
            addressLabel.innerHTML = '配送地址 *';
        }
    }
}

function setupScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            // 如果是 dropdown-toggle，不處理滾動
            if (this.classList.contains('dropdown-toggle')) {
                return;
            }

            // 如果 href 只是 "#"，不處理
            if (href === '#') {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// 設定手機版漢堡選單和下拉選單
function setupMobileDropdown() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenuWrapper = document.getElementById('navMenuWrapper');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const navDropdown = document.querySelector('.nav-dropdown');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    // 漢堡選單點擊事件
    if (hamburgerBtn && navMenuWrapper) {
        hamburgerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hamburgerBtn.classList.toggle('active');
            navMenuWrapper.classList.toggle('active');

            // 防止背景滾動
            if (navMenuWrapper.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });

        // 點擊選單項目後關閉漢堡選單
        const navLinks = navMenuWrapper.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                // 如果不是下拉選單的切換按鈕，則關閉漢堡選單
                if (!link.classList.contains('dropdown-toggle')) {
                    hamburgerBtn.classList.remove('active');
                    navMenuWrapper.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        // 點擊背景關閉漢堡選單
        navMenuWrapper.addEventListener('click', function(e) {
            if (e.target === navMenuWrapper) {
                hamburgerBtn.classList.remove('active');
                navMenuWrapper.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // 下拉選單功能
    if (dropdownToggle && navDropdown && dropdownMenu) {
        // 檢測是否為觸控設備
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // 為觸控設備添加特殊處理
        if (isTouchDevice) {
            dropdownToggle.addEventListener('touchstart', function(e) {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    navDropdown.classList.toggle('active');
                    dropdownMenu.classList.toggle('show');
                }
            }, { passive: false });
        }

        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // 在手機版本中處理下拉選單
            if (window.innerWidth <= 768) {
                // 如果是觸控設備且已經處理過 touchstart，則跳過
                if (isTouchDevice) {
                    return;
                }
                navDropdown.classList.toggle('active');
                dropdownMenu.classList.toggle('show');
            }
        });

        // 監聽視窗大小變化
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                // 桌面版本：移除手機版的類別
                hamburgerBtn.classList.remove('active');
                navMenuWrapper.classList.remove('active');
                navDropdown.classList.remove('active');
                dropdownMenu.classList.remove('show');
                document.body.style.overflow = '';
            }
        });

        // 點擊日期項目後關閉下拉選單（手機版）
        dropdownMenu.addEventListener('click', function(e) {
            if (e.target.classList.contains('dropdown-item') && window.innerWidth <= 768) {
                navDropdown.classList.remove('active');
                dropdownMenu.classList.remove('show');
                // 選擇日期後也關閉整個漢堡選單
                hamburgerBtn.classList.remove('active');
                navMenuWrapper.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
}

/**
 * 載入所有完整資料 - 只在初始化時調用一次API
 */
async function loadAllCompleteData() {
    if (globalData.loaded) {
        console.log('資料已載入，跳過重複載入');
        return;
    }

    // 顯示初始載入動畫
    const productsContainer = document.getElementById('productsContainer');
    productsContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-animation">
                <div class="cake-loader">
                    <div class="cake-layer layer-1"></div>
                    <div class="cake-layer layer-2"></div>
                    <div class="cake-layer layer-3"></div>
                    <div class="cake-topping">🍓</div>
                </div>
                <div class="loading-text">圖片準備中...</div>
                <div class="loading-progress">
                    <div class="progress-bar"></div>
                </div>
            </div>
        </div>
    `;

    try {
        console.log('🚀 開始載入所有完整資料...');

        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllCompleteData`);
        const data = await response.json();

        if (data.success) {
            globalData.productData = data.data.productData;
            globalData.dailyDeliveryStats = data.data.dailyDeliveryStats; // 只儲存統計數據
            globalData.maxDelivery = data.data.maxDelivery;
            globalData.loaded = true;
            globalData.timestamp = data.data.timestamp;

            console.log('✅ 完整資料載入成功！');
            console.log(`📦 產品資料: ${globalData.productData.length} 行`);
            console.log(`📊 外送統計: ${Object.keys(globalData.dailyDeliveryStats).length} 個日期`);
        } else {
            throw new Error(data.message || '載入完整資料失敗');
        }
    } catch (error) {
        console.error('❌ 載入完整資料時發生錯誤:', error);

        // 顯示載入錯誤
        productsContainer.innerHTML = `
            <div class="error-message">
                <h3>載入失敗</h3>
                <p>暫時無法載入商品資料，請重新整理頁面。</p>
                <button onclick="window.location.reload()" class="retry-button">重新載入</button>
            </div>`;

        throw error;
    }
}

/**
 * 基於已載入的資料初始化頁面
 */
function initializeWithData(initialDate) {
    // 1. 載入可用日期到導航選單
    const availableDates = extractAvailableDatesFromData();
    populateNavDateSelect(availableDates);

    // 2. 載入初始日期的產品
    loadProductsFromData(initialDate);
}

/**
 * 從全域資料中提取可用日期
 */
function extractAvailableDatesFromData() {
    const dates = new Set();

    if (globalData.productData && globalData.productData.length > 1) {
        const headers = globalData.productData[0];
        const dateIndex = headers.indexOf('日期');
        const statusIndex = headers.indexOf('狀態');

        if (dateIndex !== -1) {
            for (let i = 1; i < globalData.productData.length; i++) {
                const row = globalData.productData[i];
                if (!row || row.length === 0 || !row[dateIndex]) continue;

                // 只處理狀態為啟用的產品
                if (statusIndex !== -1 && row[statusIndex] !== '啟用') continue;

                const formattedDate = formatDateForComparison(row[dateIndex]);
                if (formattedDate) {
                    dates.add(formattedDate);
                }
            }
        }
    }

    return Array.from(dates).sort();
}

/**
 * 從全域資料中載入指定日期的產品（不調用API）
 */
function loadProductsFromData(targetDate) {
    const productsContainer = document.getElementById('productsContainer');

    // 更新當前選擇的商品日期
    currentSelectedDate = targetDate;

    // 自動更新取貨日期為商品日期
    updatePickupDate(targetDate);

    try {
        // 顯示載入動畫
        productsContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-animation">
                    <div class="cake-loader">
                        <div class="cake-layer layer-1"></div>
                        <div class="cake-layer layer-2"></div>
                        <div class="cake-layer layer-3"></div>
                        <div class="cake-topping">🍓</div>
                    </div>
                    <div class="loading-text">準備商品資料中...</div>
                    <div class="loading-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
        `;

        // 保留載入動畫的時間，提供更好的用戶體驗
        setTimeout(() => {
            const processedData = processDataForTargetDate(targetDate);

            products = processedData.products || [];
            dailyDeliveryCount = processedData.deliveryCount || 0;
            console.log(`當日外送數量: ${dailyDeliveryCount}/${processedData.maxDelivery || MAX_DAILY_DELIVERY}`);

            displayProducts(products);
            // 清空跨日期的訂單項目
            clearCrossDayOrderItems();
        }, 800); // 保留載入動畫，讓用戶感受到系統在工作

    } catch (error) {
        console.error('處理產品資料時發生錯誤:', error);
        productsContainer.innerHTML = `
            <div class="error-message">
                <h3>處理失敗</h3>
                <p>暫時無法處理商品資料，請重新整理頁面。</p>
            </div>`;
    }
}

/**
 * 處理指定日期的資料（從全域資料中）
 */
function processDataForTargetDate(targetDate) {
    // 1. 處理產品資料
    const products = [];
    if (globalData.productData && globalData.productData.length > 1) {
        const headers = globalData.productData[0];

        // 建立欄位索引映射
        const indexes = {
            date: headers.indexOf('日期'),
            id: headers.indexOf('產品ID'),
            name: headers.indexOf('產品名稱'),
            type: headers.indexOf('類型'),
            description: headers.indexOf('描述'),
            price: headers.indexOf('價格'),
            total: headers.indexOf('總數量'),
            remaining: headers.indexOf('剩餘數量'),
            status: headers.indexOf('狀態'),
            image: headers.indexOf('圖片連結')
        };

        // 格式化目標日期
        const formattedTargetDate = formatDateForComparison(targetDate);

        // 篩選指定日期且狀態為啟用的產品
        for (let i = 1; i < globalData.productData.length; i++) {
            const row = globalData.productData[i];

            if (!row || row.length === 0 || !row[indexes.date]) continue;

            const rowDate = formatDateForComparison(row[indexes.date]);

            if (rowDate === formattedTargetDate && row[indexes.status] === '啟用') {
                products.push({
                    id: row[indexes.id],
                    name: row[indexes.name],
                    type: row[indexes.type] || '其他',
                    description: row[indexes.description],
                    price: row[indexes.price],
                    total: row[indexes.total],
                    remaining: row[indexes.remaining],
                    date: rowDate,
                    imageUrl: indexes.image !== -1 ? row[indexes.image] : ''
                });
            }
        }
    }

    // 2. 從後端計算好的統計資料中取得外送數量（保護客戶隱私）
    const formattedTargetDate = formatDateForComparison(targetDate);
    const deliveryCount = globalData.dailyDeliveryStats[formattedTargetDate] || 0;

    return {
        products: products,
        deliveryCount: deliveryCount,
        maxDelivery: globalData.maxDelivery || 6
    };
}

/**
 * 前端資料處理函數 - 將API返回的原始資料處理成需要的格式（舊版保留）
 */
function processRawDataForDate(rawData, targetDate) {
    const { productData, formResponseData, maxDelivery } = rawData;

    // 1. 處理產品資料
    const products = [];
    if (productData && productData.length > 1) {
        const headers = productData[0];

        // 建立欄位索引映射
        const indexes = {
            date: headers.indexOf('日期'),
            id: headers.indexOf('產品ID'),
            name: headers.indexOf('產品名稱'),
            type: headers.indexOf('類型'),
            description: headers.indexOf('描述'),
            price: headers.indexOf('價格'),
            total: headers.indexOf('總數量'),
            remaining: headers.indexOf('剩餘數量'),
            status: headers.indexOf('狀態'),
            image: headers.indexOf('圖片連結')
        };

        // 格式化目標日期
        const formattedTargetDate = formatDateForComparison(targetDate);

        // 篩選指定日期且狀態為啟用的產品
        for (let i = 1; i < productData.length; i++) {
            const row = productData[i];

            if (!row || row.length === 0 || !row[indexes.date]) continue;

            const rowDate = formatDateForComparison(row[indexes.date]);

            if (rowDate === formattedTargetDate && row[indexes.status] === '啟用') {
                products.push({
                    id: row[indexes.id],
                    name: row[indexes.name],
                    type: row[indexes.type] || '其他',
                    description: row[indexes.description],
                    price: row[indexes.price],
                    total: row[indexes.total],
                    remaining: row[indexes.remaining],
                    date: rowDate,
                    imageUrl: indexes.image !== -1 ? row[indexes.image] : ''
                });
            }
        }
    }

    // 2. 計算外送數量
    let deliveryCount = 0;
    if (formResponseData && formResponseData.length > 1) {
        const headers = formResponseData[0];

        // 尋找相關欄位的索引
        let pickupDateIndex = -1;
        let deliveryMethodIndex = -1;

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i].toString().toLowerCase();
            if (header.includes('取貨日期') || header.includes('pickup') || header.includes('日期')) {
                pickupDateIndex = i;
            }
            if (header.includes('取貨方式') || header.includes('delivery') || header.includes('交易方式')) {
                deliveryMethodIndex = i;
            }
        }

        if (pickupDateIndex !== -1 && deliveryMethodIndex !== -1) {
            const formattedTargetDate = formatDateForComparison(targetDate);

            for (let i = 1; i < formResponseData.length; i++) {
                const row = formResponseData[i];
                if (!row || row.length === 0) continue;

                const pickupDate = row[pickupDateIndex];
                const deliveryMethod = row[deliveryMethodIndex];

                if (pickupDate && deliveryMethod) {
                    const formattedPickupDate = formatDateForComparison(pickupDate);
                    if (formattedPickupDate === formattedTargetDate &&
                        deliveryMethod.toString().includes('外送')) {
                        deliveryCount++;
                    }
                }
            }
        }
    }

    // 3. 提取所有可用日期
    const availableDates = new Set();
    if (productData && productData.length > 1) {
        const headers = productData[0];
        const dateIndex = headers.indexOf('日期');
        const statusIndex = headers.indexOf('狀態');

        if (dateIndex !== -1) {
            for (let i = 1; i < productData.length; i++) {
                const row = productData[i];
                if (!row || row.length === 0 || !row[dateIndex]) continue;

                // 只處理狀態為啟用的產品
                if (statusIndex !== -1 && row[statusIndex] !== '啟用') continue;

                const formattedDate = formatDateForComparison(row[dateIndex]);
                if (formattedDate) {
                    availableDates.add(formattedDate);
                }
            }
        }
    }

    return {
        products: products,
        deliveryCount: deliveryCount,
        maxDelivery: maxDelivery || 6,
        availableDates: Array.from(availableDates).sort()
    };
}

/**
 * 前端日期格式化函數（與後端保持一致）
 */
function formatDateForComparison(date) {
    if (!date) return '';

    // 字符串日期處理
    if (typeof date === 'string') {
        // 處理 "2025/1/14" 格式
        if (date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                const year = parts[0];
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }

        // 處理 ISO 格式 "2025-01-14"
        if (date.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
            const parts = date.split('-');
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    // Date 對象處理
    let dateObj;
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'number') {
        // Google Sheets Excel 序列號
        dateObj = new Date((date - 25569) * 86400 * 1000);
    } else {
        dateObj = new Date(String(date));
    }

    // 驗證並格式化
    if (dateObj && !isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return '';
}

// 載入產品數據（終極優化版 - 無API調用，使用全域資料）
function loadProducts() {
    const selectedDate = document.getElementById('dateSelect').value;

    if (!globalData.loaded) {
        console.error('全域資料尚未載入，無法切換產品');
        return;
    }

    // 直接使用已載入的全域資料，無需API調用
    loadProductsFromData(selectedDate);
}

// 載入可用日期（備用函數 - 已整合至loadProducts中）
async function loadAvailableDates() {
    // 此函數已不再使用，可用日期現在通過 loadProducts() 一次性載入
    console.warn('loadAvailableDates() 已棄用，請使用 loadProducts() 獲取完整資料');

    // 如果需要獨立載入可用日期，仍保留此功能
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailableDates`);
        const data = await response.json();

        if (data.success) {
            const dates = data.products || data.data || [];
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
    const navDateMenu = document.getElementById('navDateMenu');

    if (!navDateMenu) {
        console.error('找不到 navDateMenu 元素');
        return;
    }

    // 清空現有選項
    navDateMenu.innerHTML = '';

    if (dates.length === 0) {
        const noDateItem = document.createElement('li');
        noDateItem.className = 'dropdown-item loading';
        noDateItem.textContent = '暫無可用日期';
        navDateMenu.appendChild(noDateItem);
        return;
    }

    // 添加日期選項
    const currentDate = document.getElementById('dateSelect').value;

    dates.forEach(date => {
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
    });
}

// 處理導航欄日期選擇
function onNavDateSelect(selectedDate) {
    if (selectedDate) {
        // 檢查是否有跨日期的訂單項目
        if (orderItems.length > 0 && currentSelectedDate && currentSelectedDate !== selectedDate) {
            const confirmSwitch = confirm(
                `切換日期將清空目前的訂單項目。\n\n` +
                `目前訂單：${currentSelectedDate}\n` +
                `切換至：${selectedDate}\n\n` +
                `確定要繼續嗎？`
            );

            if (!confirmSwitch) {
                return; // 取消切換
            }
        }

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

    // 檢查是否有跨日期的訂單項目
    if (orderItems.length > 0 && currentSelectedDate && currentSelectedDate !== selectedDate) {
        const confirmSwitch = confirm(
            `切換日期將清空目前的訂單項目。\n\n` +
            `目前訂單：${currentSelectedDate}\n` +
            `切換至：${selectedDate}\n\n` +
            `確定要繼續嗎？`
        );

        if (!confirmSwitch) {
            // 恢復到原來的日期
            dateSelect.value = currentSelectedDate;
            return;
        }
    }

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
                <h3>注意事項</h3>
                <p>請選擇右上角取貨日期，如需下午茶訂購可私訊
                <a href="https://www.instagram.com/buildtart.studio/" target="_blank" class="ig-link" id="igLink">@buildtart.studio</a>
                </p>
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

            // 找到小塔類型作為預設選擇
            const defaultVariant = group.variants.find(variant => variant.type === '小塔') || group.variants[0];

            priceDisplay = `<p class="product-price" id="price-${groupId}">NT$ ${defaultVariant.price}</p>`;

            typeSelector = `
                <div class="size-selector">
                    <label for="type-${groupId}">類型選擇：</label>
                    <select id="type-${groupId}" onchange="updateProductPrice('${groupId}')">
                        ${group.variants.map(variant =>
                            `<option value="${variant.id}" data-price="${variant.price}" data-remaining="${variant.remaining}" data-total="${variant.total}" ${variant.id === defaultVariant.id ? 'selected' : ''}>
                                ${variant.type} - NT$ ${variant.price}
                            </option>`
                        ).join('')}
                    </select>
                </div>`;

            const stockClass = getStockClass(defaultVariant.remaining, defaultVariant.total);
            const stockText = getStockText(defaultVariant.remaining, defaultVariant.total);
            stockDisplay = `<p class="product-stock ${stockClass}" id="stock-${groupId}">${stockText}</p>`;

            const buttonDisabled = defaultVariant.remaining === 0;
            const buttonText = defaultVariant.remaining === 0 ? '已售完' : '加入訂單';
            addToOrderButton = `
                <button class="add-to-order-btn" id="btn-${groupId}"
                        onclick="addVariantToOrder('${groupId}')" ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonText}
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
                    ${typeSelector}
                    ${addToOrderButton}
                </div>
            </div>`;
        // TODO: 剩餘數量目前暫時不顯示：${stockDisplay}
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
    // const stockDisplay = document.getElementById(`stock-${groupId}`);
    // TODO: 剩餘數量目前暫時不顯示：${stockDisplay}
    const addButton = document.getElementById(`btn-${groupId}`);

    if (typeSelect.value) {
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const price = selectedOption.getAttribute('data-price');
        const remaining = parseInt(selectedOption.getAttribute('data-remaining'));
        const total = parseInt(selectedOption.getAttribute('data-total'));

        priceDisplay.textContent = `NT$ ${price}`;

        // 更新庫存顯示
        // const stockClass = getStockClass(remaining, total);
        // const stockText = getStockText(remaining, total);
        // stockDisplay.textContent = stockText;
        // stockDisplay.className = `product-stock ${stockClass}`;
        // TODO: 剩餘數量目前暫時不顯示：${stockDisplay}

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
        // stockDisplay.textContent = '請先選擇類型';
        // stockDisplay.className = 'product-stock';
        // TODO: 剩餘數量目前暫時不顯示：${stockDisplay}
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

    // 檢查是否為跨日期商品
    if (!canAddProductFromDifferentDate(currentSelectedDate)) {
        alert('無法加入不同日期的商品，請先清空目前訂單或選擇相同日期的商品');
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

    // 第一次加入商品時顯示通知並跳轉到表單，之後只顯示通知
    if (isFirstTimeAddingProduct) {
        isFirstTimeAddingProduct = false;
        showAddToCartNotification(`${product.name} (${product.type})`, existingItem ? '數量已更新' : '已加入訂單');
        // 延遲跳轉，讓用戶先看到通知效果
        setTimeout(() => {
            document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
        }, 500);
    } else {
        showAddToCartNotification(`${product.name} (${product.type})`, existingItem ? '數量已更新' : '已加入訂單');
    }
}

// 更新取貨日期為商品日期
function updatePickupDate(selectedDate) {
    const pickupDateInput = document.getElementById('pickupDate');
    if (pickupDateInput && selectedDate) {
        // 暫時啟用欄位以設定值，然後恢復disabled狀態
        const wasDisabled = pickupDateInput.disabled;
        pickupDateInput.disabled = false;
        pickupDateInput.value = selectedDate;
        pickupDateInput.disabled = wasDisabled;
        // 觸發交易方式選項更新
        updateDeliveryOptions();
    }
}

// 清空跨日期的訂單項目
function clearCrossDayOrderItems() {
    if (orderItems.length > 0) {
        orderItems = [];
        updateOrderDisplay();
        updateTotalAmount();

        // 重置第一次加入商品的標記
        isFirstTimeAddingProduct = true;

        // 顯示清空提示
        showDateChangeNotification();
    }
}

// 顯示日期切換通知
function showDateChangeNotification() {
    const notification = document.createElement('div');
    notification.className = 'date-change-notification';
    notification.innerHTML = `
        <div class="notification-content">
            ⚠️ 已切換取貨日期，訂單已清空
        </div>
    `;

    document.body.appendChild(notification);

    // 3秒後移除通知
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 顯示加入購物車通知
function showAddToCartNotification(productName, action) {
    const notification = document.createElement('div');
    notification.className = 'add-to-cart-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">✓</div>
            <div class="notification-text">
                <div class="notification-title">${escapeHtml(productName)}</div>
                <div class="notification-subtitle">${action}</div>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // 動畫效果：從右側滑入
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // 3秒後滑出並移除
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 滾動到訂單區域
function scrollToOrder() {
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
}

// 更新浮動購物車徽章
function updateFloatingCartBadge() {
    const cartBadge = document.getElementById('cartBadge');
    const floatingCart = document.getElementById('floatingCart');

    if (cartBadge && floatingCart) {
        const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.textContent = totalItems;

        // 當沒有商品時隱藏浮動購物車
        if (totalItems === 0) {
            floatingCart.style.display = 'none';
        } else {
            floatingCart.style.display = 'flex';
        }
    }
}

// 檢查是否可以加入不同日期的商品
function canAddProductFromDifferentDate(productDate) {
    if (orderItems.length === 0) {
        return true; // 沒有訂單項目，可以加入
    }

    return currentSelectedDate === productDate; // 只能加入相同日期的商品
}

// 訂單相關函數
function addToOrder(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.remaining === 0) {
        alert('此產品已售完');
        return;
    }

    // 檢查是否為跨日期商品
    if (!canAddProductFromDifferentDate(currentSelectedDate)) {
        alert('無法加入不同日期的商品，請先清空目前訂單或選擇相同日期的商品');
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

    // 第一次加入商品時顯示通知並跳轉到表單，之後只顯示通知
    if (isFirstTimeAddingProduct) {
        isFirstTimeAddingProduct = false;
        showAddToCartNotification(product.name, existingItem ? '數量已更新' : '已加入訂單');
        // 延遲跳轉，讓用戶先看到通知效果
        setTimeout(() => {
            document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
        }, 500);
    } else {
        showAddToCartNotification(product.name, existingItem ? '數量已更新' : '已加入訂單');
    }
}

function updateOrderDisplay() {
    const orderItemsContainer = document.getElementById('orderItems');

    if (orderItems.length === 0) {
        orderItemsContainer.innerHTML = '<p class="text-center">尚未選擇任何商品</p>';
        updateFloatingCartBadge();
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
    updateFloatingCartBadge();
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
    // 計算原始金額
    originalTotalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 檢查是否有套用的優惠碼，並驗證是否仍符合條件
    if (appliedPromoCode) {
        const validation = validatePromoCode(appliedPromoCode.code, originalTotalAmount);
        if (validation.valid) {
            discountAmount = validation.discount;
            totalAmount = originalTotalAmount - discountAmount;
        } else {
            // 如果不再符合條件，移除優惠碼
            removePromoCode();
            totalAmount = originalTotalAmount;
        }
    } else {
        discountAmount = 0;
        totalAmount = originalTotalAmount;
    }

    // 更新顯示
    updatePriceDisplay();
}

// 更新價格顯示
function updatePriceDisplay() {
    const originalAmountDiv = document.getElementById('originalAmount');
    const discountAmountDiv = document.getElementById('discountAmount');
    const totalAmountSpan = document.getElementById('totalAmount');

    if (appliedPromoCode && discountAmount > 0) {
        // 顯示原價
        document.getElementById('originalTotal').textContent = originalTotalAmount;
        originalAmountDiv.style.display = 'block';

        // 顯示折扣
        document.getElementById('discountTotal').textContent = discountAmount;
        discountAmountDiv.style.display = 'block';
    } else {
        // 隱藏原價和折扣
        originalAmountDiv.style.display = 'none';
        discountAmountDiv.style.display = 'none';
    }

    // 更新最終金額
    totalAmountSpan.textContent = totalAmount;
}

// 套用優惠碼
function applyPromoCode() {
    const promoCodeInput = document.getElementById('promoCode');
    const promoMessageDiv = document.getElementById('promoMessage');
    const applyBtn = document.getElementById('applyPromoBtn');

    const code = promoCodeInput.value.trim();
    if (!code) {
        showPromoMessage('請輸入優惠碼', 'error');
        return;
    }

    // 計算目前的原始金額
    const currentOriginalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 驗證優惠碼
    const validation = validatePromoCode(code, currentOriginalAmount);

    if (validation.valid) {
        // 套用優惠碼
        appliedPromoCode = {
            code: code,
            name: validation.name,
            discount: validation.discount,
            description: validation.description
        };

        // 更新金額顯示
        updateTotalAmount();

        // 顯示成功訊息
        showPromoMessage(validation.message, 'success');

        // 更改按鈕文字
        applyBtn.textContent = '移除';
        applyBtn.onclick = removePromoCode;

        // 禁用輸入框
        promoCodeInput.disabled = true;
    } else {
        showPromoMessage(validation.message, 'error');
    }
}

// 移除優惠碼
function removePromoCode() {
    const promoCodeInput = document.getElementById('promoCode');
    const promoMessageDiv = document.getElementById('promoMessage');
    const applyBtn = document.getElementById('applyPromoBtn');

    // 清除優惠碼
    appliedPromoCode = null;
    discountAmount = 0;

    // 更新金額顯示
    updateTotalAmount();

    // 重置UI
    promoCodeInput.value = '';
    promoCodeInput.disabled = false;
    applyBtn.textContent = '套用';
    applyBtn.onclick = applyPromoCode;

    // 清除訊息
    promoMessageDiv.textContent = '';
    promoMessageDiv.className = 'promo-message';
}

// 顯示優惠碼訊息
function showPromoMessage(message, type) {
    const promoMessageDiv = document.getElementById('promoMessage');
    promoMessageDiv.textContent = message;
    promoMessageDiv.className = `promo-message ${type}`;
}

// 處理訂單提交 - 重導向到 Google Forms
function handleOrderSubmit(e) {
    e.preventDefault();

    // 基本驗證
    if (orderItems.length === 0) {
        alert('請至少選擇一個產品');
        return;
    }

    if (orderItems.length > 20) {
        alert('單次訂單最多20項產品');
        return;
    }

    if (totalAmount > 5000) {
        alert('單次訂單金額不能超過5,000元');
        return;
    }

    // 暫時啟用取貨日期欄位以確保值能被正確提交
    const pickupDateInput = document.getElementById('pickupDate');
    const wasDisabled = pickupDateInput.disabled;
    pickupDateInput.disabled = false;

    // 收集表單資料
    const formData = new FormData(e.target);

    // 恢復原本的disabled狀態
    pickupDateInput.disabled = wasDisabled;
    const customerName = formData.get('customerName').trim();
    const customerPhone = formData.get('customerPhone').trim();
    const customerInstagram = formData.get('customerInstagram').trim();
    const pickupDate = formData.get('pickupDate');
    const deliveryMethod = formData.get('deliveryMethod');
    const city = formData.get('city');
    const district = formData.get('district');
    const detailAddress = formData.get('detailAddress').trim();
    const specialRequests = formData.get('specialRequests').trim();

    // 判斷是否為面交
    const isFaceToFace = deliveryMethod.includes('面交');
    const customerAddress = isFaceToFace ? '面交' : `${city}${district}${detailAddress}`;

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

    // 進階驗證 - 使用正規表達式
    // 驗證姓名至少 2 個字
    if (!/^.{2,}$/.test(customerName)) {
        alert('「姓名」請輸入至少 2 個字');
        return;
    }

    if (!/^09[0-9]{8}$/.test(customerPhone)) {
        alert('「電話號碼」請輸入 10 位數字手機號碼，例如 0912345678');
        return;
    }

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(customerInstagram)) {
        alert('「IG帳號」請輸入有效 IG 帳號，例如 buildtart.studio');
        return;
    }

    if (!pickupDate) {
        alert('請選擇取貨日期');
        return;
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
    if (!paymentMethod) {
        alert('請選擇付款方式');
        return;
    }

    if (!deliveryMethod) {
        alert('請選擇取貨方式');
        return;
    }

    // 地址驗證（面交時可以省略）
    if (!isFaceToFace) {
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
    }

    // 驗證條款確認
    const termsAgreement = document.getElementById('termsAgreement');
    if (!termsAgreement.checked) {
        alert('請先閱讀並勾選確認條款');
        return;
    }

    // 生成訂單摘要
    const orderSummary = generateOrderSummary();

    // 直接提交到 Google Forms
    submitToGoogleForm({
        customerName,
        customerPhone,
        customerInstagram,
        pickupDate,
        paymentMethod,
        customerAddress,
        deliveryMethod,
        orderSummary,
        totalAmount,
        specialRequests
    });
}

// 生成訂單摘要
function generateOrderSummary() {
    const selectedDate = document.getElementById('dateSelect').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    let summary = `取貨日期：${selectedDate}\n付款方式：${paymentMethod}\n訂單內容：\n`;

    orderItems.forEach(item => {
        // 包含產品ID和日期資訊，方便Excel公式解析
        summary += `• ${item.name} x ${item.quantity} = NT$ ${item.price * item.quantity}\n`;
    });

    // 加入優惠碼資訊（如果有的話）
    if (appliedPromoCode && discountAmount > 0) {
        summary += `\n小計：NT$ ${originalTotalAmount}`;
        summary += `\n優惠碼：${appliedPromoCode.code} (${appliedPromoCode.name}) -NT$ ${discountAmount}`;
        summary += `\n總金額：NT$ ${totalAmount}`;
    } else {
        summary += `\n總金額：NT$ ${totalAmount}`;
    }

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
        'entry.1069013189': orderData.paymentMethod,        // 付款方式欄位
        'entry.1645634297': orderData.deliveryMethod,       // 取貨方式欄位
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
            <li>完成人機驗證 (IG 私訊 @buildtart.studio)</li>
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

// 直接提交到 Google Forms
async function submitToGoogleForm(orderData) {
    try {
        // 顯示提交中狀態
        const submitButton = document.querySelector('.submit-button');
        const originalText = submitButton.textContent;
        submitButton.textContent = '提交中...';
        submitButton.disabled = true;

        // Google Forms 的提交 URL (formResponse 端點)
        const formId = '1FAIpQLSfNHI38AKIzed7cHfOdc5HHHi57fCKWv7jy-j_5kGRJpGehUQ';
        const submitUrl = `https://docs.google.com/forms/u/0/d/e/${formId}/formResponse`;

        // 建立表單資料
        const formData = new FormData();
        formData.append('entry.1520392480', orderData.customerName);         // 姓名欄位
        formData.append('entry.1520001722', orderData.customerPhone);        // 電話欄位
        formData.append('entry.1546092137', orderData.customerInstagram);    // IG帳號欄位
        formData.append('entry.1047149694', orderData.pickupDate);           // 取貨日期欄位
        formData.append('entry.1069013189', orderData.paymentMethod);        // 付款方式欄位
        formData.append('entry.1645634297', orderData.deliveryMethod);       // 取貨方式欄位
        formData.append('entry.82924036', orderData.customerAddress);        // 配送地址欄位
        formData.append('entry.1969932251', orderData.orderSummary);         // 訂單內容欄位
        formData.append('entry.247157095', orderData.totalAmount);          // 總金額欄位
        formData.append('entry.65985849', orderData.specialRequests || '');  // 特殊需求欄位

        // 提交到 Google Forms
        const response = await fetch(submitUrl, {
            method: 'POST',
            body: formData,
            mode: 'no-cors' // Google Forms 不支援 CORS，使用 no-cors 模式
        });

        // 由於是 no-cors 模式，我們無法檢查 response status
        // 但通常如果沒有錯誤，就代表提交成功
        showSuccessMessage(orderData);

        // 清空訂單（這裡會重置按鈕狀態）
        clearOrder();
    } catch (error) {
        console.error('提交訂單失敗:', error);
        showErrorMessage('提交訂單時發生錯誤，請重試或聯繫客服。');

        // 錯誤情況下恢復按鈕狀態
        const submitButton = document.querySelector('.submit-button');
        if (submitButton) {
            submitButton.textContent = '提交訂單';
            submitButton.disabled = false
        }
    }
}

// 顯示成功Modal
function showSuccessMessage(orderData) {
    // 創建Modal
    const modal = createSuccessModal(orderData);
    document.body.appendChild(modal);

    // 防止背景滾動
    document.body.style.overflow = 'hidden';

    // 顯示動畫
    setTimeout(() => {
        modal.classList.add('show');
    }, 50);

}

// 創建成功Modal
function createSuccessModal(orderData) {
    const modal = document.createElement('div');
    modal.className = 'success-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <!-- 成功圖示與標題 -->
            <div class="success-header">
                <h2>訂單提交成功！</h2>
            </div>

            <!-- 行動按鈕組 -->
            <div class="modal-actions">
                <button class="secondary-btn" onclick="continueOrder()">
                    <span class="btn-icon">🛒</span>
                    繼續下單
                </button>
                <button class="primary-btn" onclick="closeAndNavigateIG()">
                    <span class="btn-icon">💬</span>
                    前往IG私訊
                </button>
            </div>

            <!-- 重要下一步 -->
            <div class="next-steps highlight-section">
                <h3><span class="icon">🎯</span> 重要！接下來請：</h3>
                <div class="step-list">
                    <div class="step primary-step">
                        <span class="step-number">1</span>
                        <div class="step-content">
                            <strong>立即IG私訊確認</strong>
                            <p class="step-desc">請前往Instagram私訊 <a href="https://www.instagram.com/buildtart.studio/" target="_blank" style="color: #8B7355; font-weight: bold; text-decoration: none;">@buildtart.studio</a> 確認訂單</p>
                        </div>
                    </div>
                    <div class="step">
                        <span class="step-number">2</span>
                        <div class="step-content">
                            <strong>等待確認回覆</strong>
                            <p class="step-desc">築塔STUDIO將在 <span class="highlight">24小時內</span> 回覆確認</p>
                        </div>
                    </div>
                    <div class="step">
                        <span class="step-number">3</span>
                        <div class="step-content">
                            <strong>依時取貨</strong>
                            <p class="step-desc">確認後請依指定的時間與地點取貨</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 訂單摘要 -->
            <div class="order-summary-section">
                <h3><span class="icon">📋</span> 您的訂單</h3>
                <div class="order-details">
                    <pre class="order-content">${orderData.orderSummary}</pre>
                </div>
            </div>

            <!-- 關閉按鈕 -->
            <button class="modal-close" onclick="closeModal()" aria-label="關閉">×</button>
        </div>
    `;

    // 添加事件監聽
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            // 點擊背景時顯示確認對話框
            if (confirm('確定要關閉此訊息嗎？請確保您已了解後續的IG私訊步驟。')) {
                closeModal();
            }
        }
    });

    // ESC鍵關閉
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    });

    return modal;
}

// 關閉Modal並前往IG
function closeAndNavigateIG() {
    // 開啟IG
    window.open('https://www.instagram.com/buildtart.studio/', '_blank');

    // 關閉Modal
    setTimeout(() => {
        closeModal();
    }, 500);
}

// 繼續下單
function continueOrder() {
    // 直接刷新頁面，簡單有效
    location.reload();
}

// 關閉Modal
function closeModal() {
    const modal = document.querySelector('.success-modal');
    if (modal) {
        modal.classList.add('hiding');
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

// 顯示快速通知
function showQuickNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'quick-notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 顯示錯誤訊息
function showErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-message';
    messageDiv.style.cssText = `
        background-color: #fee;
        border: 1px solid #fcc;
        color: #c33;
        padding: 15px;
        margin: 15px 0;
        border-radius: 8px;
        text-align: center;
    `;
    messageDiv.innerHTML = `
        <h3>❌ ${message}</h3>
        <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 8px 16px; background: #c33; color: white; border: none; border-radius: 4px; cursor: pointer;">關閉</button>
    `;

    const orderSection = document.getElementById('order');
    orderSection.insertBefore(messageDiv, orderSection.firstChild);

    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 清空訂單
function clearOrder() {
    orderItems = [];
    totalAmount = 0;

    // 清除優惠碼相關資料
    appliedPromoCode = null;
    originalTotalAmount = 0;
    discountAmount = 0;

    // 重置優惠碼UI
    const promoCodeInput = document.getElementById('promoCode');
    const promoMessageDiv = document.getElementById('promoMessage');
    const applyBtn = document.getElementById('applyPromoBtn');

    if (promoCodeInput) promoCodeInput.value = '';
    if (promoCodeInput) promoCodeInput.disabled = false;
    if (applyBtn) {
        applyBtn.textContent = '套用';
        applyBtn.onclick = applyPromoCode;
    }
    if (promoMessageDiv) {
        promoMessageDiv.textContent = '';
        promoMessageDiv.className = 'promo-message';
    }

    updateOrderDisplay();
    updateTotalAmount();
    updateFloatingCartBadge();

    // 重設表單
    document.getElementById('orderForm').reset();

    // 重新設定今日日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    document.getElementById('dateSelect').value = todayString;
    document.getElementById('pickupDate').value = todayString;

    // 重設外送選項
    updateDeliveryOptions();

    // 重設地址選項
    const citySelect = document.getElementById('citySelect');
    const districtSelect = document.getElementById('districtSelect');
    const detailAddress = document.getElementById('detailAddress');

    citySelect.selectedIndex = 0;
    districtSelect.selectedIndex = 0;
    districtSelect.disabled = true;
    detailAddress.value = '';

    // 確保提交按鈕恢復正常狀態
    const submitButton = document.querySelector('.submit-button');
    if (submitButton) {
        submitButton.textContent = '提交訂單';
        submitButton.disabled = false;
    }

    isFirstTimeAddingProduct = true;
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

// 更新取貨方式選項
function updateDeliveryOptions() {
    const pickupDateInput = document.getElementById('pickupDate');
    const deliveryMethodSelect = document.getElementById('deliveryMethod');

    if (!pickupDateInput.value) {
        deliveryMethodSelect.innerHTML = '<option value="">請先選擇取貨日期</option>';
        // 沒有日期時，重置地址選項為所有縣市
        populateCityOptions();
        return;
    }

    const selectedDate = new Date(pickupDateInput.value);
    const dayOfWeek = selectedDate.getDay(); // 0=週日, 1=週一, ..., 6=週六

    // 動態計算選定日期的外送數量
    const formattedSelectedDate = formatDateForComparison(pickupDateInput.value);
    const selectedDateDeliveryCount = globalData.dailyDeliveryStats ? (globalData.dailyDeliveryStats[formattedSelectedDate] || 0) : 0;

    // 清空現有選項
    deliveryMethodSelect.innerHTML = '';

    // 週一～週五 (1-5)：顯示新竹選項
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        let options = `
            <option value="">請選擇取貨方式</option>
            <option value="新竹-面交 (19:00)">新竹 - 面交 (19:00)</option>
        `;

        // 檢查外送數量限制
        if (selectedDateDeliveryCount < MAX_DAILY_DELIVERY) {
            options += `<option value="新竹-外送 (20:00~22:00, 須滿$300, 無法指定送達時間)">新竹 - 外送 (20:00~22:00, 須滿$300, 無法指定送達時間)</option>`;
        } else {
            options += `<option value="" disabled>新竹 - 外送 (今日外送已滿)</option>`;
        }

        deliveryMethodSelect.innerHTML = options;

        // 自動更新地址選項為新竹
        populateCityOptions('新竹');
        // 重置地址欄位狀態（因為有面交選項）
        updateAddressRequiredStatus('');
    }
    // 週六、週日 (6, 0)：顯示臺中選項
    else if (dayOfWeek === 6 || dayOfWeek === 0) {
        let options = `<option value="">請選擇取貨方式</option>`;

        // 檢查外送數量限制
        if (selectedDateDeliveryCount < MAX_DAILY_DELIVERY) {
            options += `<option value="臺中-外送 (14:00~16:00, 須滿$300, 無法指定送達時間)">臺中 - 外送 (14:00~16:00, 須滿$300, 無法指定送達時間)</option>`;
        } else {
            options += `<option value="" disabled>臺中 - 外送 (今日外送已滿)</option>`;
        }

        deliveryMethodSelect.innerHTML = options;
        // 自動更新地址選項為臺中
        populateCityOptions('臺中');
        // 設定地址為必填（只有外送選項）
        updateAddressRequiredStatus('外送');
    }
}

// 載入台灣地址資料
async function loadTaiwanAddressData() {
    try {
        // const response = await fetch('https://raw.githubusercontent.com/donma/TaiwanAddressCityAreaRoadChineseEnglishJSON/master/CityCountyData.json');
        // taiwanAddressData = await response.json();
        // 使用簡化資料
        taiwanAddressData = getBackupAddressData();
        populateCityOptions();
    } catch (error) {
        console.error('載入地址資料失敗:', error);
        // 使用備用的簡化資料
        taiwanAddressData = getBackupAddressData();
        populateCityOptions();
    }
}

// 填充縣市選項
function populateCityOptions(filterByDeliveryMethod = null) {
    const citySelect = document.getElementById('citySelect');
    if (!citySelect || !taiwanAddressData) return;

    citySelect.innerHTML = '<option value="">請選擇縣市</option>';

    // 根據交易方式篩選可選縣市
    let allowedCities = [];
    if (filterByDeliveryMethod) {
        if (filterByDeliveryMethod.includes('新竹')) {
            allowedCities = ['新竹市', '新竹縣'];
        } else if (filterByDeliveryMethod.includes('臺中')) {
            allowedCities = ['臺中市'];
        }
    }

    taiwanAddressData.forEach(city => {
        // 如果有篩選條件且該城市不在允許列表中，則跳過
        if (allowedCities.length > 0 && !allowedCities.includes(city.CityName)) {
            return;
        }

        const option = document.createElement('option');
        option.value = city.CityName;
        option.textContent = city.CityName;
        citySelect.appendChild(option);
    });

    // 清空區域選項當縣市選項改變時
    const districtSelect = document.getElementById('districtSelect');
    if (districtSelect) {
        districtSelect.innerHTML = '<option value="">請先選擇縣市</option>';
        districtSelect.disabled = true;
    }
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
            "CityName": "新竹市",
            "AreaList": [
                {"AreaName": "東區"}, {"AreaName": "北區"}, {"AreaName": "香山區"}
            ]
        },
        {
            "CityName": "新竹縣",
            "AreaList": [
                {"AreaName": "寶山鄉"},
                {"AreaName": "竹北市"},
                {"AreaName": "湖口鄉"},
                {"AreaName": "新豐鄉"},
                {"AreaName": "新埔鎮"},
                {"AreaName": "關西鎮"},
                {"AreaName": "芎林鄉"},
                {"AreaName": "竹東鎮"},
                // {"AreaName": "五峰鄉"},
                {"AreaName": "橫山鄉"},
                // {"AreaName": "尖石鄉"},
                {"AreaName": "北埔鄉"},
                {"AreaName": "峨眉鄉"}
            ]
        },
        {
            "CityName": "臺中市",
            "AreaList": [
                {"AreaName": "中區"},
                {"AreaName": "東區"},
                {"AreaName": "南區"},
                {"AreaName": "西區"},
                {"AreaName": "北區"},
                {"AreaName": "北屯區"},
                {"AreaName": "西屯區"},
                {"AreaName": "南屯區"},
                {"AreaName": "太平區"},
                {"AreaName": "大里區"},
                {"AreaName": "霧峰區"},
                {"AreaName": "烏日區"},
                {"AreaName": "豐原區"},
                {"AreaName": "后里區"},
                {"AreaName": "石岡區"},
                {"AreaName": "東勢區"},
                {"AreaName": "和平區"},
                {"AreaName": "新社區"},
                {"AreaName": "潭子區"},
                {"AreaName": "大雅區"},
                {"AreaName": "神岡區"},
                {"AreaName": "大肚區"},
                {"AreaName": "沙鹿區"},
                {"AreaName": "龍井區"},
                {"AreaName": "梧棲區"},
                {"AreaName": "清水區"},
                {"AreaName": "大甲區"},
                {"AreaName": "外埔區"},
                {"AreaName": "大安區"}
            ]
        }
    ];
}