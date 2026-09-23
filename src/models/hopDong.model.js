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
    required: false
  },
  tenDichVuSnapshot: String, // Lưu tên để hiển thị nhanh không cần populate
  loaiDichVu: { type: Number },
  soLuong: { type: Number, min: 1 },
  donGia: { type: Number }, // Giá tại thời điểm ký
  giamGiaDichVu: { type: Number, default: 0 }, // Giảm giá riêng cho từng dịch vụ
  thanhTien: { type: Number },

  // New service parameters
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
  maLoaiThiep: { type: String, default: "" },
  tenLoaiThiep: { type: String, default: "" },

  // Lịch trình trang điểm khi dịch vụ là makeup phát sinh
  ngayTrangDiem: { type: Date },
  gioTrangDiem: { type: String, default: "" },
  diaDiemTrangDiem: { type: String, default: "" },
  thoMakeUp: { type: String, default: "" },
  ghiChuTrangDiem: { type: String, default: "" }
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
    voucherCode: { type: String, default: "" },
    voucherGiamGia: { type: Number, default: 0 },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    tongGiaTriSauGiam: { type: Number },
    khachHangDaThanhToan: { type: Number },
    conLai: { type: Number },
    phanTramDaThanhToan: { type: Number, default: 0 },
    trangThaiThanhToan: { type: String, default: "Chưa thanh toán" },
    cacLuotThanhToan: [paymentSubSchema]
  },
  cacNgay: {
    ngayChup: { type: Date },
    ngayAnHoi: { type: Date },
    ngayCuoi: { type: Date },
    ngayChinhAnh: { type: Date },
    ngayTraAnh: { type: Date },
    ngayChuyenInAnh: { type: Date },
    ngayMuonDo: { type: Date },
    ngayTraDo: { type: Date },
    gioChup: { type: String },
    diaDiemChup: { type: String },
    chotLich: { type: String },
    ngayTrangDiem: { type: Date },
    gioTrangDiem: { type: String },
    diaDiemTrangDiem: { type: String }
  },
  lichTrangDiem: [
    {
      id: { type: String },
      dichVuId: { type: String },
      tenDichVu: { type: String },
      ngayTrangDiem: { type: Date },
      gioTrangDiem: { type: String },
      diaDiem: { type: String },
      thoMakeUp: { type: String },
      ghiChu: { type: String }
    }
  ],
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
  cacLuotChi: [
    {
      id: { type: String },
      date: { type: Date },
      receiver: { type: String },
      reason: { type: String },
      amount: { type: Number },
      creator: { type: String },
      note: { type: String }
    }
  ],
  isSpecialCollection: { type: Boolean, default: false },
  specialCollectionOrder: { type: Number, default: 0 },
  soanDo: {
    ngaySoan: { type: String },
    ngayMuon: { type: String },
    ngayTra: { type: String },
    datCoc: { type: Number },
    nguoiKiem: { type: String },
    noiDung: { type: String },
    trangThai: { type: String },
    dsMuon: [mongoose.Schema.Types.Mixed],
    dsTra: [mongoose.Schema.Types.Mixed]
  }
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
        // Lấy đơn giá và các thông tin snapshot từ DB nếu chưa có
        if (!item.donGia || !item.loaiDichVu || !item.tenDichVuSnapshot) {
          let dichVuGoc = null;
          if (item.dichVu) {
            try {
              dichVuGoc = await DICHVU.findById(item.dichVu);
            } catch (e) {}
          }
          if (dichVuGoc) {
            if (!item.donGia) {
              item.donGia = dichVuGoc.giaTriDichVu;
            }
            if (!item.tenDichVuSnapshot) {
              item.tenDichVuSnapshot = dichVuGoc.tenDichVu;
            }
            if (!item.loaiDichVu) {
              item.loaiDichVu = dichVuGoc.loaiDichVu;
            }
            if (item.soLuongAnhChinhSua === undefined || item.soLuongAnhChinhSua === null) {
              item.soLuongAnhChinhSua = dichVuGoc.soLuongAnhChinhSua || 0;
            }
            if (item.soLuongAnh16x21 === undefined || item.soLuongAnh16x21 === null) {
              item.soLuongAnh16x21 = dichVuGoc.soLuongAnh16x21 || 0;
            }
            if (item.soLuongAnh20x30 === undefined || item.soLuongAnh20x30 === null) {
              item.soLuongAnh20x30 = dichVuGoc.soLuongAnh20x30 || 0;
            }
            if (item.soLuongAnh60x90 === undefined || item.soLuongAnh60x90 === null) {
              item.soLuongAnh60x90 = dichVuGoc.soLuongAnh60x90 || 0;
            }
            if (!item.trangDiemNgayAnHoi) {
              item.trangDiemNgayAnHoi = dichVuGoc.trangDiemNgayAnHoi || "";
            }
            if (!item.trangDiemNgayCuoi) {
              item.trangDiemNgayCuoi = dichVuGoc.trangDiemNgayCuoi || "";
            }
            if (!item.trangPhucChoDoiBeLe) {
              item.trangPhucChoDoiBeLe = dichVuGoc.trangPhucChoDoiBeLe || "";
            }
            if (!item.trangPhucCoDauNgayAnHoi) {
              item.trangPhucCoDauNgayAnHoi = dichVuGoc.trangPhucCoDauNgayAnHoi || "";
            }
            if (!item.trangPhucChuReNgayAnHoi) {
              item.trangPhucChuReNgayAnHoi = dichVuGoc.trangPhucChuReNgayAnHoi || "";
            }
            if (!item.trangPhucVayCuoiNgayCuoi) {
              item.trangPhucVayCuoiNgayCuoi = dichVuGoc.trangPhucVayCuoiNgayCuoi || "";
            }
            if (!item.trangPhucVestChuReNgayCuoi) {
              item.trangPhucVestChuReNgayCuoi = dichVuGoc.trangPhucVestChuReNgayCuoi || "";
            }
            if (!item.hoaCamTay) {
              item.hoaCamTay = dichVuGoc.hoaCamTay || "";
            }
          }
        }

        // Tính thanhTien từng item (trừ giảm giá trực tiếp trên từng dịch vụ)
        const soLuong = Number(item.soLuong) || 0;
        const donGia = Number(item.donGia) || 0;
        const giamGiaDichVu = Number(item.giamGiaDichVu) || 0;
        item.thanhTien = Math.max(0, (soLuong * donGia) - giamGiaDichVu);
        
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

    // 6. Tính phần trăm (%) đã thanh toán
    if (tongSauGiam > 0) {
      const pt = (daThanhToan / tongSauGiam) * 100;
      this.thanhToan.phanTramDaThanhToan = Math.min(100, Math.max(0, Math.round(pt * 10) / 10));
    } else {
      this.thanhToan.phanTramDaThanhToan = daThanhToan > 0 ? 100 : 0;
    }

    // 7. Cập nhật trạng thái thanh toán
    if (this.thanhToan.conLai <= 0 && (daThanhToan > 0 || tongSauGiam === 0)) {
      this.thanhToan.trangThaiThanhToan = "Đã thanh toán đủ";
    } else if (daThanhToan > 0) {
      this.thanhToan.trangThaiThanhToan = "Đang thanh toán";
    } else {
      this.thanhToan.trangThaiThanhToan = "Chưa thanh toán";
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("hopDong", hopDongSchema);
