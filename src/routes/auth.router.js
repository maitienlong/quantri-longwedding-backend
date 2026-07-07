const express = require("express");
const router = express.Router();
const authService = require("../services/user.service");
const authMiddleware = require("../middleware/auth.middleware");

// POST /api/users
router.post("/createUser", authMiddleware, authService.createUser);
router.post("/updateUser", authMiddleware, authService.updateUser);
router.post("/removeUser", authMiddleware, authService.removeUser);
router.post("/findUsers", authMiddleware, authService.findUsers);
router.post("/loginUser", authService.loginUser);

module.exports = router;