const mongoose = require("mongoose");

const discrepancySchema = new mongoose.Schema({
    maHopDong: { type: String, default: "" },
    type: {
        type: String,
        enum: [
            'PAYMENT_MISMATCH',
            'LEDGER_MISSING',
            'EXPENSE_MISMATCH',
            'UNBALANCED_ENTRY',
            'CONTRACT_CACHE_MISMATCH'
        ],
        required: true
    },
    description: { type: String, required: true },
    expected: { type: Number, default: 0 },
    actual: { type: Number, default: 0 },
    diff: { type: Number, default: 0 },
    repaired: { type: Boolean, default: false }
}, { _id: false });

const reconciliationRunSchema = new mongoose.Schema({
    runCode: { type: String, required: true, unique: true }, // e.g. "REC-20261106-0001"
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    initiatedBy: { type: String, default: "Hệ thống" },
    dryRun: { type: Boolean, default: true },
    scope: {
        type: String,
        enum: ['ALL', 'CONTRACT', 'DATE_RANGE'],
        default: 'ALL'
    },
    filterParams: {
        contractCode: { type: String, default: "" },
        startDate: { type: Date },
        endDate: { type: Date }
    },
    
    // Thống kê đối soát
    contractsScanned: { type: Number, default: 0 },
    totalContractRevenue: { type: Number, default: 0 },
    totalPaidInContracts: { type: Number, default: 0 },
    totalPaidInPayments: { type: Number, default: 0 },
    totalPaidInLedger: { type: Number, default: 0 },
    totalExpensesInChiTieu: { type: Number, default: 0 },
    totalExpensesInLedger: { type: Number, default: 0 },
    
    // Kiểm tra định khoản kép
    totalLedgerDebits: { type: Number, default: 0 },
    totalLedgerCredits: { type: Number, default: 0 },
    isDoubleEntryBalanced: { type: Boolean, default: true },
    
    // Kết quả phát hiện & sửa sai
    discrepancyCount: { type: Number, default: 0 },
    repairedCount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'],
        default: 'COMPLETED'
    },
    
    discrepancies: [discrepancySchema],
    
    // Invariants kiểm định chất lượng (T-LEDGER01, T-REPORT01)
    invariantsChecked: {
        T_LEDGER01_passed: { type: Boolean, default: true },
        T_REPORT01_passed: { type: Boolean, default: true },
        doubleEntryBalanced: { type: Boolean, default: true }
    },
    
    summary: { type: String, default: "" }
}, {
    timestamps: true
});

reconciliationRunSchema.index({ startedAt: -1 });

module.exports = mongoose.model("ReconciliationRun", reconciliationRunSchema);
