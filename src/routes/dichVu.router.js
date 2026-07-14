const express = require("express");
const router = express.Router();
const dichVuService = require("../services/dichVu.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, checkRole(["Nhân viên Sale"]), dichVuService.create);
router.post("/update", authMiddleware, checkRole(["Nhân viên Sale"]), dichVuService.update);
router.post("/remove", authMiddleware, checkRole(["Nhân viên Sale"]), dichVuService.remove);
router.post("/findAll", authMiddleware, checkRole(["Nhân viên Sale"]), dichVuService.find);

module.exports = router;