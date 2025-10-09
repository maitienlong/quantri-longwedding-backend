const mongoose = require("mongoose");

const khachHangSchema = new mongoose.Schema({
    maKhachHang: { type: String, required: true, unique: true },
    tenKhachHang: { type: String, required: true },
    maDangNhap: { type: String, required: true },
    ngaySinhNhat: { type: String, required: true },
    gioiTinh: { type: String, required: true },
    diaChi: { type: String, required: true },
    ngayCapCCCD: { type: String, required: true },
}, { timestamps: true });



module.exports = mongoose.model("khachhang", khachHangSchema);

