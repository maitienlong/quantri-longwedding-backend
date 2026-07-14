const User = require("../models/user.model");

const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.username) {
        return res.status(401).json({ success: false, message: "Không tìm thấy thông tin xác thực" });
      }

      // Lấy thông tin user thời gian thực từ database
      const user = await User.findOne({ username: req.user.username });
      if (!user) {
        return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
      }

      const role = user.positon; // Trường trong database là 'positon' do typo

      // Quản lý luôn có toàn quyền truy cập
      if (role === "Quản lý") {
        return next();
      }

      if (allowedRoles.includes(role)) {
        return next();
      }

      return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện hành động này" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Lỗi hệ thống khi kiểm tra quyền: " + error.message });
    }
  };
};

module.exports = checkRole;
