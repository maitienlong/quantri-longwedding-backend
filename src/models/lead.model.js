const mongoose = require("mongoose");
const { normalizePhoneNumber } = require("../utils/phoneUtils");

const leadSchema = new mongoose.Schema({
  maLead: { type: String, required: true, unique: true },
  hoTen: { type: String, required: true, trim: true },
  soDienThoai: { type: String, trim: true },
  normalizedPhone: { type: String },
  facebookId: { type: String, default: "" },
  facebookName: { type: String, default: "" },
  zaloId: { type: String, default: "" },
  nguonLead: { 
    type: String, 
    enum: ['MESSENGER', 'ZALO', 'WEBSITE', 'TRUC_TIEP', 'GIOI_THIEU', 'N8N', 'TIKTOK', 'KHAC'], 
    default: 'MESSENGER' 
  },
  ngayCuoiDuKien: { type: Date },
  dichVuChinh: { type: Number, default: 1 },
  goiQuanTam: { type: String, default: "" },
  nganSachDuKien: { type: Number, default: 0 },
  salePhuTrach: { type: String, default: "" },
  trangThai: { 
    type: String, 
    enum: ['MOI', 'DANG_TU_VAN', 'HEN_LICH_TEST', 'DA_CHOT', 'HUY', 'KHONG_TIEM_NANG'], 
    default: 'MOI' 
  },
  ghiChu: { type: String, default: "" },
  lichSuTuVan: [
    {
      noiDung: { type: String, required: true },
      nguoiGhi: { type: String, default: "Sale" },
      thoiGian: { type: Date, default: Date.now }
    }
  ],
  khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: 'khachhang' },
  hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: 'hopDong' },
  maHopDongChuyenDoi: { type: String, default: "" },
  ngayChuyenDoi: { type: Date }
}, {
  timestamps: true
});

leadSchema.pre('save', function (next) {
  if (this.soDienThoai) {
    this.normalizedPhone = normalizePhoneNumber(this.soDienThoai);
  }
  next();
});

leadSchema.index({ normalizedPhone: 1 });
leadSchema.index({ trangThai: 1 });
leadSchema.index({ salePhuTrach: 1 });

module.exports = mongoose.model("lead", leadSchema);
