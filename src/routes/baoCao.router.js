const express = require("express");
const router = express.Router();
const baoCaoService = require("../services/baoCao.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// POST /api/bao-cao/kinh-doanh (Báo cáo kinh doanh đầy đủ chỉ số & so sánh tuần, tháng, quý, năm)
router.post("/kinh-doanh", authMiddleware, checkRole(["Quản lý"]), baoCaoService.getBaoCaoKinhDoanh);

// POST /api/bao-cao/tong-quan (Alias)
router.post("/tong-quan", authMiddleware, checkRole(["Quản lý"]), baoCaoService.getBaoCaoKinhDoanh);

module.exports = router;
