const express = require('express');
const router = express.Router();
const albumService = require('../services/album.service');
const authMiddleware = require('../middleware/auth.middleware');
const portalAuthMiddleware = require('../middleware/portalAuth.middleware');

// API cho Quản trị
router.post('/sync', authMiddleware, albumService.syncDriveToAlbum);
router.get('/admin/list', authMiddleware, albumService.getAdminAlbums);
router.get('/admin/:maHopDong', authMiddleware, albumService.getAdminAlbumDetail);
router.put('/admin/:maHopDong/settings', authMiddleware, albumService.updateAlbumSettings);
router.get('/portal-token/:maHopDong', authMiddleware, albumService.generatePortalToken);
router.post('/portal-token/:maHopDong', authMiddleware, albumService.generatePortalToken);

// API cho Cổng Khách Hàng (Bảo vệ bằng Scoped Portal Token hoặc Nhân viên Studio)
router.get('/portal/:maHopDong', portalAuthMiddleware, albumService.getPortalInfo);
router.post('/portal/:maHopDong/photo-action', portalAuthMiddleware, albumService.portalPhotoAction);
router.post('/portal/:maHopDong/complete', portalAuthMiddleware, albumService.portalCompleteSelection);

// PR 4.2 (MOD-06, LW2-041): Photo Selection Versioning, Retouch Pins & Approval
router.post('/portal/:id/retouch-notes', portalAuthMiddleware, albumService.addRetouchPin);
router.post('/portal/:id/approve', portalAuthMiddleware, albumService.approveAlbumReview);
router.put('/portal/:id/selections', portalAuthMiddleware, albumService.updateSelections);
router.get('/portal/:id/versions', portalAuthMiddleware, albumService.getReviewVersions);

router.post('/:id/retouch-notes', portalAuthMiddleware, albumService.addRetouchPin);
router.post('/:id/approve', portalAuthMiddleware, albumService.approveAlbumReview);
router.put('/:id/selections', portalAuthMiddleware, albumService.updateSelections);
router.get('/:id/versions', portalAuthMiddleware, albumService.getReviewVersions);

// Nhân viên tải lên phiên bản review mới (N+1)
router.post('/:id/versions', authMiddleware, albumService.uploadReviewVersion);

// API cho Khách hàng
router.get('/customer/:publicLink', authMiddleware, albumService.getCustomerAlbum);
router.post('/customer/:publicLink/heart', authMiddleware, albumService.heartImage);
router.post('/customer/:publicLink/cover', authMiddleware, albumService.coverImage);
router.post('/customer/:publicLink/comment', authMiddleware, albumService.commentImage);
router.post('/customer/:publicLink/complete', authMiddleware, albumService.completeSelection);
router.post('/customer/:publicLink/share', authMiddleware, albumService.generateShareLink);

// API Public (Không cần đăng nhập)
router.get('/public/share/:shareLink', albumService.getSharedAlbum);
router.get('/public/share-seo/:shareLink', albumService.getSharedAlbumSeo);
router.post('/download-base64', authMiddleware, albumService.convertDriveToBase64);

module.exports = router;
