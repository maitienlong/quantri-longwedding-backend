const mongoose = require("mongoose");
const DICHVU = require("./dichVu.model");
const HOPDONG = require("./hopDong.model");

const cartItemSchema = new mongoose.Schema({
  dichVu: {
    type: mongoose.Schema.Types.ObjectId,
    ref: DICHVU, // Tham chiếu đến model DichVu
    required: true
  },
  tenDichVuSnapshot: String, // Lưu tên để hiển thị nhanh không cần populate
  soLuong: { type: Number, min: 1 },
});


const thueDoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    maHopDong: {
        type: mongoose.Schema.Types.ObjectId,
        ref: HOPDONG, 
        required: true
      },
    danhSach: [cartItemSchema],
    ngayThue: { type: Date, required: true },
    ngayTra: { type: Date, required: true },
    noiDung: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model("thuedo", thueDoSchema);
