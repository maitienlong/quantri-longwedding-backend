const express = require('express');
const router = express.Router();
const Log = require('../models/log.model');

// POST /api/log - Create a new log
router.post('/', async (req, res) => {
    try {
        const { action, user, details } = req.body;
        
        // Get IP from request
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Get Device info from User-Agent
        const deviceInfo = req.headers['user-agent'];

        const newLog = new Log({
            action,
            user,
            ipAddress,
            deviceInfo,
            details
        });

        await newLog.save();
        res.status(201).json({ status: 'success', message: 'Log created' });
    } catch (error) {
        console.error('Error creating log:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/log - List logs
router.get('/', async (req, res) => {
    try {
        const logs = await Log.find().sort({ createdAt: -1 }).limit(1000);
        res.status(200).json({ status: 'success', data: logs });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
