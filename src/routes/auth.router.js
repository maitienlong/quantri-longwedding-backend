const express = require("express");
const router = express.Router();
const authService = require("../services/user.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// POST /api/users
router.post("/createUser", authMiddleware, checkRole(["Quản lý"]), authService.createUser);
router.post("/updateUser", authMiddleware, checkRole(["Quản lý"]), authService.updateUser);
router.post("/removeUser", authMiddleware, checkRole(["Quản lý"]), authService.removeUser);
router.post("/findUsers", authMiddleware, checkRole(["Quản lý"]), authService.findUsers);
router.post("/loginUser", authService.loginUser);

module.exports = router;