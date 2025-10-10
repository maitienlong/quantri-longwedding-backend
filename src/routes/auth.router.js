const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// POST /api/users
router.post("/createUser",authMiddleware, authController.createUser);
router.post("/loginUser", authController.loginUser);

module.exports = router;