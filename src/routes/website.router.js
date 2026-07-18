const express = require("express");
const router = express.Router();
const websiteService = require("../services/website.service.js");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const upload = require("../middleware/upload.middleware");

// Route upload ảnh (đặt trước /:section để tránh trùng khớp tham số)
router.post("/upload", authMiddleware, upload.single("image"), websiteService.uploadImage);

// Route công khai để săn Voucher
router.post("/vouchers/claim", websiteService.claimVoucher);

// Public API để website lấy dữ liệu
router.get("/:section", websiteService.getSection);

// API có xác thực để Admin cập nhật nội dung
router.post("/:section", authMiddleware, checkRole(["Quản lý"]), websiteService.updateSection);

// API cho từng item trong section
router.post("/:section/item", authMiddleware, checkRole(["Quản lý"]), websiteService.addSectionItem);
router.put("/:section/item/:id", authMiddleware, checkRole(["Quản lý"]), websiteService.updateSectionItem);
router.delete("/:section/item/:id", authMiddleware, checkRole(["Quản lý"]), websiteService.deleteSectionItem);

// API công khai để gửi yêu cầu đặt lịch/feedback từ website
router.post("/:section/public-item", websiteService.addSectionItemPublic);

module.exports = router;
