const express = require('express');
const router = express.Router();
const sepayService = require('../services/sepay.service');

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

module.exports = router;
