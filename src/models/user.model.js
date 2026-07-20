const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullname: { type: String },
    birthday: { type: String },
    positon: { type: String, required: true },
    permission: { type: Number, required: true },
    avatar: { type: String },
    luongCoBan: { type: Number, default: 0 },
    luongHoaHong: { type: Number, default: 0 },
    loaiHoaHong: { type: Number, default: 0 }, // 0: VNĐ / công việc, 1: % Doanh số
    chiTieuTuan: { type: Number, default: 5 },
    chiTieuThang: { type: Number, default: 20 },
    chiTieuNam: { type: Number, default: 200 }
}, { timestamps: true });

// Hash password trước khi lưu
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // Nếu password chưa thay đổi thì bỏ qua

  try {
    const salt = await bcrypt.genSalt(10); // độ mạnh 10 rounds
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

module.exports = mongoose.model("users", userSchema);

