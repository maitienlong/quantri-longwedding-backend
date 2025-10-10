const mongoose = require("mongoose");

const dichVuSchema = new mongoose.Schema({
    maDichVu: { type: String, required: true, unique: true },
    tenDichVu: { type: String, required: true },
    soLuong: { type: Number, required: true },
    donGia: { type: Number, required: true },  
    moTa: { type: String }
}, {
    timestamps: true
});
8
module.exports = mongoose.model("dichVu", dichVuSchema);
