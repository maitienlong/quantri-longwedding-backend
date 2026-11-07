const mongoose = require("mongoose");
const { normalizePhoneNumber } = require("../utils/phoneUtils");

const khachHangSchema = new mongoose.Schema({
    tenKhachHang: { type: String, required: true },
    soDienThoai: { type: String },
    normalizedPhone: { type: String },
    avatar: { type: String },
    maDangNhap: { type: String },
    ngaySinhNhat: { type: String },
    gioiTinh: { type: String },
    diaChi: { type: String, required: true },
    ngayCapCCCD: { type: String },
    facebookId: { type: String },
    isMerged: { type: Boolean, default: false },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'khachhang' }
}, { timestamps: true });

khachHangSchema.pre('save', function (next) {
    if (this.soDienThoai) {
        this.normalizedPhone = normalizePhoneNumber(this.soDienThoai);
    }
    next();
});

khachHangSchema.index({ soDienThoai: 1 });
khachHangSchema.index({ normalizedPhone: 1 });
khachHangSchema.index({ tenKhachHang: 1 });
khachHangSchema.index({ createdAt: -1 });

module.exports = mongoose.model("khachhang", khachHangSchema);
