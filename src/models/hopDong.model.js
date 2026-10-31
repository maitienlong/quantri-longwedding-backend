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
    ref: DICHVU,
    required: false
  },
  tenDichVuSnapshot: String,
  loaiDichVu: { type: Number },
  soLuong: { type: Number, min: 1 },
  donGia: { type: Number },
  giamGiaDichVu: { type: Number, default: 0 },
  thanhTien: { type: Number },

  soLuongLichChup: { type: Number, default: 0 },
  soLuongLichMake: { type: Number, default: 0 },
  soLuot: { type: Number, default: 1 },
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
  contractType: { 
    type: String, 
    enum: ['FULL_WEDDING', 'SINGLE_SERVICE'], 
    default: 'FULL_WEDDING' 
  },
  ngayHopDong: { type: Date, required: true, set: toDate },

  khachHang1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: KHACHHANG,
    required: true
  },

  khachHang2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: KHACHHANG
  },
  gioHang: [cartItemSchema],
  thanhToan: {
    tongGiaTri: { type: Number },
    tongPhatSinh: { type: Number, default: 0 },
    giamGia: { type: Number },
    loaiGiamGia: { type: Number },
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
  subGiaiDoan: { 
    type: String, 
    enum: [
      'dang_thuc_hien', 
      'cho_chinh', 
      'dang_chinh', 
      'dang_hau_ky', 
      'da_giao_file_goc', 
      'khach_da_chon_anh', 
      'dang_chinh_anh', 
      'cho_khach_duyet', 
      'khach_duyet_anh', 
      'cho_khach_duyet_layout', 
      'khach_da_duyet_layout', 
      'da_gui_xuong_in', 
      'studio_da_nhan_hang', 
      'da_tra_khach', 
      'hoan_thanh',
      'bao_luu',
      'huy'
    ], 
    default: 'dang_thuc_hien' 
  },
  dichVuChinh: { type: Number, required: true },
  linkAnhGoc: { type: String },
  linkAnhChinhSua: { type: String },
  danhSachAnhIn: [
    {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    }
  ],
  
  // Phân hệ Hậu kỳ & In ấn mở rộng
  hauKy: {
    linkAnhGoc: { type: String, default: "" },
    linkAnhChon: { type: String, default: "" },
    danhSachMaAnhChon: [{ type: String }],
    linkLayoutMaket: { type: String, default: "" },
    soLanSuaLayout: { type: Number, default: 0 },
    layoutHistory: [
      {
        version: { type: Number, default: 1 },
        link: { type: String },
        note: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    thongTinInAn: {
      tenXuongIn: { type: String, default: "" },
      ngayGuiIn: { type: Date },
      ngayHenNhan: { type: Date },
      ngayNhanThucTe: { type: Date },
      chiPhiIn: { type: Number, default: 0 },
      ghiChuIn: { type: String, default: "" }
    }
  },

  // Phụ lục phát sinh (Add-on / Upsell sau ký)
  phuLucPhatSinh: [
    {
      id: { type: String },
      tenDichVu: { type: String, required: true },
      donGia: { type: Number, default: 0 },
      soLuong: { type: Number, default: 1 },
      thanhTien: { type: Number, default: 0 },
      ghiChu: { type: String, default: "" },
      ngayTao: { type: Date, default: Date.now },
      nguoiTao: { type: String, default: "" },
      isAddon: { type: Boolean, default: true }
    }
  ],

  // Lịch giữ trang phục tránh trùng ngày cưới / ăn hỏi
  trangPhucGiu: [
    {
      trangPhucId: { type: mongoose.Schema.Types.ObjectId, ref: 'trangPhuc' },
      maTrangPhuc: { type: String, required: true },
      tenTrangPhuc: { type: String },
      loaiTrangPhuc: { type: String },
      ngayHenLay: { type: Date },
      ngayHenTra: { type: Date },
      ngayLayThucTe: { type: Date },
      ngayTraThucTe: { type: Date },
      tinhTrangKhiTra: { type: String, default: "" },
      tienCocDo: { type: Number, default: 0 },
      trangThai: { 
        type: String, 
        enum: ['GIU_CHO', 'DANG_MUON', 'DA_TRA', 'HUY'], 
        default: 'GIU_CHO' 
      },
      ghiChu: { type: String, default: "" }
    }
  ],

  // Nhân sự & Phân bổ hoa hồng cho Ekip theo khâu
  hoaHongEkip: [
    {
      nhanVienId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
      tenNhanVien: { type: String, required: true },
      vaiTro: { type: String, required: true },
      loaiHoaHong: { type: Number, default: 0 },
      mucHoaHong: { type: Number, default: 0 },
      tienHoaHong: { type: Number, default: 0 },
      trangThai: { 
        type: String, 
        enum: ['PENDING', 'APPROVED', 'PAID'], 
        default: 'PENDING' 
      },
      ghiChu: { type: String, default: "" }
    }
  ],

  // Nhật ký thay đổi (Audit Log - Bắt buộc lý do khi sửa tiền, huỷ, bảo lưu)
  auditLog: [
    {
      action: { type: String, required: true },
      reason: { type: String, default: "" },
      oldValue: { type: mongoose.Schema.Types.Mixed },
      newValue: { type: mongoose.Schema.Types.Mixed },
      performedBy: { type: String, default: "Hệ thống" },
      role: { type: String, default: "" },
      timestamp: { type: Date, default: Date.now }
    }
  ],

  lichSuGiaiDoan: [
    {
      giaiDoan: { type: Number, required: true },
      subGiaiDoan: { type: String, default: 'dang_thuc_hien' },
      thoiGian: { type: Date, default: Date.now },
      nguoiThucHien: { type: String, default: 'Hệ thống' },
      vaiTro: { type: String },
      ghiChu: { type: String },
      duLieuKemTheo: { type: mongoose.Schema.Types.Mixed }
    }
  ],
  khachHangXacNhanAnh: {
    daXacNhan: { type: Boolean, default: false },
    thoiGianXacNhan: { type: Date },
    ghiChuKhachHang: { type: String }
  },
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
        if (!item.donGia || !item.loaiDichVu || !item.tenDichVuSnapshot) {
          let dichVuGoc = null;
          if (item.dichVu) {
            try {
              dichVuGoc = await DICHVU.findById(item.dichVu);
            } catch (e) {}
          }
          if (dichVuGoc) {
            if (!item.donGia) item.donGia = dichVuGoc.giaTriDichVu;
            if (!item.tenDichVuSnapshot) item.tenDichVuSnapshot = dichVuGoc.tenDichVu;
            if (!item.loaiDichVu) item.loaiDichVu = dichVuGoc.loaiDichVu;
            if (item.soLuongLichChup === undefined || item.soLuongLichChup === null) item.soLuongLichChup = dichVuGoc.soLuongLichChup || 0;
            if (item.soLuongLichMake === undefined || item.soLuongLichMake === null) item.soLuongLichMake = dichVuGoc.soLuongLichMake || 0;
            if (item.soLuongAnhChinhSua === undefined || item.soLuongAnhChinhSua === null) item.soLuongAnhChinhSua = dichVuGoc.soLuongAnhChinhSua || 0;
            if (item.soLuongAnh16x21 === undefined || item.soLuongAnh16x21 === null) item.soLuongAnh16x21 = dichVuGoc.soLuongAnh16x21 || 0;
            if (item.soLuongAnh20x30 === undefined || item.soLuongAnh20x30 === null) item.soLuongAnh20x30 = dichVuGoc.soLuongAnh20x30 || 0;
            if (item.soLuongAnh60x90 === undefined || item.soLuongAnh60x90 === null) item.soLuongAnh60x90 = dichVuGoc.soLuongAnh60x90 || 0;
            if (!item.trangDiemNgayAnHoi) item.trangDiemNgayAnHoi = dichVuGoc.trangDiemNgayAnHoi || "";
            if (!item.trangDiemNgayCuoi) item.trangDiemNgayCuoi = dichVuGoc.trangDiemNgayCuoi || "";
            if (!item.trangPhucChoDoiBeLe) item.trangPhucChoDoiBeLe = dichVuGoc.trangPhucChoDoiBeLe || "";
            if (!item.trangPhucCoDauNgayAnHoi) item.trangPhucCoDauNgayAnHoi = dichVuGoc.trangPhucCoDauNgayAnHoi || "";
            if (!item.trangPhucChuReNgayAnHoi) item.trangPhucChuReNgayAnHoi = dichVuGoc.trangPhucChuReNgayAnHoi || "";
            if (!item.trangPhucVayCuoiNgayCuoi) item.trangPhucVayCuoiNgayCuoi = dichVuGoc.trangPhucVayCuoiNgayCuoi || "";
            if (!item.trangPhucVestChuReNgayCuoi) item.trangPhucVestChuReNgayCuoi = dichVuGoc.trangPhucVestChuReNgayCuoi || "";
            if (!item.hoaCamTay) item.hoaCamTay = dichVuGoc.hoaCamTay || "";
          }
        }

        const soLuong = Number(item.soLuong) || 0;
        const donGia = Number(item.donGia) || 0;
        const giamGiaDichVu = Number(item.giamGiaDichVu) || 0;
        item.thanhTien = Math.max(0, (soLuong * donGia) - giamGiaDichVu);
        
        tongChuaGiam += item.thanhTien;
      }
    }

    // 1.1 Tính phụ lục phát sinh (Add-on / Upsell)
    let tongPhatSinh = 0;
    if (this.phuLucPhatSinh && this.phuLucPhatSinh.length > 0) {
      for (let addon of this.phuLucPhatSinh) {
        const sl = Number(addon.soLuong) || 1;
        const dg = Number(addon.donGia) || 0;
        addon.thanhTien = Math.max(0, sl * dg);
        tongPhatSinh += addon.thanhTien;
      }
    }
    this.thanhToan.tongPhatSinh = tongPhatSinh;
    tongChuaGiam += tongPhatSinh;

    // Gán tổng giá trị gốc (giữ lại tongGiaTri nếu giỏ hàng rỗng nhưng đã nhập tổng tiền trực tiếp)
    if (tongChuaGiam === 0 && (!this.gioHang || this.gioHang.length === 0) && Number(this.thanhToan.tongGiaTri) > 0) {
      tongChuaGiam = Number(this.thanhToan.tongGiaTri);
    } else {
      this.thanhToan.tongGiaTri = tongChuaGiam;
    }

    // 2. Logic Giảm Giá
    const giamGiaValue = Number(this.thanhToan.giamGia) || 0;
    const loaiGiamGia = this.thanhToan.loaiGiamGia;
    const voucherGiamGia = Number(this.thanhToan.voucherGiamGia) || 0;

    let soTienDuocGiam = 0;
    if (loaiGiamGia === 1) {
      soTienDuocGiam = (tongChuaGiam * giamGiaValue) / 100;
    } else {
      soTienDuocGiam = giamGiaValue;
    }
    soTienDuocGiam += voucherGiamGia;

    // 3. Tính tổng giá trị sau khi giảm
    const ketQua = tongChuaGiam - soTienDuocGiam;
    this.thanhToan.tongGiaTriSauGiam = Math.max(0, ketQua);

    // 4. Tính tổng khách hàng đã thanh toán
    if (this.thanhToan.cacLuotThanhToan && this.thanhToan.cacLuotThanhToan.length > 0) {
      this.thanhToan.khachHangDaThanhToan = this.thanhToan.cacLuotThanhToan.reduce((total, p) => total + (Number(p.amount) || 0), 0);
    } else {
      this.thanhToan.khachHangDaThanhToan = this.thanhToan.khachHangDaThanhToan || 0;
    }

    // 5. Tính tổng tiền còn lại
    const tongSauGiam = this.thanhToan.tongGiaTriSauGiam || 0;
    const daThanhToan = this.thanhToan.khachHangDaThanhToan || 0;
    this.thanhToan.conLai = Math.max(0, tongSauGiam - daThanhToan);

    // 6. Tính % đã thanh toán
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

// Indexes tối ưu hiệu năng truy vấn danh sách, báo cáo doanh thu và kiểm tra lịch
hopDongSchema.index({ ngayHopDong: -1 });
hopDongSchema.index({ giaiDoan: 1, subGiaiDoan: 1 });
hopDongSchema.index({ khachHang1: 1 });
hopDongSchema.index({ "cacNgay.ngayChup": 1 });
hopDongSchema.index({ "cacNgay.ngayCuoi": 1 });
hopDongSchema.index({ "trangPhucGiu.maTrangPhuc": 1, "trangPhucGiu.trangThai": 1 });

module.exports = mongoose.model("hopDong", hopDongSchema);
