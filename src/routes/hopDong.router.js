const express = require("express");
const router = express.Router();
const hopDongService = require("../services/hopDong.service.js");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, checkRole(["Nhân viên Sale"]), hopDongService.create);
router.post("/update", authMiddleware, checkRole(["Nhân viên Sale", "Thợ chụp hình", "Thợ trang điểm", "Thợ chỉnh ảnh"]), hopDongService.update);
router.post("/pay", authMiddleware, checkRole(["Nhân viên Sale"]), hopDongService.pay);
router.post("/remove", authMiddleware, checkRole(["Nhân viên Sale"]), hopDongService.remove);
router.post("/update-progress", authMiddleware, checkRole(["Nhân viên Sale"]), hopDongService.updateProgress);
router.post("/list", authMiddleware, checkRole(["Nhân viên Sale", "Thợ chụp hình", "Thợ trang điểm", "Thợ chỉnh ảnh"]), hopDongService.list);
router.post("/search", authMiddleware, checkRole(["Nhân viên Sale", "Thợ chụp hình", "Thợ trang điểm", "Thợ chỉnh ảnh"]), hopDongService.search);
router.post("/customer-contracts", authMiddleware, hopDongService.getCustomerContracts);

module.exports = router;