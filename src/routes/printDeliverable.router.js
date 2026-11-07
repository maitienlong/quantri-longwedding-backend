const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const printDeliverableService = require("../services/printDeliverable.service");

// Áp dụng authMiddleware cho tất cả các endpoint quản lý in ấn
router.use(authMiddleware);

// Danh sách & Chi tiết
router.get("/", printDeliverableService.listDeliverables);
router.get("/:id", printDeliverableService.getDeliverableDetail);

// Tạo mới & Cập nhật thông số
router.post("/", printDeliverableService.createDeliverable);
router.put("/:id", printDeliverableService.updateDeliverable);

// Luồng theo dõi xưởng gia công
router.post("/:id/send-to-factory", printDeliverableService.sendToFactory);
router.post("/:id/receive", printDeliverableService.receiveFromFactory);

// Cổng nghiệm thu chất lượng (QC Gate - T-PRINT01)
router.post("/:id/qc-inspect", printDeliverableService.inspectQC);
router.post("/:id/qc-override", printDeliverableService.overrideQC);

// Bàn giao cho khách hàng
router.post("/:id/handover", printDeliverableService.handoverToClient);

// Tự động đồng bộ sản phẩm in ấn từ hợp đồng
router.post("/contracts/:contractId/sync", printDeliverableService.syncDeliverablesFromContract);

module.exports = router;

