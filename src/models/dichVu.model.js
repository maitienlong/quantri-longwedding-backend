const mongoose = require("mongoose");

const dichVuSchema = new mongoose.Schema({
    maDichVu: { type: String, required: true, unique: true },
    tenDichVu: { type: Date, required: true },
    soLuong: { type: Date, required: true }
}, {
    timestamps: true,
    collection: "hopdongs"
});
8
module.exports = mongoose.model("DichVu", dichVuSchema);
