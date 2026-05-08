const mongoose = require("mongoose");

const khachHangSchema = new mongoose.Schema({
    tenKhachHang: { type: String, required: true },
    soDienThoai: { type: String, required: true, unique: true },
    avatar: { type: String },
    maDangNhap: { type: String },
    ngaySinhNhat: { type: String },
    gioiTinh: { type: String },
    diaChi: { type: String, required: true },
    ngayCapCCCD: { type: String },
}, { timestamps: true });



module.exports = mongoose.model("khachhang", khachHangSchema);

