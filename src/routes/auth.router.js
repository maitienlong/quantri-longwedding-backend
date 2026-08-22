const express = require("express");
const router = express.Router();
const authService = require("../services/user.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// POST /api/users
router.post("/createUser", authMiddleware, checkRole(["Quản lý"]), authService.createUser);
router.post("/updateUser", authMiddleware, authService.updateUser);
router.post("/removeUser", authMiddleware, checkRole(["Quản lý"]), authService.removeUser);
router.post("/findUsers", authMiddleware, authService.findUsers);
router.post("/loginUser", authService.loginUser);

module.exports = router;