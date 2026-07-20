const mongoose = require("mongoose");

const loaiHopDongSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, unique: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("loaiHopDong", loaiHopDongSchema);
