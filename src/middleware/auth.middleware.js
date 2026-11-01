const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const SECRET_KEY = process.env.JWT_SECRET;

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // lấy phần sau "Bearer"

  if (!token) {
    return res.status(401).json({ success: false, message: "Không có token, vui lòng đăng nhập" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // lưu thông tin user vào req để controller có thể dùng

    // Đảm bảo req.user luôn có đầy đủ chức vụ và quyền hạn từ database nếu token cũ thiếu
    if (decoded && decoded.username && (!decoded.positon || decoded.permission === undefined)) {
      try {
        const dbUser = await User.findOne({ username: decoded.username }).select('username fullname positon permission');
        if (dbUser) {
          req.user = {
            ...decoded,
            positon: dbUser.positon,
            permission: dbUser.permission
          };
        }
      } catch (dbErr) {
        // bỏ qua lỗi db phụ
      }
    }

    next(); // cho phép đi tiếp
  } catch (err) {
    return res.status(403).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
