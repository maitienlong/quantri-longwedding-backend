const mongoose = require("mongoose");

const paymentAuditLogSchema = new mongoose.Schema({
    provider: { type: String, default: "SEPAY", index: true },
    providerTransactionId: { type: String, index: true },
    status: { 
        type: String, 
        enum: ["SUCCESS", "DUPLICATE", "AUTH_FAILED", "CONTRACT_NOT_FOUND", "ERROR"], 
        required: true,
        index: true
    },
    message: { type: String },
    amount: { type: Number, default: 0 },
    maHopDong: { type: String, index: true },
    ipAddress: { type: String },
    sanitizedHeaders: { type: mongoose.Schema.Types.Mixed },
    payload: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true }
}, {
    timestamps: true
});

paymentAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("payment_audit_log", paymentAuditLogSchema);

