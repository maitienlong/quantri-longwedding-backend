const mongoose = require("mongoose");

const loaiDichVuSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, unique: true, trim: true },
  prefix: { type: String, default: "", trim: true },
  icon: { type: String, default: "📦" },
  color: { type: String, default: "#2563eb" },
  badgeBg: { type: String, default: "#dbeafe" },
  description: { type: String, default: "" }
}, {
  timestamps: true
});

module.exports = mongoose.model("loaiDichVu", loaiDichVuSchema);
