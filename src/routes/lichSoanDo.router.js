const express = require("express");
const router = express.Router();
const lichSoanDoService = require("../services/lichSoanDo.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/save", authMiddleware, checkRole(["Nhân viên Sale"]), lichSoanDoService.createOrUpdate);
router.post("/findAll", authMiddleware, checkRole(["Nhân viên Sale"]), lichSoanDoService.findAll);
router.post("/findByContract", authMiddleware, checkRole(["Nhân viên Sale"]), lichSoanDoService.findByContract);
router.post("/remove", authMiddleware, checkRole(["Nhân viên Sale"]), lichSoanDoService.remove);

module.exports = router;
