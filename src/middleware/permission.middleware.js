const User = require("../models/user.model");

/**
 * Helper kiểm tra quyền của user theo chuẩn hệ thống Long Wedding
 */
function checkUserPermission(user, permissionKey) {
    if (!user) return false;

    // 1. Quản lý / Admin / Superadmin luôn có toàn quyền tuyệt đối
    const role = user.positon || user.role;
    if (
        user.username === 'along' ||
        role === 'Quản lý' ||
        role === 'Admin' ||
        role === 'Quản trị viên' ||
        user.permission === 1
    ) {
        return true;
    }

    // 2. Kiểm tra mảng permissions cấu hình chi tiết
    if (Array.isArray(user.permissions)) {
        if (user.permissions.includes('*') || user.permissions.includes('all')) {
            return true;
        }
        return user.permissions.includes(permissionKey);
    }

    // 3. Fallback cho tài khoản nhân viên cũ chưa cấu hình mảng permissions
    // LƯU Ý: Tuyệt đối KHÔNG bao gồm 'phan-cong-tho', 'quanlychitieu', 'doanhthu', 'quanlynhanvien'
    const defaultStaffPermissions = ['tongquan', 'banhang', 'lichcuahang', 'lichSoanDo'];
    return defaultStaffPermissions.includes(permissionKey);
}

/**
 * Middleware yêu cầu quyền hạn chi tiết (MOD-10 Granular RBAC)
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.username) {
                return res.status(401).json({
                    success: false,
                    message: "Yêu cầu đăng nhập để truy cập tài nguyên"
                });
            }

            // Nếu req.user đã có permissions và positon (được gắn từ authMiddleware)
            let user = req.user;

            // Nếu thiếu thông tin permissions, truy vấn từ database
            if (!user.permissions || !user.positon) {
                const dbUser = await User.findOne({ username: req.user.username });
                if (!dbUser) {
                    return res.status(404).json({
                        success: false,
                        message: "Người dùng không tồn tại"
                    });
                }
                user = dbUser;
                req.user.permissions = dbUser.permissions;
                req.user.positon = dbUser.positon;
                req.user.permission = dbUser.permission;
            }

            if (checkUserPermission(user, permissionKey)) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện hành động này",
                requiredPermission: permissionKey
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi hệ thống khi kiểm tra quyền: " + error.message
            });
        }
    };
};

/**
 * Middleware yêu cầu ít nhất một trong các quyền trong danh sách
 */
const requireAnyPermission = (permissionKeys = []) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.username) {
                return res.status(401).json({
                    success: false,
                    message: "Yêu cầu đăng nhập để truy cập tài nguyên"
                });
            }

            let user = req.user;
            if (!user.permissions || !user.positon) {
                const dbUser = await User.findOne({ username: req.user.username });
                if (!dbUser) {
                    return res.status(404).json({
                        success: false,
                        message: "Người dùng không tồn tại"
                    });
                }
                user = dbUser;
                req.user.permissions = dbUser.permissions;
                req.user.positon = dbUser.positon;
                req.user.permission = dbUser.permission;
            }

            const hasAny = permissionKeys.some(key => checkUserPermission(user, key));
            if (hasAny) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện hành động này",
                requiredPermissions: permissionKeys
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi hệ thống khi kiểm tra quyền: " + error.message
            });
        }
    };
};

module.exports = {
    requirePermission,
    requireAnyPermission,
    checkUserPermission
};
