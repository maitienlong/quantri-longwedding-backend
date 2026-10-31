const express = require("express");
const router = express.Router();
const leadService = require("../services/lead.service");
const authMiddleware = require("../middleware/auth.middleware");

// Endpoint tạo lead công khai từ webhook n8n / bot / web form (không bắt buộc token nếu n8n gọi)
router.post("/webhook-create", leadService.create);

router.get("/list", authMiddleware, leadService.list);
router.post("/list", authMiddleware, leadService.list);
router.post("/create", authMiddleware, leadService.create);
router.post("/update", authMiddleware, leadService.update);
router.post("/convert", authMiddleware, leadService.convertToContract);

module.exports = router;
