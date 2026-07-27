const express = require('express');
const router = express.Router();
const axios = require('axios');

// In-memory cache for active visitors
const activeVisitors = new Map();

const BlockedIP = require('../models/blockedIp.model');
const VisitorLog = require('../models/visitorLog.model');

// In-memory cache for IP locations to avoid redundant API calls
const ipGeoCache = new Map();

const isPrivateIp = (ip) => {
    if (!ip) return true;
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' ||
           ip.startsWith('192.168.') || ip.startsWith('10.') ||
           ip.startsWith('172.16.') || ip.startsWith('172.31.');
};

const localFallbacks = [
    { city: 'Hà Nội', country: 'Việt Nam', countryCode: 'VN', lat: 21.0285, lng: 105.8542 },
    { city: 'TP. Hồ Chí Minh', country: 'Việt Nam', countryCode: 'VN', lat: 10.8231, lng: 106.6297 },
    { city: 'Đà Nẵng', country: 'Việt Nam', countryCode: 'VN', lat: 16.0544, lng: 108.2022 },
    { city: 'Hải Phòng', country: 'Việt Nam', countryCode: 'VN', lat: 20.8449, lng: 106.6881 }
];

async function getIpLocation(ip) {
    if (isPrivateIp(ip)) {
        const index = Math.abs(ip.split('.').reduce((acc, part) => acc + parseInt(part || 0, 10), 0)) % localFallbacks.length;
        return localFallbacks[index];
    }

    if (ipGeoCache.has(ip)) {
        return ipGeoCache.get(ip);
    }

    try {
        const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon`, { timeout: 3000 });
        if (res.data && res.data.status === 'success') {
            const geo = {
                city: res.data.city || 'Unknown City',
                country: res.data.country || 'Unknown Country',
                countryCode: res.data.countryCode || 'VN',
                lat: res.data.lat || 21.0285,
                lng: res.data.lon || 105.8542
            };
            ipGeoCache.set(ip, geo);
            return geo;
        }
    } catch (e) {
        console.error(`Geolocation lookup failed for ${ip}:`, e.message);
    }

    const fallback = { city: 'Hà Nội', country: 'Việt Nam', countryCode: 'VN', lat: 21.0285, lng: 105.8542 };
    ipGeoCache.set(ip, fallback);
    return fallback;
}

// Endpoint for frontend website to send heartbeats
router.post('/heartbeat', async (req, res) => {
    try {
        const { sessionId, device, page, username } = req.body;
        if (!sessionId) {
            return res.status(400).json({ status: 'error', message: 'Missing sessionId' });
        }
        const now = Date.now();
        
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
        if (ip === '::1') ip = '127.0.0.1';
        if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

        const geo = await getIpLocation(ip);
        const userDisplayName = username || 'Khách vãng lai';

        if (activeVisitors.has(sessionId)) {
            const visitor = activeVisitors.get(sessionId);
            visitor.lastHeartbeat = now;
            visitor.page = page || visitor.page;
            if (device) visitor.device = device;
            if (userDisplayName && userDisplayName !== 'Khách vãng lai') visitor.username = userDisplayName;
            visitor.city = geo.city;
            visitor.country = geo.country;
            visitor.countryCode = geo.countryCode;
            visitor.lat = geo.lat;
            visitor.lng = geo.lng;
            activeVisitors.set(sessionId, visitor);
        } else {
            activeVisitors.set(sessionId, {
                id: sessionId,
                ip,
                device: device || req.headers['user-agent'] || 'Unknown Device',
                page: page || '/',
                username: userDisplayName,
                city: geo.city,
                country: geo.country,
                countryCode: geo.countryCode,
                lat: geo.lat,
                lng: geo.lng,
                startTime: now,
                lastHeartbeat: now
            });
        }
        
        // Clean up inactive visitors (>15s)
        activeVisitors.forEach((value, key) => {
            if (now - value.lastHeartbeat > 15000) {
                activeVisitors.delete(key);
            }
        });

        // Database log
        try {
            let log = await VisitorLog.findOne({ ip });
            if (log) {
                log.visitCount = (log.visitCount || 0) + 1;
                log.lastSeen = new Date();
                log.device = device || log.device;
                log.page = page || log.page;
                if (userDisplayName && userDisplayName !== 'Khách vãng lai') {
                    log.username = userDisplayName;
                }
                log.city = geo.city;
                log.country = geo.country;
                log.countryCode = geo.countryCode;
                log.lat = geo.lat;
                log.lng = geo.lng;
                await log.save();
            } else {
                await VisitorLog.create({
                    ip,
                    sessionId,
                    device: device || req.headers['user-agent'] || 'Unknown Device',
                    page: page || '/',
                    username: userDisplayName,
                    city: geo.city,
                    country: geo.country,
                    countryCode: geo.countryCode,
                    lat: geo.lat,
                    lng: geo.lng,
                    visitCount: 1,
                    lastSeen: new Date()
                });
            }
        } catch (dbErr) {
            console.error("Error saving VisitorLog:", dbErr.message);
        }
        
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Endpoint for stats summary
router.get('/stats', async (req, res) => {
    try {
        const totalLogs = await VisitorLog.find();
        const totalVisits = totalLogs.reduce((acc, item) => acc + (item.visitCount || 1), 0);
        const uniqueIpsCount = totalLogs.length;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayVisits = await VisitorLog.countDocuments({ lastSeen: { $gte: startOfToday } });

        const countryMap = {};
        totalLogs.forEach(item => {
            const key = item.country || 'Việt Nam';
            countryMap[key] = (countryMap[key] || 0) + (item.visitCount || 1);
        });

        const topCountries = Object.entries(countryMap)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        res.json({
            status: 'success',
            data: {
                totalVisits,
                uniqueIpsCount,
                todayVisits,
                activeOnline: activeVisitors.size,
                topCountries
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Endpoint for map markers
router.get('/map-locations', async (req, res) => {
    try {
        const logs = await VisitorLog.find().sort({ lastSeen: -1 }).limit(500);
        const locations = logs.map(log => ({
            id: log._id,
            ip: log.ip,
            username: log.username,
            city: log.city,
            country: log.country,
            countryCode: log.countryCode,
            lat: log.lat,
            lng: log.lng,
            visitCount: log.visitCount,
            device: log.device,
            page: log.page,
            lastSeen: log.lastSeen,
            isBlocked: global.blockedIPs ? global.blockedIPs.has(log.ip) : false
        }));

        res.json({ status: 'success', data: locations });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Endpoint for visitor IP access logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await VisitorLog.find().sort({ lastSeen: -1 }).limit(1000);
        const data = logs.map(log => ({
            ...log.toObject(),
            isBlocked: global.blockedIPs ? global.blockedIPs.has(log.ip) : false
        }));

        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Endpoint for active visitors
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
            username: v.username || 'Khách vãng lai',
            city: v.city || 'Hà Nội',
            country: v.country || 'Việt Nam',
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
