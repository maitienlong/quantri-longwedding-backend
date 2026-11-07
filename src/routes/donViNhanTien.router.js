const express = require("express");
const router = express.Router();
const donViNhanTienService = require("../services/donViNhanTien.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/findAll", authMiddleware, donViNhanTienService.find);
router.get("/findAll", authMiddleware, donViNhanTienService.find);
router.get("/list", authMiddleware, donViNhanTienService.find);
router.post("/create", authMiddleware, checkRole(["Quản lý"]), donViNhanTienService.create);
router.post("/update", authMiddleware, checkRole(["Quản lý"]), donViNhanTienService.update);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), donViNhanTienService.remove);
router.delete("/:id", authMiddleware, checkRole(["Quản lý"]), donViNhanTienService.remove);

module.exports = router;
