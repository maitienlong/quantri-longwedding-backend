const mongoose = require("mongoose");
const KHACHHANG = require("./khachHang.model");
const payment = require("./payment.model");
const DICHVU = require("./dichVu.model");
const { applyPricingToContract, snapshotContractPackage } = require("../services/contractPricing");

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
  detailsSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },

  soLuongLichChup: { type: Number, default: 0 },
  soLuongLichMake: { type: Number, default: 0 },
  soLuongLichQuay: { type: Number, default: 0 },
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
    diaDiemTrangDiem: { type: String },
    ngayQuayPhim: { type: Date },
    gioQuayPhim: { type: String },
    diaDiemQuayPhim: { type: String }
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
  lichChup: [
    {
      id: { type: String },
      dichVuId: { type: String },
      tenDichVu: { type: String },
      ngayGio: { type: Date },
      ngayChup: { type: Date },
      gioChup: { type: String },
      diaDiem: { type: String },
      thoChupHinh: { type: String },
      nhanVien: { type: String },
      ghiChu: { type: String }
    }
  ],
  lichQuayPhim: [
    {
      id: { type: String },
      dichVuId: { type: String },
      tenDichVu: { type: String },
      ngayGio: { type: Date },
      ngayQuay: { type: Date },
      gioQuay: { type: String },
      diaDiem: { type: String },
      thoQuayPhim: { type: String },
      nhanVien: { type: String },
      ghiChu: { type: String }
    }
  ],
  serviceSchedules: [
    {
      id: { type: String },
      serviceId: { type: String },
      serviceName: { type: String },
      serviceType: { type: String },
      luot: { type: Number, default: 1 },
      totalLuot: { type: Number, default: 1 },
      ngayGio: { type: String },
      diaDiem: { type: String },
      nhanVien: { type: String },
      ghiChu: { type: String }
    }
  ],
  nguoiPhucVu: {
    thoChupHinh: { type: String },
    thoChinhAnh: { type: String },
    thoMakeUp: { type: String },
    thoQuayPhim: { type: String },
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
  extraDriveLinks: [
    {
      id: { type: String },
      name: { type: String, default: "" },
      url: { type: String, default: "" },
      createdAt: { type: Date, default: Date.now }
    }
  ],
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
      details: { type: mongoose.Schema.Types.Mixed },
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
  packageSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
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
  try {
    // 1. Duyệt giỏ hàng để lấy giá, snapshot chi tiết dịch vụ và tính tổng
    if (this.gioHang && this.gioHang.length > 0) {
      for (let item of this.gioHang) {
        if (!item.donGia || !item.loaiDichVu || !item.tenDichVuSnapshot || !item.detailsSnapshot) {
          let dichVuGoc = null;
          if (item.dichVu) {
            try {
              dichVuGoc = await DICHVU.findById(item.dichVu);
            } catch (e) { }
          }
          if (dichVuGoc) {
            snapshotContractPackage(item, dichVuGoc);
          }
        }

        const soLuong = Math.max(1, Number(item.soLuong) || 1);
        const donGia = Number(item.donGia) || 0;
        const giamGiaDichVu = Math.max(0, Number(item.giamGiaDichVu) || 0);
        item.thanhTien = Math.max(0, (soLuong * donGia) - giamGiaDichVu);
      }
    }

    // 2. Snapshot gói chính (packageSnapshot) nếu chưa có
    if (!this.packageSnapshot && this.gioHang && this.gioHang.length > 0) {
      const primaryItem = this.gioHang[0];
      this.packageSnapshot = {
        packageName: primaryItem.tenDichVuSnapshot || "",
        unitPrice: primaryItem.donGia || 0,
        deliverables: primaryItem.detailsSnapshot?.deliverables || [],
        photoSchedules: primaryItem.detailsSnapshot?.photoSchedules || [],
        makeupSessions: primaryItem.detailsSnapshot?.makeupSessions || [],
        wardrobe: primaryItem.detailsSnapshot?.wardrobe || [],
        snapshotAt: this.ngayHopDong || new Date()
      };
    }

    // 3. Tính toán toàn bộ thông số giá và công nợ thống nhất
    applyPricingToContract(this);

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
