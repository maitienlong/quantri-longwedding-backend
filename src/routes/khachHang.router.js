const express = require("express");
const router = express.Router();
const khachHangController = require("../controllers/khachHang.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, khachHangController.taoKhachHang);
router.post("/listAll", authMiddleware, khachHangController.listAll);
router.post("/findOne", authMiddleware, khachHangController.findOne);

module.exports = router;