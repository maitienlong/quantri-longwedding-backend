const mongoose = require("mongoose");

const usageHistorySchema = new mongoose.Schema({
  hopDongId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "HopDong"
  },
  maHopDong: {
    type: String,
    required: true
  },
  khachHangId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "KhachHang"
  },
  tenKhachHang: {
    type: String,
    default: ""
  },
  soDienThoai: {
    type: String,
    default: ""
  },
  giamGiaAmount: {
    type: Number,
    required: true,
    default: 0
  },
  usedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Schema cho danh sách nhiều mã code con được sinh ra trong cùng một chương trình
const generatedCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  isClaimed: {
    type: Boolean,
    default: false
  },
  claimedName: {
    type: String,
    default: ""
  },
  claimedPhone: {
    type: String,
    default: ""
  },
  claimedAt: {
    type: Date,
    default: null
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date,
    default: null
  },
  usedContract: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Mã Voucher không được để trống"],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: [true, "Tên chương trình ưu đãi không được để trống"],
    trim: true
  },
  description: {
    type: String,
    default: "",
    trim: true
  },
  discountType: {
    type: Number,
    required: true,
    enum: [0, 1], // 0: Số tiền cố định (VNĐ), 1: Phần trăm (%)
    default: 0
  },
  discountValue: {
    type: Number,
    required: [true, "Giá trị giảm không được để trống"],
    min: [0, "Giá trị giảm không thể âm"]
  },
  maxDiscount: {
    type: Number,
    default: 0 // Giảm tối đa nếu là % (0 = không giới hạn)
  },
  minOrderValue: {
    type: Number,
    default: 0 // Đơn hàng tối thiểu để áp dụng
  },
  usageLimit: {
    type: Number,
    default: null // Tổng số lượt dùng tối đa (null hoặc 0 = không giới hạn)
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usageLimitPerCustomer: {
    type: Number,
    default: 1 // Mỗi khách hàng được dùng tối đa bao nhiêu lần
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableContractTypes: {
    type: [Number], // Mảng các loaiHopDong ID (rỗng = áp dụng cho tất cả các loại HĐ)
    default: []
  },
  winningRate: {
    type: Number, // Tỷ lệ bốc thăm trúng thưởng (0 - 100%)
    default: 50,
    min: [0, "Tỷ lệ trúng thưởng không thể âm"],
    max: [100, "Tỷ lệ trúng thưởng tối đa 100%"]
  },
  // Danh sách các mã code con độc nhất được sinh cho chương trình này
  generatedCodes: [generatedCodeSchema],
  usageHistory: [usageHistorySchema],
  createdBy: {
    type: String,
    default: "Hệ thống"
  }
}, {
  timestamps: true
});

voucherSchema.index({ code: 1, isActive: 1 });
voucherSchema.index({ "generatedCodes.code": 1 });

module.exports = mongoose.model("Voucher", voucherSchema);
