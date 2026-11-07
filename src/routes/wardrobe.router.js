const express = require("express");
const router = express.Router();
const wardrobeService = require("../services/wardrobe.service");
const authMiddleware = require("../middleware/auth.middleware");

// Check conflicts before reserving
router.get("/conflicts", authMiddleware, wardrobeService.getConflictsEndpoint);

// List reservations
router.get("/reservations", authMiddleware, wardrobeService.listReservations);

// Create reservation
router.post("/reservations", authMiddleware, wardrobeService.createReservation);
router.post("/:itemId/reservations", authMiddleware, (req, res) => {
    req.body.itemId = req.params.itemId;
    return wardrobeService.createReservation(req, res);
});

// Check-out (Handover to client)
router.post("/reservations/:id/check-out", authMiddleware, wardrobeService.checkOut);
router.post("/:id/check-out", authMiddleware, wardrobeService.checkOut);

// Check-in (Receive return from client)
router.post("/reservations/:id/check-in", authMiddleware, wardrobeService.checkIn);
router.post("/:id/check-in", authMiddleware, wardrobeService.checkIn);

// Cancel reservation
router.post("/reservations/:id/cancel", authMiddleware, wardrobeService.cancelReservation);

// Garment maintenance (laundry / repair)
router.post("/:itemId/maintenance", authMiddleware, wardrobeService.recordMaintenance);

module.exports = router;

