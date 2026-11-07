const express = require("express");
const router = express.Router();
const bookingService = require("../services/booking.service");
const authMiddleware = require("../middleware/auth.middleware");

// Check resource availability across interval [start, end)
router.get("/availability", authMiddleware, bookingService.getAvailability);

// Check potential conflicts for contract schedule assignments
router.post("/check-contract-conflicts", authMiddleware, bookingService.checkContractConflicts);

// List bookings with filter
router.get("/", authMiddleware, bookingService.listBookings);
router.get("/list", authMiddleware, bookingService.listBookings);

// Get single booking
router.get("/:id", authMiddleware, bookingService.getBookingById);

// Create new booking (runs conflict check if status is CONFIRMED)
router.post("/", authMiddleware, bookingService.createBooking);
router.post("/create", authMiddleware, bookingService.createBooking);

// Update booking
router.patch("/:id", authMiddleware, bookingService.updateBooking);
router.put("/:id", authMiddleware, bookingService.updateBooking);

// Confirm tentative booking with server-side atomic conflict check
router.post("/:id/confirm", authMiddleware, bookingService.confirmBooking);

// Cancel booking & release resources
router.post("/:id/cancel", authMiddleware, bookingService.cancelBooking);

module.exports = router;

