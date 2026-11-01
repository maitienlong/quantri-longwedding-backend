const express = require("express");
const router = express.Router();
const dichVuService = require("../services/dichVu.service");
const kichThuocAnhService = require("../services/kichThuocAnh.service");
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");

router.post("/findAll", authMiddleware, dichVuService.find);
router.post("/create", authMiddleware, checkRole(["Quản lý"]), dichVuService.create);
router.post("/update", authMiddleware, checkRole(["Quản lý"]), dichVuService.update);
router.post("/sync-invitation-templates", authMiddleware, dichVuService.syncInvitationTemplatesRoute);
router.post("/remove", authMiddleware, checkRole(["Quản lý"]), dichVuService.remove);

// Danh mục kích thước ảnh dùng chung (AC-01, AC-02)
router.post("/photo-sizes/list", authMiddleware, kichThuocAnhService.list);
router.get("/photo-sizes/list", authMiddleware, kichThuocAnhService.list);
router.post("/photo-sizes/create", authMiddleware, kichThuocAnhService.create);

module.exports = router;
