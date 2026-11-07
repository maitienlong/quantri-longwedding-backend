const express = require("express");
const router = express.Router();
const loaiDichVuService = require("../services/loaiDichVu.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/findAll", authMiddleware, loaiDichVuService.find);
router.get("/findAll", authMiddleware, loaiDichVuService.find);
router.get("/list", authMiddleware, loaiDichVuService.find);
router.post("/create", authMiddleware, checkRole(["Quản lý"]), loaiDichVuService.create);
router.post("/update", authMiddleware, checkRole(["Quản lý"]), loaiDichVuService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), loaiDichVuService.remove);
router.delete("/:id", authMiddleware, checkRole(["Quản lý"]), loaiDichVuService.remove);

module.exports = router;
