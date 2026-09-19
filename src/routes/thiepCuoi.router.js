const express = require("express");
const router = express.Router();
const thiepCuoiService = require("../services/thiepCuoi.service");
const authMiddleware = require("../middleware/auth.middleware");

// Public routes (cho khách mời xem thiệp, gửi RSVP, gửi lời chúc)
router.get("/studio-contacts", thiepCuoiService.getStudioContacts);
router.post("/get-facebook-avatar", thiepCuoiService.getFacebookAvatar);
// Public routes xem trước Open Graph (SEO Crawler Zalo / Facebook Messenger)
router.get("/p/:id", thiepCuoiService.getInvitationShareSeo);
router.get("/share/:id", thiepCuoiService.getInvitationShareSeo);
router.get("/preview-seo/:id", thiepCuoiService.getInvitationShareSeo);

router.get("/:id", thiepCuoiService.getInvitationById);
router.get("/:id/rsvp", thiepCuoiService.getRsvps);
router.post("/:id/rsvp", thiepCuoiService.submitRsvp);
router.get("/:id/wishes", thiepCuoiService.getWishes);
router.post("/:id/wishes", thiepCuoiService.submitWish);

// Protected routes (cho chủ thiệp / khách hàng đã đăng nhập)
router.get("/customer/check-permission", authMiddleware, thiepCuoiService.checkInvitationPermission);
router.get("/customer/check-permission/:customerId", thiepCuoiService.checkInvitationPermission);
router.get("/customer/my/list", authMiddleware, thiepCuoiService.getMyInvitations);
router.get("/customer/:customerId/list", thiepCuoiService.getMyInvitations);
router.patch("/:id/toggle-publish", thiepCuoiService.togglePublishStatus);
router.delete("/:id", thiepCuoiService.deleteInvitation);
router.get("/customer/my", authMiddleware, thiepCuoiService.getMyInvitation);
router.get("/customer/:customerId", thiepCuoiService.getMyInvitation);
router.post("/save", thiepCuoiService.saveInvitation);
router.post("/:id/guests", thiepCuoiService.addOrUpdateGuest);
router.delete("/:id/guests/:guestId", thiepCuoiService.deleteGuest);

module.exports = router;
