const mongoose = require("mongoose");

const kichThuocAnhSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  widthCm: { type: Number, required: true, min: 1 },
  heightCm: { type: Number, required: true, min: 1 },
  unit: { type: String, default: "cm", trim: true },
  isDefault: { type: Boolean, default: false },
  description: { type: String, default: "", trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("kichThuocAnh", kichThuocAnhSchema);

