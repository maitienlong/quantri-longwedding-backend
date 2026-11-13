const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    provider: { type: String, default: "SEPAY", index: true },
    providerTransactionId: { type: String, required: true, index: true, default: function() { return this.id; } },
    khachHang: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    method: { type: String, required: true },
    noiDung: { type: String },
    maHopDong: { type: String },
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopdong" },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "khachhang" },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["SUCCESS", "FAILED", "DUPLICATE"], default: "SUCCESS" }
}, {
    timestamps: true
});

// Compound unique index to guarantee idempotency at database level
paymentSchema.index({ provider: 1, providerTransactionId: 1 }, { unique: true });
paymentSchema.index({ date: -1 });
paymentSchema.index({ maHopDong: 1 });
paymentSchema.index({ hopDongId: 1 });

module.exports = mongoose.model("payment", paymentSchema);
