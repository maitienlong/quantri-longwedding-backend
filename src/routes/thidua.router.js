const express = require("express");
const router = express.Router();
const thiDuaService = require("../services/thidua.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// POST /api/thi-dua/stats (xem bảng thi đua & KPI cửa hàng + nhân viên)
router.post("/stats", authMiddleware, thiDuaService.getThiDuaStats);

// POST /api/thi-dua/store-target (lấy chỉ tiêu cửa hàng)
router.post("/store-target", authMiddleware, thiDuaService.getStoreTarget);

// POST /api/thi-dua/update-store-target (quản lý cập nhật mục tiêu cửa hàng)
router.post("/update-store-target", authMiddleware, checkRole(["Quản lý"]), thiDuaService.updateStoreTarget);

// POST /api/thi-dua/update-targets (quản lý cập nhật chỉ tiêu nhân viên)
router.post("/update-targets", authMiddleware, checkRole(["Quản lý"]), thiDuaService.updateBatchTargets);

module.exports = router;
