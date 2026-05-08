const express = require("express");
const router = express.Router();
const hopDongService = require("../services/hopDong.service.js");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, hopDongService.create);
router.post("/update", authMiddleware, hopDongService.update);
router.post("/pay", authMiddleware, hopDongService.pay);
router.post("/remove", authMiddleware, hopDongService.remove);
router.post("/list", authMiddleware, hopDongService.list);

module.exports = router;