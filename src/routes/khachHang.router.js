const express = require("express");
const router = express.Router();
const khachHangService = require("../services/khachHang.service.js");
const baoCaoService = require("../services/baoCao.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { requirePermission, requireAnyPermission } = require("../middleware/permission.middleware");

// MOD-10: Bảo vệ phân quyền CRM Khách hàng
router.post("/create", authMiddleware, requireAnyPermission(["quanlykhachhang", "banhang", "leads"]), khachHangService.create);
router.post("/find", authMiddleware, requireAnyPermission(["quanlykhachhang", "banhang", "leads"]), khachHangService.find);
router.post("/update", authMiddleware, requireAnyPermission(["quanlykhachhang", "banhang", "leads"]), khachHangService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), khachHangService.remove);
router.post("/get-facebook-info", authMiddleware, requireAnyPermission(["quanlykhachhang", "banhang", "leads"]), khachHangService.getFacebookInfo);
router.post("/login", khachHangService.login);
router.post("/register", khachHangService.register);
router.post("/merge", authMiddleware, requirePermission("quanlykhachhang"), khachHangService.mergeCustomers);

// Lịch sử thanh toán & Thống kê khách hàng
router.post("/lich-su-thanh-toan", authMiddleware, requireAnyPermission(["doanhthu", "quanlykhachhang"]), baoCaoService.getLichSuThanhToan);
router.get("/lich-su-thanh-toan", authMiddleware, requireAnyPermission(["doanhthu", "quanlykhachhang"]), baoCaoService.getLichSuThanhToan);
router.post("/thong-ke", authMiddleware, requirePermission("quanlykhachhang"), baoCaoService.getThongKeKhachHang);
router.get("/thong-ke", authMiddleware, requirePermission("quanlykhachhang"), baoCaoService.getThongKeKhachHang);

module.exports = router;
