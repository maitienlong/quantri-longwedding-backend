const mongoose = require("mongoose");

const donViNhanTienSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" }
}, {
    timestamps: true
});

module.exports = mongoose.model("donViNhanTien", donViNhanTienSchema);
