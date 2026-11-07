const mongoose = require("mongoose");

const financialLedgerSchema = new mongoose.Schema({
    entryNumber: { type: String, required: true, unique: true }, // e.g. "LED-20261106-00001"
    transactionDate: { type: Date, required: true, index: true },
    transactionType: {
        type: String,
        enum: [
            'CONTRACT_REVENUE',     // Ghi nhận doanh thu hợp đồng mới ký / phát sinh (Nợ 131 / Có 511)
            'PAYMENT_RECEIVED',    // Khách hàng thanh toán tiền mặt / ngân hàng / SePay (Nợ 111,112 / Có 131)
            'CONTRACT_AMENDMENT',   // Phụ lục phát sinh / điều chỉnh giá trị hợp đồng
            'EXPENSE_RECORDED',    // Chi phí hoạt động / gia công xưởng in / studio (Nợ 642,627 / Có 111,112)
            'REFUND_ISSUED',       // Hoàn trả tiền cho khách (Nợ 131 / Có 111,112)
            'DISCOUNT_APPLIED'     // Giảm giá / chiết khấu / voucher (Nợ 521 / Có 131)
        ],
        required: true,
        index: true
    },
    debitAccount: { type: String, required: true, index: true },  // e.g. "111" (Tiền mặt), "112" (Ngân hàng), "131" (Phải thu), "642" (Chi phí)
    creditAccount: { type: String, required: true, index: true }, // e.g. "511" (Doanh thu), "131" (Phải thu), "111" (Tiền mặt), "112" (Ngân hàng)
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "VND" },

    // Liên kết nghiệp vụ
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong", index: true },
    maHopDong: { type: String, default: "", index: true },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "KhachHang" },
    tenKhachHang: { type: String, default: "" },

    // Nguồn gốc chứng từ gốc (Origin Reference)
    sourceModel: {
        type: String,
        enum: ['Payment', 'HopDong', 'ChiTieu', 'PrintDeliverable', 'SystemMigration'],
        required: true
    },
    sourceId: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    creator: { type: String, default: "Hệ thống" },

    // Kiểm toán & Đối soát
    isReconciled: { type: Boolean, default: false },
    reconciliationRunId: { type: mongoose.Schema.Types.ObjectId, ref: "ReconciliationRun" },
    isImmutable: { type: Boolean, default: true } // Sổ cái bất biến, không cho sửa trực tiếp
}, {
    timestamps: true
});

financialLedgerSchema.index({ transactionDate: -1 });
financialLedgerSchema.index({ maHopDong: 1, transactionDate: -1 });
financialLedgerSchema.index({ sourceModel: 1, sourceId: 1 }, { unique: true });

module.exports = mongoose.model("FinancialLedger", financialLedgerSchema);
