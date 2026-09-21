const express = require("express");
const router = express.Router();
const dichVuService = require("../services/dichVu.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/findAll", authMiddleware, dichVuService.find);
router.post("/create", authMiddleware, checkRole(["Quản lý"]), dichVuService.create);
router.post("/update", authMiddleware, checkRole(["Quản lý"]), dichVuService.update);
router.post("/sync-invitation-templates", authMiddleware, dichVuService.syncInvitationTemplatesRoute);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), dichVuService.remove);

module.exports = router;