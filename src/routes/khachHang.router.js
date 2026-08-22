const express = require("express");
const router = express.Router();
const khachHangService = require("../services/khachHang.service.js");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, khachHangService.create);
router.post("/find", authMiddleware, khachHangService.find);
router.post("/update", authMiddleware, khachHangService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), khachHangService.remove);
router.post("/get-facebook-info", authMiddleware, khachHangService.getFacebookInfo);
router.post("/login", khachHangService.login);

module.exports = router;