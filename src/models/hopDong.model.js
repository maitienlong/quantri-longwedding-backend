const mongoose = require("mongoose");
const KHACHHANG = require("./khachHang.model");
const payment = require("./payment.model");
const DICHVU = require("./dichVu.model");

const paymentSubSchema = new mongoose.Schema({
  id: { type: String, required: true },
  khachHang: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  method: { type: String, required: true },
  noiDung: { type: String }
}, {
  timestamps: true
});

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

const toDate = (v) => {
  if (!v) return v;
  if (typeof v === 'number') {
    return new Date(v < 10000000000 ? v * 1000 : v);
  }
  return v;
};

const hopDongSchema = new mongoose.Schema({
  maHopDong: { type: String, required: true, unique: true },
  ngayHopDong: { type: Date, required: true, set: toDate },

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
    giamGia: { type: Number },
    loaiGiamGia: { type: Number }, // 0: tiền mặt, 1: phần trăm
    tongGiaTriSauGiam: { type: Number },
    khachHangDaThanhToan: { type: Number },
    conLai: { type: Number },
    cacLuotThanhToan: [paymentSubSchema]
  },
  cacNgay: {
    ngayChup: { type: Date },
    ngayAnHoi: { type: Date },
    ngayCuoi: { type: Date },
    ngayChinhAnh: { type: Date },
    ngayTraAnh: { type: Date },
    ngayMuonDo: { type: Date },
    ngayTraDo: { type: Date },
    gioChup: { type: String },
    diaDiemChup: { type: String },
    chotLich: { type: String }
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
  linkAnhGoc: { type: String },
  linkAnhChinhSua: { type: String },
  danhSachAnhIn: [
    {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    }
  ],
}, {
  timestamps: true
});

// ==========================================
// MIDDLEWARE XỬ LÝ LOGIC TÍNH TOÁN
// ==========================================
hopDongSchema.pre('save', async function (next) {
  let tongChuaGiam = 0;

  try {
    // 1. Duyệt giỏ hàng để lấy giá và tính tổng
    if (this.gioHang && this.gioHang.length > 0) {
      for (let item of this.gioHang) {
        // Lấy đơn giá từ DB nếu chưa có (Snapshot)
        if (!item.donGia) {
          const dichVuGoc = await DICHVU.findById(item.dichVu);
          if (!dichVuGoc) {
            throw new Error(`Không tìm thấy dịch vụ với ID: ${item.dichVu}`);
          }
          item.donGia = dichVuGoc.giaTriDichVu;
          item.tenDichVuSnapshot = dichVuGoc.tenDichVu;
        }

        // Tính thanhTien từng item
        const soLuong = Number(item.soLuong) || 0;
        const donGia = Number(item.donGia) || 0;
        item.thanhTien = soLuong * donGia;
        
        tongChuaGiam += item.thanhTien;
      }
    }

    // Gán tổng giá trị gốc
    this.thanhToan.tongGiaTri = tongChuaGiam;

    // 2. Logic Giảm Giá
    const giamGiaValue = Number(this.thanhToan.giamGia) || 0;
    const loaiGiamGia = this.thanhToan.loaiGiamGia; // 0: Tiền mặt, 1: %

    let soTienDuocGiam = 0;

    if (loaiGiamGia === 1) {
      // Giảm theo %
      soTienDuocGiam = (tongChuaGiam * giamGiaValue) / 100;
    } else {
      // Giảm theo tiền mặt (loại 0 hoặc mặc định)
      soTienDuocGiam = giamGiaValue;
    }

    // 3. Tính tổng giá trị sau khi giảm
    const ketQua = tongChuaGiam - soTienDuocGiam;
    this.thanhToan.tongGiaTriSauGiam = Math.max(0, ketQua); // Đảm bảo không âm

    // 4. Tính tổng khách hàng đã thanh toán từ danh sách các lượt thanh toán
    if (this.thanhToan.cacLuotThanhToan && this.thanhToan.cacLuotThanhToan.length > 0) {
      this.thanhToan.khachHangDaThanhToan = this.thanhToan.cacLuotThanhToan.reduce((total, p) => total + (Number(p.amount) || 0), 0);
    } else {
      this.thanhToan.khachHangDaThanhToan = this.thanhToan.khachHangDaThanhToan || 0;
    }

    // 5. Tính tổng tiền còn lại phải thanh toán
    const tongSauGiam = this.thanhToan.tongGiaTriSauGiam || 0;
    const daThanhToan = this.thanhToan.khachHangDaThanhToan || 0;
    this.thanhToan.conLai = Math.max(0, tongSauGiam - daThanhToan);

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("hopDong", hopDongSchema);
