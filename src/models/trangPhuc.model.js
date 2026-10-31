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
      'NGUNG_SU_DUNG'   // Đã thanh lý hoặc hỏng
    ], 
    default: 'SAN_SANG' 
  },
  viTriKe: { type: String, default: "" },
  soLanSuDung: { type: Number, default: 0 },
  ghiChu: { type: String, default: "" }
}, {
  timestamps: true
});

module.exports = mongoose.model("trangPhuc", trangPhucSchema);
