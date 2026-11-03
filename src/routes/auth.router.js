const express = require("express");
const router = express.Router();
const authService = require("../services/user.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

// POST /auth/*
router.post("/createUser", authMiddleware, checkRole(["Quản lý"]), authService.createUser);
router.post("/updateUser", authMiddleware, authService.updateUser);
router.post("/updateUserPermissions", authMiddleware, checkRole(["Quản lý"]), authService.updateUserPermissions);
router.post("/removeUser", authMiddleware, checkRole(["Quản lý"]), authService.removeUser);
router.post("/findUsers", authMiddleware, authService.findUsers);
router.post("/loginUser", authService.loginUser);
router.post("/refreshToken", authService.refreshToken);

module.exports = router;
