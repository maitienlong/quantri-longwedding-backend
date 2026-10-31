const express = require("express");
const router = express.Router();
const trangPhucService = require("../services/trangPhuc.service");
const authMiddleware = require("../middleware/auth.middleware");

router.get("/list", authMiddleware, trangPhucService.list);
router.post("/list", authMiddleware, trangPhucService.list);
router.get("/detail/:id", authMiddleware, trangPhucService.getById);
router.post("/create", authMiddleware, trangPhucService.create);
router.post("/update", authMiddleware, trangPhucService.update);
router.post("/remove", authMiddleware, trangPhucService.remove);
router.post("/check-conflict", authMiddleware, trangPhucService.checkConflict);
router.get("/calendar", authMiddleware, trangPhucService.getBookingCalendar);
router.post("/calendar", authMiddleware, trangPhucService.getBookingCalendar);

module.exports = router;
