const mongoose = require('mongoose');

const blockedIpSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  reason: {
    type: String,
    default: "Blocked from admin panel"
  },
  blockedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlockedIP', blockedIpSchema);
