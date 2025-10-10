const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET;

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // lấy phần sau "Bearer"

  if (!token) {
    return res.status(401).json({ success: false, message: "Không có token, vui lòng đăng nhập" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // lưu thông tin user vào req để controller có thể dùng
    next(); // cho phép đi tiếp
  } catch (err) {
    return res.status(403).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
