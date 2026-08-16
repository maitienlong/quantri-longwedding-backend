const mongoose = require("mongoose");

const sepayConfigSchema = new mongoose.Schema({
    bankName: { type: String, default: "MBBank" },
    accountNumber: { type: String, default: "9990187764519" },
    accountName: { type: String, default: "LONG WEDDING" },
    apiKey: { type: String, default: "" },
    secretKey: { type: String, default: "whsec_kY4YMHH5aqMUcrHSEeqj4wQpov6Vhx0N" },
    defaultPrefix: { type: String, default: "HD" },
    autoUpdateContract: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("SepayConfig", sepayConfigSchema);
