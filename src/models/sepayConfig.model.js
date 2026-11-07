const mongoose = require("mongoose");

const sepayConfigSchema = new mongoose.Schema({
    bankName: { type: String, default: process.env.SEPAY_BANK_NAME || "MBBank" },
    accountNumber: { type: String, default: process.env.SEPAY_ACCOUNT_NUMBER || "" },
    accountName: { type: String, default: process.env.SEPAY_ACCOUNT_NAME || "LONG WEDDING" },
    apiKey: { type: String, default: process.env.SEPAY_API_KEY || "" },
    secretKey: { type: String, default: process.env.SEPAY_WEBHOOK_SECRET || "" },
    defaultPrefix: { type: String, default: "HD" },
    autoUpdateContract: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("SepayConfig", sepayConfigSchema);
