const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullname: { type: String },
    birthday: { type: String },
    positon: { type: String, required: true },
    permission: { type: Number, required: true }
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

