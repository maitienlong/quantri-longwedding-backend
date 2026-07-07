const express = require("express");
const router = express.Router();
const khachHangService = require("../services/khachHang.service.js");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, khachHangService.create);
router.post("/find", authMiddleware, khachHangService.find);
router.post("/update", authMiddleware, khachHangService.update);
router.post("/remove", authMiddleware, khachHangService.remove);

module.exports = router;