const mongoose = require("mongoose");

const resourceItemSchema = new mongoose.Schema({
    resourceId: { type: String, required: true }, // Username or Resource ID
    resourceType: {
        type: String,
        enum: ['STAFF_PHOTO', 'STAFF_MAKEUP', 'STAFF_ASSISTANT', 'STUDIO_SET', 'EQUIPMENT', 'OTHER'],
        default: 'STAFF_PHOTO'
    },
    resourceName: { type: String, default: "" },
    role: { type: String, default: "" }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
    maBooking: { type: String, required: true, unique: true },
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong" },
    maHopDong: { type: String, default: "" },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "KhachHang" },
    tenKhachHang: { type: String, default: "" },
    soDienThoai: { type: String, default: "" },
    bookingType: {
        type: String,
        enum: ['PHOTO', 'MAKEUP', 'STUDIO_SET', 'AN_HOI', 'NGAY_CUOI', 'OTHER'],
        default: 'PHOTO'
    },
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    bufferMinutesBefore: { type: Number, default: 0 },
    bufferMinutesAfter: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['TENTATIVE', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
        default: 'TENTATIVE'
    },
    resources: [resourceItemSchema],
    diaDiem: { type: String, default: "Tại Studio" },
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
        source: { type: String }, // e.g. 'HopDong'
        contractId: { type: String },
        scheduleId: { type: String }
    },
    confirmedAt: { type: Date },
    confirmedBy: { type: String },
    version: { type: Number, default: 1 }
}, {
    timestamps: true
});

// Indexes for high-performance scheduling queries
bookingSchema.index({ startTime: 1, endTime: 1 });
bookingSchema.index({ "resources.resourceId": 1, startTime: 1, endTime: 1 });
bookingSchema.index({ maHopDong: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ "legacyRef.scheduleId": 1 });

module.exports = mongoose.model("Booking", bookingSchema);

