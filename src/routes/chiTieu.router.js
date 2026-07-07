const express = require("express");
const router = express.Router();
const chiTieuService = require("../services/chiTieu.service");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, chiTieuService.create);
router.post("/update", authMiddleware, chiTieuService.update);
router.post("/remove", authMiddleware, chiTieuService.remove);
router.post("/findAll", authMiddleware, chiTieuService.find);

module.exports = router;
