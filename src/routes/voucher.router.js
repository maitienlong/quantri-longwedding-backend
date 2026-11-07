const express = require("express");
const router = express.Router();
const voucherService = require("../services/voucher.service");
const authMiddleware = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

// Public / Authenticated endpoints
router.post("/validate", authMiddleware, voucherService.validateVoucher);
router.post("/list", authMiddleware, voucherService.findAll);
router.get("/detail/:id", authMiddleware, voucherService.getById);

// MOD-10: Quản lý Voucher với phân quyền chi tiết 'quanlyvoucher'
router.post("/create", authMiddleware, requirePermission("quanlyvoucher"), voucherService.create);
router.put("/update/:id", authMiddleware, requirePermission("quanlyvoucher"), voucherService.update);
router.delete("/remove/:id", authMiddleware, requirePermission("quanlyvoucher"), voucherService.remove);
router.post("/toggle-status/:id", authMiddleware, requirePermission("quanlyvoucher"), voucherService.toggleStatus);

// Batch code generation & subcode management
router.post("/generate-codes/:id", authMiddleware, requirePermission("quanlyvoucher"), voucherService.generateBatchCodes);
router.get("/codes/:id", authMiddleware, requirePermission("quanlyvoucher"), voucherService.getGeneratedCodes);
router.delete("/codes/:id/:codeId", authMiddleware, requirePermission("quanlyvoucher"), voucherService.deleteGeneratedCode);

module.exports = router;
