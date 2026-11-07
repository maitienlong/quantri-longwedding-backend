const mongoose = require("mongoose");

const trangPhucSchema = new mongoose.Schema({
  maTrangPhuc: { type: String, required: true, unique: true, uppercase: true, trim: true },
  tenTrangPhuc: { type: String, required: true, trim: true },
  phanLoai: { 
    type: String, 
    required: true,
    enum: [
      'Váy Luxury', 
      'Váy VIP', 
      'Váy Đi Bàn', 
      'Áo Dài Cô Dâu', 
      'Áo Dài Chú Rể', 
      'Áo Dài Bê Tráp', 
      'Vest Chú Rể', 
      'Phụ Kiện', 
      'Khác'
    ],
    default: 'Váy Luxury'
  },
  size: { type: String, default: "Freesize" },
  mauSac: { type: String, default: "Trắng" },
  giaChoThue: { type: Number, default: 0 },
  giaCoc: { type: Number, default: 0 },
  anhDaiDien: { type: String, default: "" },
  tinhTrang: { 
    type: String, 
    enum: [
      'SAN_SANG',      // Sẵn sàng tại studio
      'DANG_GIU',       // Đã có khách đặt cọc giữ lịch
      'DANG_CHO_THUE',  // Khách đang mang về dùng
      'DANG_GIAT_HAP',  // Đang gửi giặt hấp
      'DANG_SUA_CHUA',  // Đang chỉnh sửa số đo / phục hồi
      'NGUNG_SU_DUNG',  // Đã thanh lý hoặc hỏng
      'NEEDS_INVENTORY' // Cần kiểm kê trước khi cho thuê (M06)
    ], 
    default: 'SAN_SANG' 
  },
  viTriKe: { type: String, default: "" },
  soLanSuDung: { type: Number, default: 0 },
  qrCode: { type: String, default: "" },
  barcode: { type: String, default: "" },
  cleaningBufferHours: { type: Number, default: 24 }, // Thời gian đệm giặt hấp mặc định (giờ)
  maintenanceHistory: [
    {
      action: { type: String, enum: ['GIAT_HAP', 'SUA_CHUA', 'KIEM_KE', 'KHAC'], default: 'GIAT_HAP' },
      startDate: { type: Date, default: Date.now },
      endDate: { type: Date },
      cost: { type: Number, default: 0 },
      performedBy: { type: String, default: "" },
      notes: { type: String, default: "" },
      photos: [{ type: String }],
      createdAt: { type: Date, default: Date.now }
    }
  ],
  ghiChu: { type: String, default: "" }
}, {
  timestamps: true
});

module.exports = mongoose.model("trangPhuc", trangPhucSchema);
