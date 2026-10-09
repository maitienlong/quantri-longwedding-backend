const express = require("express");
const router = express.Router();
const khachHangService = require("../services/khachHang.service.js");
const baoCaoService = require("../services/baoCao.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, khachHangService.create);
router.post("/find", authMiddleware, khachHangService.find);
router.post("/update", authMiddleware, khachHangService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), khachHangService.remove);
router.post("/get-facebook-info", authMiddleware, khachHangService.getFacebookInfo);
router.post("/login", khachHangService.login);
router.post("/register", khachHangService.register);

// Lịch sử thanh toán & Thống kê khách hàng
router.post("/lich-su-thanh-toan", authMiddleware, baoCaoService.getLichSuThanhToan);
router.get("/lich-su-thanh-toan", authMiddleware, baoCaoService.getLichSuThanhToan);
router.post("/thong-ke", authMiddleware, baoCaoService.getThongKeKhachHang);
router.get("/thong-ke", authMiddleware, baoCaoService.getThongKeKhachHang);

module.exports = router;