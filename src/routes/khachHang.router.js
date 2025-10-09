const express = require("express");
const router = express.Router();
const khachHangController = require("../controllers/khachHang.controller");

router.post("/create", khachHangController.taoKhachHang);
router.post("/listAll", khachHangController.listAll);
router.post("/findOne", khachHangController.findOne);

module.exports = router;