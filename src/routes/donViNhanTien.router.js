const express = require("express");
const router = express.Router();
const donViNhanTienService = require("../services/donViNhanTien.service");

router.post("/findAll", donViNhanTienService.find);
router.get("/findAll", donViNhanTienService.find);
router.get("/list", donViNhanTienService.find);
router.post("/create", donViNhanTienService.create);
router.post("/update", donViNhanTienService.update);
router.post("/remove", donViNhanTienService.remove);
router.delete("/:id", donViNhanTienService.remove);

module.exports = router;
