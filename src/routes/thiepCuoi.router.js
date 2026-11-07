const express = require("express");
const router = express.Router();
const thiepCuoiService = require("../services/thiepCuoi.service");
const authMiddleware = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const { checkInvitationOwner } = require("../middleware/ownerPolicy.middleware");

// Public routes (cho khách mời xem thiệp, gửi RSVP, gửi lời chúc)
router.get("/studio-contacts", thiepCuoiService.getStudioContacts);
router.post("/get-facebook-avatar", thiepCuoiService.getFacebookAvatar);
// API Upload ảnh thiệp cưới (Avatar, Ảnh Bìa, Gallery)
router.post("/upload-image", upload.single("image"), thiepCuoiService.uploadInvitationImage);
// Public routes xem trước Open Graph (SEO Crawler Zalo / Facebook Messenger)
router.get("/p/:id", thiepCuoiService.getInvitationShareSeo);
router.get("/p/:id/:guestSlug", thiepCuoiService.getInvitationShareSeo);
router.get("/t/:id", thiepCuoiService.getInvitationShareSeo);
router.get("/t/:id/:guestSlug", thiepCuoiService.getInvitationShareSeo);
router.get("/moi/:id", thiepCuoiService.getInvitationShareSeo);
router.get("/moi/:id/:guestSlug", thiepCuoiService.getInvitationShareSeo);
router.get("/share/:id", thiepCuoiService.getInvitationShareSeo);
router.get("/preview-seo/:id", thiepCuoiService.getInvitationShareSeo);

router.get("/:id", thiepCuoiService.getInvitationById);
router.get("/:id/rsvp", authMiddleware, checkInvitationOwner, thiepCuoiService.getRsvps);
router.post("/:id/rsvp", thiepCuoiService.submitRsvp);
router.get("/:id/wishes", thiepCuoiService.getWishes);
router.post("/:id/wishes", thiepCuoiService.submitWish);

// Protected routes (cho chủ thiệp / khách hàng đã đăng nhập / quản trị viên)
router.get("/customer/check-permission", authMiddleware, thiepCuoiService.checkInvitationPermission);
router.get("/customer/check-permission/:customerId", authMiddleware, thiepCuoiService.checkInvitationPermission);
router.get("/customer/my/list", authMiddleware, thiepCuoiService.getMyInvitations);
router.get("/customer/:customerId/list", authMiddleware, thiepCuoiService.getMyInvitations);
router.patch("/:id/toggle-publish", authMiddleware, checkInvitationOwner, thiepCuoiService.togglePublishStatus);
router.delete("/:id", authMiddleware, checkInvitationOwner, thiepCuoiService.deleteInvitation);
router.get("/customer/my", authMiddleware, thiepCuoiService.getMyInvitation);
router.get("/customer/:customerId", authMiddleware, thiepCuoiService.getMyInvitation);
router.post("/save", authMiddleware, thiepCuoiService.saveInvitation);
router.post("/:id/guests", authMiddleware, checkInvitationOwner, thiepCuoiService.addOrUpdateGuest);
router.delete("/:id/guests/:guestId", authMiddleware, checkInvitationOwner, thiepCuoiService.deleteGuest);

module.exports = router;
