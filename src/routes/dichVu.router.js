const express = require("express");
const router = express.Router();
const DichVuController = require("../controllers/dichVu.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, DichVuController.create);
router.post("/update", authMiddleware, DichVuController.update);
router.post("/remove", authMiddleware, DichVuController.remove);
router.post("/findAll", authMiddleware, DichVuController.find);

module.exports = router;