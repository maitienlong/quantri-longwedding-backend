const express = require("express");
const router = express.Router();
const chiTieuService = require("../services/chiTieu.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, checkRole(["Quản lý"]), chiTieuService.create);
router.post("/update", authMiddleware, checkRole(["Quản lý"]), chiTieuService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), chiTieuService.remove);
router.post("/findAll", authMiddleware, checkRole(["Quản lý"]), chiTieuService.find);

module.exports = router;
