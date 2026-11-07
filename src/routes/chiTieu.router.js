const express = require("express");
const router = express.Router();
const chiTieuService = require("../services/chiTieu.service");
const authMiddleware = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

// Áp dụng bảo vệ phân quyền chi tiết cho nghiệp vụ quản lý chi tiêu (MOD-10)
router.post("/create", authMiddleware, requirePermission("quanlychitieu"), chiTieuService.create);
router.post("/update", authMiddleware, requirePermission("quanlychitieu"), chiTieuService.update);
router.post("/remove", authMiddleware, requirePermission("quanlychitieu"), chiTieuService.remove);
router.post("/findAll", authMiddleware, requirePermission("quanlychitieu"), chiTieuService.find);
router.get("/findAll", authMiddleware, requirePermission("quanlychitieu"), chiTieuService.find);

module.exports = router;
