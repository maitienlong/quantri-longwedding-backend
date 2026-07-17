const express = require('express');
const router = express.Router();

// In-memory cache for active visitors
// Map signature: sessionId -> { ip, device, page, startTime, lastHeartbeat }
const activeVisitors = new Map();

const BlockedIP = require('../models/blockedIp.model');

// Endpoint for frontend website to send heartbeats
router.post('/heartbeat', (req, res) => {
    try {
        const { sessionId, device, page } = req.body;
        if (!sessionId) {
            return res.status(400).json({ status: 'error', message: 'Missing sessionId' });
        }
        const now = Date.now();
        
        // Cố gắng lấy IP chính xác nếu qua proxy
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
        
        // Làm sạch địa chỉ IP
        if (ip === '::1') ip = '127.0.0.1';
        if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
        
        if (activeVisitors.has(sessionId)) {
            const visitor = activeVisitors.get(sessionId);
            visitor.lastHeartbeat = now;
            visitor.page = page || visitor.page;
            if (device) visitor.device = device;
            activeVisitors.set(sessionId, visitor);
        } else {
            activeVisitors.set(sessionId, {
                id: sessionId,
                ip,
                device: device || req.headers['user-agent'] || 'Unknown Device',
                page: page || '/',
                startTime: now,
                lastHeartbeat: now
            });
        }
        
        // Clean up inactive visitors
        activeVisitors.forEach((value, key) => {
            if (now - value.lastHeartbeat > 15000) {
                activeVisitors.delete(key);
            }
        });
        
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Endpoint for admin dashboard to retrieve active visitors
router.get('/active', (req, res) => {
    try {
        const now = Date.now();
        activeVisitors.forEach((value, key) => {
            if (now - value.lastHeartbeat > 15000) {
                activeVisitors.delete(key);
            }
        });
        
        const visitorsList = Array.from(activeVisitors.values()).map(v => ({
            id: v.id,
            ip: v.ip,
            device: v.device,
            page: v.page,
            startTime: v.startTime,
            isBlocked: global.blockedIPs ? global.blockedIPs.has(v.ip) : false
        }));
        
        visitorsList.sort((a, b) => b.startTime - a.startTime);
        
        res.json({ status: 'success', data: visitorsList });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Get blocked IPs
router.get('/blocked', async (req, res) => {
    try {
        const blockedList = await BlockedIP.find().sort({ blockedAt: -1 });
        res.json({ status: 'success', data: blockedList });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Block an IP
router.post('/block', async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) return res.status(400).json({ status: 'error', message: 'Missing IP address' });
        if (ip === '127.0.0.1' || ip === 'localhost') {
            return res.status(400).json({ status: 'error', message: 'Cannot block localhost' });
        }
        
        const existing = await BlockedIP.findOne({ ip });
        if (!existing) {
            await BlockedIP.create({ ip });
        }
        
        if (global.blockedIPs) {
            global.blockedIPs.add(ip);
        }
        
        res.json({ status: 'success', message: `Blocked IP ${ip}` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Unblock an IP
router.post('/unblock', async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) return res.status(400).json({ status: 'error', message: 'Missing IP address' });
        
        await BlockedIP.deleteOne({ ip });
        
        if (global.blockedIPs) {
            global.blockedIPs.delete(ip);
        }
        
        res.json({ status: 'success', message: `Unblocked IP ${ip}` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
