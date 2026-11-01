const mongoose = require("mongoose");

const photoRetouchSubSchema = new mongoose.Schema({
    editedFileCount: { type: Number, default: 0, min: 0 },
    rawFileStatus: { type: String, enum: ['included', 'excluded', 'unset'], default: 'unset' },
    deliveryDays: { type: Number, default: 0, min: 0 },
    note: { type: String, default: "" }
}, { _id: false });

const photoScheduleSubSchema = new mongoose.Schema({
    id: { type: String, default: "" },
    occasion: { type: String, default: "studio" },
    sessionCount: { type: Number, default: 1, min: 0 },
    dayCount: { type: Number, default: 1, min: 0 },
    location: { type: String, default: "" },
    staff: { type: String, default: "" },
    note: { type: String, default: "" }
}, { _id: false });

const deliverableSubSchema = new mongoose.Schema({
    id: { type: String, default: "" },
    kind: { type: String, default: "photo_print" },
    name: { type: String, default: "" },
    widthCm: { type: Number, required: true, min: 1 },
    heightCm: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 0 },
    material: { type: String, default: "" },
    note: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 }
}, { _id: false });

const makeupSessionSubSchema = new mongoose.Schema({
    id: { type: String, default: "" },
    occasion: { type: String, default: "unspecified" },
    recipient: { type: String, default: "bride" },
    sessionCount: { type: Number, default: 1, min: 0 },
    location: { type: String, default: "" },
    note: { type: String, default: "" }
}, { _id: false });

const wardrobeSubSchema = new mongoose.Schema({
    id: { type: String, default: "" },
    occasion: { type: String, default: "" },
    recipient: { type: String, default: "" },
    itemType: { type: String, default: "" },
    quantity: { type: Number, default: 1, min: 0 },
    unit: { type: String, default: "bộ" },
    maxValueVnd: { type: Number, default: 0, min: 0 },
    legacyNote: { type: String, default: "" },
    note: { type: String, default: "" }
}, { _id: false });

const extraBenefitSubSchema = new mongoose.Schema({
    id: { type: String, default: "" },
    title: { type: String, default: "" },
    quantity: { type: Number, default: 1, min: 0 },
    included: { type: String, enum: ['included', 'excluded', 'unset'], default: 'included' },
    estimatedValueVnd: { type: Number, default: 0, min: 0 },
    note: { type: String, default: "" }
}, { _id: false });

const termConditionSubSchema = new mongoose.Schema({
    id: { type: String, default: "" },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    visibleToCustomer: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
}, { _id: false });

const packageDetailsSchema = new mongoose.Schema({
    photoRetouch: { type: photoRetouchSubSchema, default: () => ({}) },
    photoSchedules: [photoScheduleSubSchema],
    deliverables: [deliverableSubSchema],
    makeupSessions: [makeupSessionSubSchema],
    wardrobe: [wardrobeSubSchema],
    extras: [extraBenefitSubSchema],
    terms: [termConditionSubSchema]
}, { _id: false });

const dichVuSchema = new mongoose.Schema({
    maDichVu: { type: String, required: true, unique: true },
    loaiDichVu: { type: Number, required: true },
    tenDichVu: { type: String, required: true },
    tonKhoDichVu: { type: Number, required: true },
    giaTriDichVu: { type: Number, required: true },
    giaChoThueDichVu: { type: Number, required: true },
    moTaDichVu: { type: String },
    imageDichVu: { type: String },
    templateId: { type: String, default: "" },
    accessType: { type: String, default: "vip" },
    badge: { type: String, default: "" },
    category: { type: String, default: "" },

    // Schema versioning for packages (1: legacy, 2: dynamic 7 accordions)
    schemaVersion: { type: Number, default: 1 },
    details: { type: packageDetailsSchema, default: null },

    // Legacy fields preserved for 100% backward compatibility
    soLuongAnhChinhSua: { type: Number, default: 0 },
    soLuongAnh16x21: { type: Number, default: 0 },
    soLuongAnh20x30: { type: Number, default: 0 },
    soLuongAnh60x90: { type: Number, default: 0 },
    trangDiemNgayAnHoi: { type: String, default: "" },
    trangDiemNgayCuoi: { type: String, default: "" },
    trangPhucChoDoiBeLe: { type: String, default: "" },
    trangPhucCoDauNgayAnHoi: { type: String, default: "" },
    trangPhucChuReNgayAnHoi: { type: String, default: "" },
    trangPhucVayCuoiNgayCuoi: { type: String, default: "" },
    trangPhucVestChuReNgayCuoi: { type: String, default: "" },
    hoaCamTay: { type: String, default: "" },
    soLuongLichChup: { type: Number, default: 0 },
    soLuongLichMake: { type: Number, default: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model("dichVu", dichVuSchema);
