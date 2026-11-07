/**
 * phoneUtils.js
 * Vietnamese Phone Number Normalization & Validation Utility
 */

/**
 * Chuẩn hóa số điện thoại về định dạng chuẩn Việt Nam (09xxxxxxxx)
 * 
 * @param {string} phone - Số điện thoại thô
 * @returns {string} Số điện thoại đã chuẩn hóa
 */
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return '';

    // Loại bỏ mọi ký tự không phải số hoặc dấu +
    let cleaned = phone.trim().replace(/[^0-9+]/g, '');

    // Chuẩn hóa tiền tố quốc tế +84 hoặc 84
    if (cleaned.startsWith('+84')) {
        cleaned = '0' + cleaned.slice(3);
    } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
        cleaned = '0' + cleaned.slice(2);
    }

    // Loại bỏ dấu + còn lại nếu có
    cleaned = cleaned.replace(/\+/g, '');

    return cleaned;
}

/**
 * Kiểm tra xem số điện thoại có phải định dạng di động Việt Nam hợp lệ hay không
 * 
 * @param {string} phone - Số điện thoại
 * @returns {boolean}
 */
function isValidVietnamPhone(phone) {
    const normalized = normalizePhoneNumber(phone);
    // Đầu số di động Việt Nam gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09
    const regex = /^0(3|5|7|8|9)[0-9]{8}$/;
    return regex.test(normalized);
}

module.exports = {
    normalizePhoneNumber,
    isValidVietnamPhone
};

