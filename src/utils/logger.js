const Log = require('../models/log.model');

/**
 * Ghi nhật ký thao tác người dùng trên hệ thống
 * @param {Object} params
 * @param {string} params.action - Tên hành động (vd: "Tạo hợp đồng", "Đăng nhập")
 * @param {string} [params.user] - Tên người thực hiện (tự động lấy từ req.user nếu có)
 * @param {Object} [params.req] - Express request object để lấy IP, User-Agent, user
 * @param {Object|string} [params.details] - Chi tiết thao tác
 */
async function createLog({ action, user, req, details }) {
    try {
        let ipAddress = '';
        let deviceInfo = '';
        let userName = user;

        if (req) {
            const forwarded = req.headers['x-forwarded-for'];
            ipAddress = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '');
            deviceInfo = req.headers['user-agent'] || '';
            
            if (!userName) {
                userName = req.user?.fullname || req.user?.username || req.body?.user || req.body?.createBy || req.body?.creator || 'Hệ thống';
            }
        }

        const newLog = new Log({
            action: action || 'Thao tác hệ thống',
            user: userName || 'Hệ thống',
            ipAddress,
            deviceInfo,
            details: details || {}
        });

        await newLog.save();
        return newLog;
    } catch (err) {
        console.error('Lỗi khi ghi nhật ký hệ thống:', err.message);
    }
}

module.exports = { createLog };
