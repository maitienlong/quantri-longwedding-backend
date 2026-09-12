const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    group: { type: String, default: "Bạn Chú Rể" },
    fbUrl: { type: String, default: "" },
    fbId: { type: String, default: "" },
    avatar: { type: String, default: "" },
    customGreeting: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

const rsvpSchema = new mongoose.Schema({
    guestName: { type: String, required: true },
    phone: { type: String, default: "" },
    status: { type: String, default: "attending" },
    attendingPart: { type: String, default: "tiecCuoi" },
    guestsCount: { type: Number, default: 1 },
    note: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

const wishSchema = new mongoose.Schema({
    senderName: { type: String, required: true },
    senderAvatar: { type: String, default: "" },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const thiepCuoiSchema = new mongoose.Schema({
    invitationId: { type: String, required: true, unique: true, index: true },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "khachhang", index: true },
    maHopDong: { type: String, default: "" },
    templateId: { type: String, default: "tpl-luxury-gold" },
    themeId: { type: String, default: "luxury-gold" },
    title: { type: String, default: "Thiệp Cưới Online" },
    
    groom: {
        name: { type: String, default: "" },
        nickname: { type: String, default: "" },
        fatherName: { type: String, default: "" },
        motherName: { type: String, default: "" },
        hometown: { type: String, default: "" },
        order: { type: String, default: "Trưởng Nam" },
        avatar: { type: String, default: "" },
        bank: { type: String, default: "MB Bank" },
        accountNumber: { type: String, default: "" },
        accountName: { type: String, default: "" },
        phone: { type: String, default: "" }
    },
    bride: {
        name: { type: String, default: "" },
        nickname: { type: String, default: "" },
        fatherName: { type: String, default: "" },
        motherName: { type: String, default: "" },
        hometown: { type: String, default: "" },
        order: { type: String, default: "Ái Nữ" },
        avatar: { type: String, default: "" },
        bank: { type: String, default: "Vietcombank" },
        accountNumber: { type: String, default: "" },
        accountName: { type: String, default: "" },
        phone: { type: String, default: "" }
    },

    mainPhoto: { type: String, default: "" },
    quote: { type: String, default: "" },

    vuQuy: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "LỄ VU QUY" },
        time: { type: String, default: "08:30" },
        dateSolar: { type: String, default: "" },
        dateLunarText: { type: String, default: "" },
        locationName: { type: String, default: "Tư Gia Nhà Gái" },
        address: { type: String, default: "" },
        mapUrl: { type: String, default: "" }
    },
    thanhHon: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "LỄ THÀNH HÔN" },
        time: { type: String, default: "11:00" },
        dateSolar: { type: String, default: "" },
        dateLunarText: { type: String, default: "" },
        locationName: { type: String, default: "Tư Gia Nhà Trai" },
        address: { type: String, default: "" },
        mapUrl: { type: String, default: "" }
    },
    tiecCuoi: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "TIỆC MỪNG TRỌNG ĐẠI" },
        time: { type: String, default: "17:30" },
        dateSolar: { type: String, default: "" },
        dateLunarText: { type: String, default: "" },
        locationName: { type: String, default: "Trung Tâm Tiệc Cưới" },
        address: { type: String, default: "" },
        mapUrl: { type: String, default: "" }
    },

    gallery: [{ type: String }],
    loveStory: [{
        year: String,
        title: String,
        content: String
    }],

    musicUrl: { type: String, default: "" },
    musicTitle: { type: String, default: "" },
    effectType: { type: String, default: "sparkles" },
    envelopeStyle: { type: String, default: "wax-seal" },
    showGiftBox: { type: Boolean, default: true },
    showRsvp: { type: Boolean, default: true },
    showGuestbook: { type: Boolean, default: true },

    guestList: [guestSchema],
    rsvps: [rsvpSchema],
    wishes: [wishSchema],

    isPublished: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("thiepcuoi", thiepCuoiSchema);
