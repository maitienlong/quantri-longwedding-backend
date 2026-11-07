const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const authService = require("../services/user.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
      req.user = decoded;
    } catch (e) {
      // Bỏ qua lỗi token để logout vẫn hoàn tất
    }
  }
  next();
};

// POST /auth/*
router.post("/createUser", authMiddleware, requirePermission("quanlynhanvien"), authService.createUser);
router.post("/updateUser", authMiddleware, authService.updateUser);
router.post("/updateUserPermissions", authMiddleware, requirePermission("quanlynhanvien"), authService.updateUserPermissions);
router.post("/removeUser", authMiddleware, requirePermission("quanlynhanvien"), authService.removeUser);
router.post("/findUsers", authMiddleware, authService.findUsers);
router.post("/loginUser", authService.loginUser);
router.post("/refreshToken", authService.refreshToken);
router.post("/logout", optionalAuth, authService.logoutUser);
router.post("/logoutUser", optionalAuth, authService.logoutUser);

module.exports = router;
