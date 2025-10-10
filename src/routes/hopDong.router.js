const express = require("express");
const router = express.Router();
const HopDongController = require("../controllers/hopDong.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/taoMoiHopDongCuoi", authMiddleware, HopDongController.taoHDCuoi);
router.post("/capNhatHopDongCuoi", authMiddleware, HopDongController.capNhatHDCuoi);
router.post("/thanhToanHopDongCuoi", authMiddleware, HopDongController.thanhToanHDCuoi);
router.post("/xoaHDCuoi", authMiddleware, HopDongController.xoaHDCUoi);
router.post("/findAllHDCuoi", authMiddleware, HopDongController.findAllHDCuoi);

router.post("/taoMoiHopDong", authMiddleware, HopDongController.taoHD);
router.post("/capNhatHopDong", authMiddleware, HopDongController.capNhatHD);
router.post("/thanhToanHopDong", authMiddleware, HopDongController.thanhToanHD);
router.post("/xoaHopDong", authMiddleware, HopDongController.xoaHD);
router.post("/findAllHD", authMiddleware, HopDongController.findAllHD);

module.exports = router;