const mongoose = require("mongoose");

const khachHangSchema = new mongoose.Schema({
    tenKhachHang: { type: String, required: true },
    soDienThoai: { type: String },
    avatar: { type: String },
    maDangNhap: { type: String },
    ngaySinhNhat: { type: String },
    gioiTinh: { type: String },
    diaChi: { type: String, required: true },
    ngayCapCCCD: { type: String },
    facebookId: { type: String },
}, { timestamps: true });

khachHangSchema.index({ soDienThoai: 1 });
khachHangSchema.index({ tenKhachHang: 1 });
khachHangSchema.index({ createdAt: -1 });

module.exports = mongoose.model("khachhang", khachHangSchema);
