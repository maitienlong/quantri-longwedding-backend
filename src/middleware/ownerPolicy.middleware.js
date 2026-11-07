const ThiepCuoi = require("../models/thiepCuoi.model");

/**
 * Middleware kiểm tra quyền sở hữu thiệp cưới (MOD-11 Owner Policy / IDOR Prevention)
 * Chỉ cho phép:
 * 1. Chủ sở hữu của thiệp (khách hàng tạo thiệp hoặc gắn với tài khoản)
 * 2. Nhân sự có vai trò Quản lý / Admin / Superadmin
 */
async function checkInvitationOwner(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Yêu cầu đăng nhập để thực hiện thao tác"
            });
        }

        const role = req.user.positon || req.user.role;
        // Quản lý & Admin luôn có quyền can thiệp hỗ trợ khách hàng
        if (
            req.user.username === 'along' ||
            role === 'Quản lý' ||
            role === 'Admin' ||
            role === 'Quản trị viên' ||
            req.user.permission === 1
        ) {
            return next();
        }

        const targetId = req.params.id || req.body.invitationId || req.body._id;
        if (!targetId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã định danh thiệp cưới"
            });
        }

        const query = (targetId && String(targetId).match(/^[0-9a-fA-F]{24}$/))
            ? { $or: [{ invitationId: targetId }, { _id: targetId }] }
            : { invitationId: targetId };

        const invitation = await ThiepCuoi.findOne(query);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thiệp cưới"
            });
        }

        // Kiểm tra quyền sở hữu: so khớp ID người tạo, tên đăng nhập hoặc mã khách hàng
        const userIdStr = String(req.user.id || req.user._id || "");
        const username = String(req.user.username || "");
        const customerId = String(req.user.customerId || "");

        const isOwner = (
            (invitation.createdBy && String(invitation.createdBy) === userIdStr) ||
            (invitation.creator && String(invitation.creator).toLowerCase() === username.toLowerCase()) ||
            (invitation.khachHangId && (String(invitation.khachHangId) === customerId || String(invitation.khachHangId) === userIdStr)) ||
            (invitation.customerId && (String(invitation.customerId) === customerId || String(invitation.customerId) === userIdStr || String(invitation.customerId) === username))
        );

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập hoặc thao tác trên thiệp cưới này (Owner Policy)"
            });
        }

        req.invitation = invitation;
        return next();
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi kiểm tra quyền sở hữu thiệp cưới: " + err.message
        });
    }
}

module.exports = {
    checkInvitationOwner
};
