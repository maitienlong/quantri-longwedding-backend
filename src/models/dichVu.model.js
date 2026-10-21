const mongoose = require("mongoose");

const dichVuSchema = new mongoose.Schema({
    maDichVu: { type: String, required: true, unique: true },
    loaiDichVu: { type: Number, required: true },
    tenDichVu: { type: String, required: true },
    tonKhoDichVu: { type: Number, required: true },
    giaTriDichVu: { type: Number, required: true },
    giaChoThueDichVu: { type: Number, required: true },
    moTaDichVu: { type: String },
    imageDichVu: { type: String },
    templateId: { type: String, default: "" },
    accessType: { type: String, default: "vip" },
    badge: { type: String, default: "" },
    category: { type: String, default: "" },
    soLuongAnhChinhSua: { type: Number, default: 0 },
    soLuongAnh16x21: { type: Number, default: 0 },
    soLuongAnh20x30: { type: Number, default: 0 },
    soLuongAnh60x90: { type: Number, default: 0 },
    trangDiemNgayAnHoi: { type: String, default: "" },
    trangDiemNgayCuoi: { type: String, default: "" },
    trangPhucChoDoiBeLe: { type: String, default: "" },
    trangPhucCoDauNgayAnHoi: { type: String, default: "" },
    trangPhucChuReNgayAnHoi: { type: String, default: "" },
    trangPhucVayCuoiNgayCuoi: { type: String, default: "" },
    trangPhucVestChuReNgayCuoi: { type: String, default: "" },
    hoaCamTay: { type: String, default: "" },
    soLuongLichChup: { type: Number, default: 0 },
    soLuongLichMake: { type: Number, default: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model("dichVu", dichVuSchema);
