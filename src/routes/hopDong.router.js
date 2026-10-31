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
router.post("/customer-approve", authMiddleware, hopDongService.customerApproveAlbum);

// New enhanced endpoints
router.post("/update-post-production", authMiddleware, hopDongService.updatePostProduction);
router.post("/add-addon", authMiddleware, hopDongService.addAddonItem);
router.post("/update-audit", authMiddleware, hopDongService.updateWithAudit);
router.get("/reminders", authMiddleware, hopDongService.getReminders);
router.post("/reminders", authMiddleware, hopDongService.getReminders);

module.exports = router;
