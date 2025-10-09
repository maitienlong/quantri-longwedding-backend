const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// POST /api/users
router.post("/createUser", authController.createUser);
router.post("/loginUser", authController.loginUser);

module.exports = router;