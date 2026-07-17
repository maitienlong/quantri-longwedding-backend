const express = require('express');
const router = express.Router();
const albumService = require('../services/album.service');
const authMiddleware = require('../middleware/auth.middleware');

// API cho Quản trị
router.post('/sync', albumService.syncDriveToAlbum);
router.get('/admin/list', albumService.getAdminAlbums);
router.get('/admin/:maHopDong', albumService.getAdminAlbumDetail);
router.put('/admin/:maHopDong/settings', albumService.updateAlbumSettings);

// API cho Khách hàng
router.get('/customer/:publicLink', authMiddleware, albumService.getCustomerAlbum);
router.post('/customer/:publicLink/heart', authMiddleware, albumService.heartImage);
router.post('/customer/:publicLink/comment', authMiddleware, albumService.commentImage);
router.post('/customer/:publicLink/complete', authMiddleware, albumService.completeSelection);
router.post('/customer/:publicLink/share', authMiddleware, albumService.generateShareLink);

// API Public (Không cần đăng nhập)
router.get('/public/share/:shareLink', albumService.getSharedAlbum);

module.exports = router;
