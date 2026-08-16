const express = require('express');
const router = express.Router();
const sepayService = require('../services/sepay.service');

// SePay Webhook Health Check (GET)
router.get('/webhook', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'SePay Webhook Endpoint is ready' });
});

// SePay Webhook Endpoint (POST)
router.post('/webhook', sepayService.handleWebhook);

// Get SePay Config
router.get('/config', sepayService.getConfig);

// Update SePay Config
router.post('/config', sepayService.updateConfig);
router.put('/config', sepayService.updateConfig);

// Get QR Code Info for Contract
router.get('/qr-info/:maHopDong', sepayService.getQrInfo);

// Check Contract Payment Status (Polling)
router.get('/check-status/:maHopDong', sepayService.checkStatus);

// Get Recent Notifications (Global Listener)
router.get('/notifications', sepayService.getNotifications || ((req, res) => res.json({ success: true, data: [] })));

module.exports = router;
