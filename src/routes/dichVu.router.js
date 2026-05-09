const express = require("express");
const router = express.Router();
const dichVuService = require("../services/dichVu.service");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, dichVuService.create);
router.post("/update", authMiddleware, dichVuService.update);
router.post("/remove", authMiddleware, dichVuService.remove);
router.post("/findAll", authMiddleware, dichVuService.find);

module.exports = router;