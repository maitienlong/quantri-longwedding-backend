const mongoose = require("mongoose");

const storeTargetSchema = new mongoose.Schema({
    periodType: { 
        type: String, 
        enum: ['week', 'month', 'quarter', 'year', 'custom'], 
        default: 'month',
        required: true 
    },
    // Key format: '2026-08' for month, '2026-Q3' for quarter, '2026' for year
    periodKey: { 
        type: String, 
        required: true,
        unique: true 
    },
    year: { type: Number, required: true },
    month: { type: Number }, // 1-12 (if month)
    quarter: { type: Number }, // 1-4 (if quarter)
    
    // Store Targets
    targetRevenue: { type: Number, default: 0 }, // Doanh thu mục tiêu (VNĐ)
    targetContracts: { type: Number, default: 0 }, // Số lượng hợp đồng mục tiêu
    targetProfit: { type: Number, default: 0 }, // Lãi ròng mục tiêu (VNĐ)
    targetNewCustomers: { type: Number, default: 0 }, // Khách hàng mới mục tiêu
    growthRateExpected: { type: Number, default: 0 }, // % Tăng trưởng kỳ vọng so với kỳ trước
    bonusPool: { type: Number, default: 0 }, // Quỹ thưởng thi đua nếu hoàn thành / vượt chỉ tiêu (VNĐ)
    
    // Notes & Action Plan
    notes: { type: String, default: "" }, // Ghi chú mục tiêu / Chiến dịch thi đua
    updatedBy: { type: String }
}, { 
    timestamps: true 
});

module.exports = mongoose.model("store_targets", storeTargetSchema);
