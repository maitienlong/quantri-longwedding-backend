const mongoose = require('mongoose');

const visitorLogSchema = new mongoose.Schema({
    ip: { type: String, required: true, index: true },
    sessionId: { type: String },
    device: { type: String },
    page: { type: String },
    username: { type: String, default: 'Khách vãng lai' },
    country: { type: String, default: 'Việt Nam' },
    countryCode: { type: String, default: 'VN' },
    city: { type: String, default: 'Hà Nội' },
    lat: { type: Number, default: 21.0285 },
    lng: { type: Number, default: 105.8542 },
    visitCount: { type: Number, default: 1 },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VisitorLog', visitorLogSchema);
