const express = require("express");
const router = express.Router();
const lichSoanDoService = require("../services/lichSoanDo.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/save", authMiddleware, lichSoanDoService.createOrUpdate);
router.post("/findAll", authMiddleware, lichSoanDoService.findAll);
router.post("/findByContract", authMiddleware, lichSoanDoService.findByContract);
router.post("/remove", authMiddleware, lichSoanDoService.remove);

module.exports = router;
