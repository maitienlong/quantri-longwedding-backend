const express = require("express");
const router = express.Router();
const baoCaoService = require("../services/baoCao.service");
const authMiddleware = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

// POST /api/bao-cao/kinh-doanh (Báo cáo kinh doanh đầy đủ chỉ số & so sánh tuần, tháng, quý, năm)
router.post("/kinh-doanh", authMiddleware, requirePermission("doanhthu"), baoCaoService.getBaoCaoKinhDoanh);

// POST /api/bao-cao/tong-quan (Alias)
router.post("/tong-quan", authMiddleware, requirePermission("doanhthu"), baoCaoService.getBaoCaoKinhDoanh);

// POST & GET /api/bao-cao/lich-su-thanh-toan (Tổng hợp bảng lịch sử khách hàng thanh toán)
router.post("/lich-su-thanh-toan", authMiddleware, requirePermission("doanhthu"), baoCaoService.getLichSuThanhToan);
router.get("/lich-su-thanh-toan", authMiddleware, requirePermission("doanhthu"), baoCaoService.getLichSuThanhToan);

// POST & GET /api/bao-cao/thong-ke-khach-hang (Thống kê khách hàng theo ngày/tuần/tháng/năm)
router.post("/thong-ke-khach-hang", authMiddleware, requirePermission("quanlykhachhang"), baoCaoService.getThongKeKhachHang);
router.get("/thong-ke-khach-hang", authMiddleware, requirePermission("quanlykhachhang"), baoCaoService.getThongKeKhachHang);

module.exports = router;
