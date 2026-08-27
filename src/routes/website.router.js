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
router.post("/vouchers/validate", websiteService.validateVoucherPublic);

// ==========================================
// ROUTES ĐẠI LỄ QUỐC KHÁNH 2/9 (/quoc-khanh)
// ==========================================
// 1. Công khai (Public)
router.get("/quoc-khanh/all-data", websiteService.getQuocKhanhAllData);
router.post("/quoc-khanh/tribute", websiteService.addQuocKhanhTribute);
router.post("/quoc-khanh/light-flag", websiteService.incrementQuocKhanhFlag);
router.post("/quoc-khanh/booking", websiteService.addQuocKhanhBooking);
router.post("/quoc-khanh/claim-gift", websiteService.claimQuocKhanhGift);

// 2. Quản trị viên (Admin)
router.delete("/quoc-khanh/messages/:id", authMiddleware, checkRole(["Quản lý"]), websiteService.deleteQuocKhanhMessage);
router.put("/quoc-khanh/flags", authMiddleware, checkRole(["Quản lý"]), websiteService.updateQuocKhanhFlags);
router.put("/quoc-khanh/deals", authMiddleware, checkRole(["Quản lý"]), websiteService.updateQuocKhanhDeals);
router.put("/quoc-khanh/gifts", authMiddleware, checkRole(["Quản lý"]), websiteService.updateQuocKhanhGifts);

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
