const express = require("express");
const router = express.Router();
const thiDuaService = require("../services/thidua.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// POST /api/thi-dua/stats (cho phép tất cả user đã đăng nhập xem thông tin thi đua)
router.post("/stats", authMiddleware, thiDuaService.getThiDuaStats);

// POST /api/thi-dua/update-targets (chỉ Quản lý mới được sửa chỉ tiêu)
router.post("/update-targets", authMiddleware, checkRole(["Quản lý"]), thiDuaService.updateBatchTargets);

module.exports = router;
