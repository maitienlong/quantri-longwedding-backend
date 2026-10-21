const express = require("express");
const router = express.Router();
const loaiDichVuService = require("../services/loaiDichVu.service");

router.post("/findAll", loaiDichVuService.find);
router.get("/findAll", loaiDichVuService.find);
router.get("/list", loaiDichVuService.find);
router.post("/create", loaiDichVuService.create);
router.post("/update", loaiDichVuService.update);
router.post("/remove", loaiDichVuService.remove);
router.delete("/:id", loaiDichVuService.remove);

module.exports = router;
