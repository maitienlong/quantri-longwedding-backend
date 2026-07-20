const express = require("express");
const router = express.Router();
const loaiHopDongService = require("../services/loaiHopDong.service");

router.post("/findAll", loaiHopDongService.find);
router.post("/create", loaiHopDongService.create);
router.post("/update", loaiHopDongService.update);
router.post("/remove", loaiHopDongService.remove);

module.exports = router;
