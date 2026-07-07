const mongoose = require("mongoose");

const lichSoanDoSchema = new mongoose.Schema({
    maHopDong: { type: String, required: true },
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong", required: true },
    ngaySoan: { type: String },
    ngayMuon: { type: String },
    ngayTra: { type: String },
    datCoc: { type: Number, default: 0 },
    nguoiKiem: { type: String },
    noiDung: { type: String },
    trangThai: { type: String, default: "Chưa mượn" }, // 'Chưa mượn', 'Đang mượn', 'Đã trả'
    dsMuon: [mongoose.Schema.Types.Mixed],
    dsTra: [mongoose.Schema.Types.Mixed]
}, {
    timestamps: true
});

module.exports = mongoose.model("lichSoanDo", lichSoanDoSchema);
