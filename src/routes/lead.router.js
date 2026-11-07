const express = require("express");
const router = express.Router();
const leadService = require("../services/lead.service");
const authMiddleware = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

// Endpoint tạo lead từ webhook n8n / bot / web form (xác thực an toàn nếu cấu hình secret)
router.post("/webhook-create", leadService.webhookCreate);

// MOD-10: Bảo vệ phân quyền chi tiết cho nghiệp vụ Quản lý Lead
router.get("/list", authMiddleware, requirePermission("leads"), leadService.list);
router.post("/list", authMiddleware, requirePermission("leads"), leadService.list);
router.post("/create", authMiddleware, requirePermission("leads"), leadService.create);
router.post("/update", authMiddleware, requirePermission("leads"), leadService.update);
router.post("/convert", authMiddleware, requirePermission("leads"), leadService.convertToContract);
router.post("/merge-customers", authMiddleware, requirePermission("leads"), leadService.mergeCustomers);

module.exports = router;
