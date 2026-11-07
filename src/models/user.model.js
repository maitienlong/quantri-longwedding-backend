const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullname: { type: String },
    birthday: { type: String },
    positon: { type: String, required: true },
    permission: { type: Number, required: true },
    permissions: [{ type: String }], // Danh sách mã quyền tính năng chi tiết (vd: 'tongquan', 'banhang', 'lichcuahang', ...)
    avatar: { type: String },
    luongCoBan: { type: Number, default: 0 },
    luongHoaHong: { type: Number, default: 0 },
    loaiHoaHong: { type: Number, default: 0 }, // 0: VNĐ / công việc, 1: % Doanh số
    chiTieuTuan: { type: Number, default: 5 },
    chiTieuThang: { type: Number, default: 20 },
    chiTieuNam: { type: Number, default: 200 },
    chiTieuDoanhSoThang: { type: Number, default: 0 }, // Doanh số chỉ tiêu cá nhân (VNĐ)
    heSoThuong: { type: Number, default: 1 },
    hoaHongTheoLoaiHD: [{
        loaiHopDongId: { type: Number },
        loaiHoaHong: { type: Number, default: 0 },
        mucHoaHong: { type: Number, default: 0 }
    }], // Hệ số thưởng thi đua
    tokenVersion: { type: Number, default: 0 },
    refreshTokens: [{
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Hash password trước khi lưu
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Hàm kiểm tra password khi login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Hàm sinh và lưu Refresh Token bảo mật (chỉ lưu hash SHA-256 trên server)
userSchema.methods.createRefreshToken = function (expiresInDays = 30) {
  const crypto = require("crypto");
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  if (!this.refreshTokens) this.refreshTokens = [];
  // Loại bỏ các token đã hết hạn
  this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt && t.expiresAt > new Date());

  // Giới hạn tối đa 10 phiên hoạt động đồng thời
  if (this.refreshTokens.length >= 10) {
    this.refreshTokens.shift();
  }

  this.refreshTokens.push({ tokenHash, expiresAt });
  return rawToken;
};

module.exports = mongoose.model("users", userSchema);
