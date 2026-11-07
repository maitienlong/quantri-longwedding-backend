const mongoose = require("mongoose");

const wardrobeReservationSchema = new mongoose.Schema({
    maPhieu: { type: String, required: true, unique: true },
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong" },
    maHopDong: { type: String, default: "" },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "KhachHang" },
    tenKhachHang: { type: String, default: "" },
    soDienThoai: { type: String, default: "" },
    trangPhucId: { type: mongoose.Schema.Types.ObjectId, ref: "trangPhuc" },
    maTrangPhuc: { type: String, required: true, uppercase: true, trim: true },
    tenTrangPhuc: { type: String, default: "" },
    startDate: { type: Date, required: true }, // Ngày hẹn lấy đồ
    endDate: { type: Date, required: true },   // Ngày hẹn trả đồ
    cleaningBufferHours: { type: Number, default: 24 }, // Thời gian đệm giặt hấp (giờ)
    status: {
        type: String,
        enum: ['RESERVED', 'IN_USE', 'RETURNED', 'CANCELLED'],
        default: 'RESERVED'
    },
    checkOut: {
        actualDate: { type: Date },
        performedBy: { type: String, default: "" },
        conditionNotes: { type: String, default: "" },
        photos: [{ type: String }]
    },
    checkIn: {
        actualDate: { type: Date },
        receivedBy: { type: String, default: "" },
        conditionNotes: { type: String, default: "" },
        damageFee: { type: Number, default: 0 },
        photos: [{ type: String }]
    },
    ghiChu: { type: String, default: "" },
    conflictOverride: {
        isOverridden: { type: Boolean, default: false },
        reason: { type: String, default: "" },
        approvedBy: { type: String, default: "" },
        approvedAt: { type: Date }
    },
    auditLog: [
        {
            action: { type: String },
            performedBy: { type: String },
            timestamp: { type: Date, default: Date.now },
            details: { type: mongoose.Schema.Types.Mixed }
        }
    ],
    legacyRef: {
        source: { type: String }, // e.g. 'HopDong.trangPhucGiu' or 'LichSoanDo'
        contractId: { type: String },
        scheduleId: { type: String }
    }
}, {
    timestamps: true
});

// Indexes for conflict checking and lookup
wardrobeReservationSchema.index({ maTrangPhuc: 1, startDate: 1, endDate: 1 });
wardrobeReservationSchema.index({ status: 1 });
wardrobeReservationSchema.index({ maHopDong: 1 });
wardrobeReservationSchema.index({ "legacyRef.scheduleId": 1 });

module.exports = mongoose.model("WardrobeReservation", wardrobeReservationSchema);

