const mongoose = require("mongoose");

const anhSchema = new mongoose.Schema({
  idDrive: { type: String, required: true },
  tenFile: { type: String },
  urlGoc: { type: String, required: true }, // Có thể là link proxy qua server hoặc link S3/Local
  urlNen: { type: String, required: true }, // Link ảnh đã nén để hiển thị nhanh
  isHearted: { type: Boolean, default: false }, // Đã chọn hay chưa
  isCover: { type: Boolean, default: false }, // Đánh dấu ảnh phóng cổng
  comments: [
    {
      noiDung: { type: String },
      coordinateX: { type: Number }, // legacy % (0 - 100)
      coordinateY: { type: Number }, // legacy % (0 - 100)
      normalizedX: { type: Number }, // normalized [0, 1] relative to natural image width
      normalizedY: { type: Number }, // normalized [0, 1] relative to natural image height
      originalWidth: { type: Number },
      originalHeight: { type: Number },
      version: { type: Number, default: 1 },
      author: { type: String, default: 'Khách hàng' },
      ngayTao: { type: Date, default: Date.now },
    }
  ]
});

const albumReviewSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  title: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  submittedBy: { type: String, default: 'Ekip Studio' },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REQUEST_CHANGES'], 
    default: 'PENDING' 
  },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  approvalIp: { type: String },
  clientNote: { type: String, default: '' },
  changeRequestNotes: { type: String, default: '' },
  photoSelectionsCount: { type: Number, default: 0 },
  retouchPinsCount: { type: Number, default: 0 },
  auditTrail: [
    {
      action: { type: String },
      actor: { type: String },
      timestamp: { type: Date, default: Date.now },
      details: { type: mongoose.Schema.Types.Mixed }
    }
  ]
}, { _id: true, timestamps: true });

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
  lastError: { type: String },

  // PR 4.2 (MOD-06): Review Versioning, Approval State & Audit Trail
  activeVersion: { type: Number, default: 1 },
  currentVersionApproved: { type: Boolean, default: false },
  reviewVersions: [albumReviewSchema],
  auditTrail: [
    {
      action: { type: String },
      actor: { type: String },
      timestamp: { type: Date, default: Date.now },
      details: { type: mongoose.Schema.Types.Mixed }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model("album", albumSchema);
