const mongoose = require("mongoose");
const KHACHHANG = require("./khachHang.model");
const payment = require("./payment.model");
const DICHVU = require("./dichVu.model");

const cartItemSchema = new mongoose.Schema({
  dichVu: {
    type: mongoose.Schema.Types.ObjectId,
    ref: DICHVU, // Tham chiếu đến model DichVu
    required: true
  },
  tenDichVuSnapshot: String, // Lưu tên để hiển thị nhanh không cần populate
  soLuong: { type: Number, min: 1 },
  donGia: { type: Number }, // Giá tại thời điểm ký
  thanhTien: { type: Number }
});

const hopDongSchema = new mongoose.Schema({
  maHopDong: { type: String, required: true, unique: true },
  ngayHopDong: { type: Date, required: true },

  khachHang1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: KHACHHANG, // Tham chiếu đến model KhachHang
    required: true
  },

  khachHang2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: KHACHHANG, // Tham chiếu đến model KhachHang
  },
  gioHang: [cartItemSchema],
  thanhToan: {
    tongGiaTri: { type: Number },
    voucherGiamGia: { type: Number },
    cacLuotThanhToan: [payment.schema]
  },
  cacNgay: {
    ngayChup: { type: Date },
    ngayAnHoi: { type: Date },
    ngayCuoi: { type: Date },
    ngayChinhAnh: { type: Date },
    ngayTraAnh: { type: Date },
    ngayMuonDo: { type: Date },
    ngayTraDo: { type: Date }
  },
  nguoiPhucVu: {
    thoChupHinh: { type: String },
    thoChinhAnh: { type: String },
    thoMakeUp: { type: String },
    banHang: { type: String },
    phucVu: { type: String }
  },
  giaiDoan: { type: Number, required: true },
  dichVuChinh: { type: Number, required: true },
}, {
  timestamps: true
});

// ==========================================
// ĐÂY LÀ KHU VỰC TRIỂN KHAI MIDDLEWARE
// ==========================================
hopDongSchema.pre('save', async function (next) {
  let tongChuaGiam = 0;

  try {
    // 1. Duyệt qua giỏ hàng để lấy giá gốc và tính toán
    if (this.gioHang && this.gioHang.length > 0) {
      // Dùng for...of thay vì forEach để có thể dùng await bên trong vòng lặp
      for (let item of this.gioHang) {

        // KIỂM TRA & SAO CHÉP ĐƠN GIÁ (SNAPSHOT)
        // Nếu item chưa có donGia hoặc bạn muốn ghi đè giá mới nhất
        if (!item.donGia) {
          // Tìm thông tin dịch vụ gốc dựa vào ObjectId
          const dichVuGoc = await DICHVU.findById(item.dichVu);
          if (!dichVuGoc) {
            throw new Error(`Không tìm thấy dịch vụ với ID: ${item.dichVu}`);
          }

          // Sao chép đơn giá và tên từ bảng dịch vụ sang giỏ hàng
          item.donGia = dichVuGoc.giaTriDichVu; // Thay "giaGoc" bằng trường giá tương ứng trong dichVu.model.js của bạn
          item.tenDichVuSnapshot = dichVuGoc.tenDichVu; // Thêm luôn tên dịch vụ nếu bạn có trường này[cite: 4]
        }

        // Tính toán thanhTien
        const soLuong = Number(item.soLuong) || 0;
        const donGia = Number(item.donGia) || 0;

        item.thanhTien = soLuong * donGia;
        tongChuaGiam += item.thanhTien;
      }
    }

    // 2. Tính tổng giá trị hợp đồng
    if (!this.thanhToan) {
      this.thanhToan = {};
    }
    const giamGia = Number(this.thanhToan.voucherGiamGia) || 0;
    this.thanhToan.tongGiaTri = Math.max(0, tongChuaGiam - giamGia);

    next(); // Hoàn tất
  } catch (error) {
    next(error); // Báo lỗi cho Mongoose nếu có vấn đề (VD: không tìm thấy dịch vụ)
  }
});

module.exports = mongoose.model("hopDong", hopDongSchema);
