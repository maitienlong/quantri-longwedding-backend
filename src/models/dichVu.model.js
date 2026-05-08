const mongoose = require("mongoose");

const dichVuSchema = new mongoose.Schema({
    maDichVu: { type: String, required: true, unique: true },
    loaiDichVu: { type: Number, required: true },
    tenDichVu: { type: String, required: true },
    tonKhoDichVu: { type: Number, required: true },
    giaTriDichVu: { type: Number, required: true },
    giaChoThueDichVu: { type: Number, required: true },
    moTaDichVu: { type: String },
    imageDichVu: { type: String }
}, {
    timestamps: true
});
8
module.exports = mongoose.model("dichVu", dichVuSchema);
