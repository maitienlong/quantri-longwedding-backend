const express = require("express");
const router = express.Router();
const loaiHopDongService = require("../services/loaiHopDong.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/findAll", authMiddleware, loaiHopDongService.find);
router.post("/create", authMiddleware, checkRole(["Quản lý"]), loaiHopDongService.create);
router.post("/update", authMiddleware, checkRole(["Quản lý"]), loaiHopDongService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), loaiHopDongService.remove);

module.exports = router;
