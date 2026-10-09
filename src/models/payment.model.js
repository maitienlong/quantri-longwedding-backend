const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    khachHang: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    method: { type: String, required: true },
    noiDung: { type: String },
    maHopDong: { type: String },
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopdong" },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "khachhang" }
}, {
    timestamps: true
});

module.exports = mongoose.model("payment", paymentSchema);
