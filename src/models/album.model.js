const mongoose = require("mongoose");

const anhSchema = new mongoose.Schema({
  idDrive: { type: String, required: true },
  tenFile: { type: String },
  urlGoc: { type: String, required: true }, // Có thể là link proxy qua server hoặc link S3/Local
  urlNen: { type: String, required: true }, // Link ảnh đã nén để hiển thị nhanh
  isHearted: { type: Boolean, default: false }, // Đã chọn hay chưa
  comments: [
    {
      noiDung: { type: String },
      ngayTao: { type: Date, default: Date.now },
    }
  ]
});

const albumSchema = new mongoose.Schema({
  maHopDong: { type: String, required: true, unique: true },
  driveLink: { type: String }, // Link folder drive gốc quản lý nhập vào
  publicLink: { type: String, unique: true }, // Link gửi cho khách (ID rút gọn hoặc UUID)
  shareLink: { type: String, unique: true, sparse: true }, // Link khách chia sẻ công khai ảnh đã chỉnh sửa
  trangThai: { type: String, default: 'Đã tạo' }, // Đang xử lý, Hoàn thành
  coGioiHanAnh: { type: Boolean, default: false },
  soLuongAnhGioiHan: { type: Number, default: 0 },
  khachHangXacNhan: { type: Boolean, default: false },
  ngayKhachXacNhan: { type: Date },
  danhSachAnh: [anhSchema],
  danhSachAnhChinhSua: [anhSchema],
  trangThaiChinhSua: { type: String, default: 'Chưa đồng bộ' },
  chuDe: { type: String },
  lastError: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model("album", albumSchema);
