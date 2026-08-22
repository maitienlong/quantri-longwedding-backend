const express = require("express");
const router = express.Router();
const hopDongService = require("../services/hopDong.service.js");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/create", authMiddleware, hopDongService.create);
router.post("/update", authMiddleware, hopDongService.update);
router.post("/pay", authMiddleware, hopDongService.pay);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), hopDongService.remove);
router.post("/update-progress", authMiddleware, hopDongService.updateProgress);
router.post("/list", authMiddleware, hopDongService.list);
router.post("/search", authMiddleware, hopDongService.search);
router.post("/customer-contracts", authMiddleware, hopDongService.getCustomerContracts);

module.exports = router;