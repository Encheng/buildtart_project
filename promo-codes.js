// 優惠碼配置檔案
const PROMO_CODES = {
    // 優惠碼格式：
    // 'CODE': {
    //     name: '優惠活動名稱',
    //     discount: 折扣金額,
    //     minOrder: 最低訂單金額,
    //     active: 是否啟用,
    //     description: '描述'
    // }
    
    'WELCOME50': {
        name: '新客優惠',
        discount: 50,
        minOrder: 400,
        active: true,
        description: '滿$400折$50'
    },
    
    'VIP50': {
        name: 'VIP優惠',
        discount: 50,
        minOrder: 400,
        active: true,
        description: '滿$400折$50'
    },
    
    // 可以加入更多優惠碼
    'FRIEND50': {
        name: '朋友推薦',
        discount: 50,
        minOrder: 400,
        active: true,
        description: '滿$400折$50'
    }
};

// 驗證優惠碼函數
function validatePromoCode(code, orderTotal) {
    const upperCode = code.toUpperCase();
    const promoConfig = PROMO_CODES[upperCode];
    
    if (!promoConfig) {
        return {
            valid: false,
            message: '優惠碼不存在'
        };
    }
    
    if (!promoConfig.active) {
        return {
            valid: false,
            message: '此優惠碼已過期'
        };
    }
    
    if (orderTotal < promoConfig.minOrder) {
        return {
            valid: false,
            message: `訂單金額需滿 NT$${promoConfig.minOrder} 才可使用此優惠碼`
        };
    }
    
    return {
        valid: true,
        message: `成功套用 ${promoConfig.name}！`,
        discount: promoConfig.discount,
        name: promoConfig.name,
        description: promoConfig.description
    };
}