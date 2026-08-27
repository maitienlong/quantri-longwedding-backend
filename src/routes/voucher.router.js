const express = require("express");
const router = express.Router();
const voucherService = require("../services/voucher.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// Public / Authenticated endpoints
router.post("/validate", authMiddleware, voucherService.validateVoucher);
router.post("/list", authMiddleware, voucherService.findAll);
router.get("/detail/:id", authMiddleware, voucherService.getById);

// Admin-only management endpoints
router.post("/create", authMiddleware, checkRole(["Quản lý"]), voucherService.create);
router.put("/update/:id", authMiddleware, checkRole(["Quản lý"]), voucherService.update);
router.delete("/remove/:id", authMiddleware, checkRole(["Quản lý"]), voucherService.remove);
router.post("/toggle-status/:id", authMiddleware, checkRole(["Quản lý"]), voucherService.toggleStatus);

// Batch code generation & subcode management
router.post("/generate-codes/:id", authMiddleware, checkRole(["Quản lý"]), voucherService.generateBatchCodes);
router.get("/codes/:id", authMiddleware, checkRole(["Quản lý"]), voucherService.getGeneratedCodes);
router.delete("/codes/:id/:codeId", authMiddleware, checkRole(["Quản lý"]), voucherService.deleteGeneratedCode);

module.exports = router;
