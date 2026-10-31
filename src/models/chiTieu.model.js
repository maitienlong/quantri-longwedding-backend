const mongoose = require("mongoose");

const chiTieuSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    date: { type: Date, required: true, default: Date.now },
    receiver: { type: String, required: true },
    reason: { type: String, required: true },
    amount: { type: Number, required: true },
    creator: { type: String },
    note: { type: String },
    maHopDong: { type: String }
}, {
    timestamps: true
});

chiTieuSchema.index({ date: -1 });
chiTieuSchema.index({ maHopDong: 1 });

module.exports = mongoose.model("chiTieu", chiTieuSchema);
