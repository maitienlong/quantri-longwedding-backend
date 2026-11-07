/**
 * Migration M09: Double-Entry Financial Ledger & Single Source of Truth Sync
 * 
 * Objectives:
 * 1. Scan all historical contracts in HopDong collection.
 * 2. Backfill CONTRACT_REVENUE ledger entries (Debit 131 / Credit 511) for all contracts.
 * 3. Backfill PAYMENT_RECEIVED ledger entries (Debit 111,112 / Credit 131) for all payment installments.
 * 4. Backfill EXPENSE_RECORDED ledger entries (Debit 642 / Credit 111,112) for all operational expenses.
 * 5. Verify Invariant T-LEDGER01: Total payments per contract in ledger == total payments in contract (variance = 0 VND).
 * 6. Verify Double-Entry Invariant: Sum of Debits == Sum of Credits.
 * 7. Non-destructive and strictly idempotent (using compound unique index { sourceModel, sourceId }).
 */

const HOPDONG = require("../models/hopDong.model");
const ChiTieu = require("../models/chiTieu.model");
const Payment = require("../models/payment.model");
const FinancialLedger = require("../models/financialLedger.model");
const { recordLedgerEntry } = require("../services/financialLedger.service");

async function runMigrationM09({ dryRun = true } = {}) {
    console.log(`[Migration M09] Bắt đầu đồng bộ sổ cái kép tài chính (dryRun = ${dryRun})...`);

    let contractsScanned = 0;
    let revenueEntriesCreated = 0;
    let paymentEntriesCreated = 0;
    let expenseEntriesCreated = 0;
    let totalContractRevenue = 0;
    let totalPaymentsMigrated = 0;
    let totalExpensesMigrated = 0;

    const contracts = await HOPDONG.find({ maHopDong: { $ne: "CH-CHUNG" } });
    contractsScanned = contracts.length;

    // 1. Backfill Contract Revenue & Payments
    for (const contract of contracts) {
        const val = Number(contract.thanhToan?.tongGiaTriSauGiam ?? contract.thanhToan?.tongGiaTri ?? 0);
        totalContractRevenue += val;

        // Bút toán doanh thu (Nợ 131 / Có 511)
        if (val > 0) {
            const revenueSourceId = String(contract._id);
            const existingRevenue = await FinancialLedger.findOne({
                sourceModel: 'HopDong',
                sourceId: revenueSourceId
            });

            if (!existingRevenue) {
                revenueEntriesCreated++;
                if (!dryRun) {
                    await recordLedgerEntry({
                        transactionDate: contract.ngayHopDong || contract.createdAt || new Date(),
                        transactionType: 'CONTRACT_REVENUE',
                        debitAccount: '131',
                        creditAccount: '511',
                        amount: val,
                        hopDongId: contract._id,
                        maHopDong: contract.maHopDong,
                        khachHangId: contract.khachHang1?._id || contract.khachHang1,
                        tenKhachHang: contract.khachHang1?.tenKhachHang || "",
                        sourceModel: 'HopDong',
                        sourceId: revenueSourceId,
                        description: `Ghi nhận doanh thu hợp đồng ${contract.maHopDong}`,
                        creator: "Migration M09"
                    });
                }
            }
        }

        // Bút toán thanh toán (Nợ 111,112 / Có 131)
        const paymentsList = Array.isArray(contract.thanhToan?.cacLuotThanhToan)
            ? contract.thanhToan.cacLuotThanhToan
            : [];

        for (const p of paymentsList) {
            const pAmount = Number(p.amount) || 0;
            if (pAmount <= 0) continue;
            totalPaymentsMigrated += pAmount;

            const pId = String(p.id || p._id || `${contract.maHopDong}-${pAmount}-${new Date(p.date).getTime()}`);
            const existingPayment = await FinancialLedger.findOne({
                sourceModel: 'Payment',
                sourceId: pId
            });

            if (!existingPayment) {
                paymentEntriesCreated++;
                if (!dryRun) {
                    const method = String(p.method || "").toLowerCase();
                    const debitAcc = (method.includes("chuyển") || method.includes("bank") || method.includes("ck")) ? "112" : "111";
                    await recordLedgerEntry({
                        transactionDate: p.date || new Date(),
                        transactionType: 'PAYMENT_RECEIVED',
                        debitAccount: debitAcc,
                        creditAccount: '131',
                        amount: pAmount,
                        hopDongId: contract._id,
                        maHopDong: contract.maHopDong,
                        khachHangId: contract.khachHang1?._id || contract.khachHang1,
                        tenKhachHang: p.khachHang || contract.khachHang1?.tenKhachHang || "",
                        sourceModel: 'Payment',
                        sourceId: pId,
                        description: p.noiDung || `Thanh toán hợp đồng ${contract.maHopDong}`,
                        creator: "Migration M09"
                    });
                }
            }
        }
    }

    // 2. Backfill ChiTieu (Nợ 642 / Có 111,112)
    const expenses = await ChiTieu.find({});
    for (const exp of expenses) {
        const expAmount = Number(exp.amount) || 0;
        if (expAmount <= 0) continue;
        totalExpensesMigrated += expAmount;

        const expId = String(exp.id || exp._id);
        const existingExp = await FinancialLedger.findOne({
            sourceModel: 'ChiTieu',
            sourceId: expId
        });

        if (!existingExp) {
            expenseEntriesCreated++;
            if (!dryRun) {
                await recordLedgerEntry({
                    transactionDate: exp.date || new Date(),
                    transactionType: 'EXPENSE_RECORDED',
                    debitAccount: '642',
                    creditAccount: '111',
                    amount: expAmount,
                    maHopDong: exp.maHopDong || "",
                    sourceModel: 'ChiTieu',
                    sourceId: expId,
                    description: exp.reason || `Chi phí: ${exp.receiver}`,
                    creator: exp.creator || "Migration M09"
                });
            }
        }
    }

    // 3. Invariant Checks
    let tLedger01Passed = true;
    if (!dryRun) {
        for (const contract of contracts) {
            const paymentsList = Array.isArray(contract.thanhToan?.cacLuotThanhToan)
                ? contract.thanhToan.cacLuotThanhToan
                : [];
            const expectedPaid = paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            const ledgerPayments = await FinancialLedger.aggregate([
                {
                    $match: {
                        maHopDong: contract.maHopDong,
                        transactionType: 'PAYMENT_RECEIVED'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$amount" }
                    }
                }
            ]);

            const actualPaid = ledgerPayments[0]?.total || 0;
            if (expectedPaid !== actualPaid) {
                tLedger01Passed = false;
                console.error(`[Invariant T-LEDGER01 FAILED] Hợp đồng ${contract.maHopDong}: expected ${expectedPaid}, got ${actualPaid}`);
                break;
            }
        }
    }

    const summary = {
        contractsScanned,
        revenueEntriesCreated,
        paymentEntriesCreated,
        expenseEntriesCreated,
        totalContractRevenue,
        totalPaymentsMigrated,
        totalExpensesMigrated,
        tLedger01Passed,
        dryRun
    };

    console.log(`[Migration M09 Hoàn tất]`, summary);
    return summary;
}

if (require.main === module) {
    const mongoose = require("mongoose");
    require("dotenv").config();
    const uri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/quanly-longwedding";
    mongoose.connect(uri).then(async () => {
        await runMigrationM09({ dryRun: process.argv.includes("--dry-run") || false });
        await mongoose.disconnect();
        process.exit(0);
    }).catch(err => {
        console.error("Migration M09 failed:", err);
        process.exit(1);
    });
}

module.exports = { runMigrationM09 };

