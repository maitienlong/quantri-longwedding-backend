const express = require("express");
const router = express.Router();
const khachHangService = require("../services/khachHang.service.js");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, checkRole(["Nhân viên Sale"]), khachHangService.create);
router.post("/find", authMiddleware, checkRole(["Nhân viên Sale"]), khachHangService.find);
router.post("/update", authMiddleware, checkRole(["Nhân viên Sale"]), khachHangService.update);
router.post("/remove", authMiddleware, checkRole(["Nhân viên Sale"]), khachHangService.remove);

module.exports = router;