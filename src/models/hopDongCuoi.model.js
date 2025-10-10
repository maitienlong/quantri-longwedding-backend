const mongoose = require("mongoose");

const hopDongSchema = new mongoose.Schema({
  maHopDong: { type: String, required: true, unique: true },
  ngayKy: { type: Date, required: true, default: Date.now },
  ngayChup: { type: String },
  ngayAnHoi: { type: String },
  ngayCuoi: { type: String },
  khachHang: {
    coDau: { type: String, required: true },
    chuRe: { type: String, required: true }
  },

  noiDungDichVu: {
    type: Array, required: true
  },

  thanhToan: {
    tongGiaTri: { type: Number, required: true },
    soTienDaThanhToan: { type: Number },
    thanhToanLan1: {
      soTienDaThanhToan: { type: Number },
      ngayThanhToan : { type: Date },
    },
    thanhToanLan2: {
      soTienDaThanhToan: { type: Number },
      ngayThanhToan : { type: Date },
    },
    thanhToanLan3: {
      soTienDaThanhToan: { type: Number },
      ngayThanhToan : { type: Date },
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("HopDongCuoi", hopDongSchema);
