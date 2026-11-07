const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

module.exports = async function authMiddleware(req, res, next) {
  const secretKey = process.env.JWT_SECRET;
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // lấy phần sau "Bearer"

  if (!token) {
    return res.status(401).json({ success: false, message: "Không có token, vui lòng đăng nhập" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded; // lưu thông tin user vào req để controller có thể dùng

    // Đảm bảo req.user luôn có đầy đủ chức vụ và quyền hạn từ database
    if (decoded && decoded.username) {
      try {
        const dbUser = await User.findOne({ username: decoded.username }).select('username fullname positon permission permissions tokenVersion');
        if (!dbUser) {
          return res.status(401).json({ success: false, message: "Tài khoản không còn tồn tại trên hệ thống" });
        }

        // Kiểm tra xem phiên có bị thu hồi qua Token Version không
        if (decoded.tokenVersion !== undefined && dbUser.tokenVersion !== undefined && decoded.tokenVersion !== dbUser.tokenVersion) {
          return res.status(401).json({ success: false, message: "Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại" });
        }

        req.user = {
          ...decoded,
          id: dbUser._id,
          positon: dbUser.positon,
          permission: dbUser.permission,
          permissions: dbUser.permissions || [],
          tokenVersion: dbUser.tokenVersion
        };
      } catch (dbErr) {
        // bỏ qua lỗi db phụ
      }
    }

    next(); // cho phép đi tiếp
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
