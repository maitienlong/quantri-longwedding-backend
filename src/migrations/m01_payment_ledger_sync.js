/**
 * M01: Data Migration Script - Payment & Receipt Ledger Unification
 * Run modes:
 * - Dry-run: node src/migrations/m01_payment_ledger_sync.js --dry-run
 * - Apply:   node src/migrations/m01_payment_ledger_sync.js --apply
 * - Verify:  node src/migrations/m01_payment_ledger_sync.js --verify
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { reconcilePayments } = require("../services/reconciliation.service");

async function main() {
    const args = process.argv.slice(2);
    const isApply = args.includes("--apply");
    const isVerify = args.includes("--verify");
    const isDryRun = !isApply && !isVerify;

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/quantri-longwedding";

    console.log("==========================================================");
    console.log(" M01: PAYMENT & RECEIPT LEDGER UNIFICATION MIGRATION");
    console.log("==========================================================");
    console.log(`Chế độ: ${isApply ? "APPLY (Ghi CSDL)" : (isVerify ? "VERIFY (Xác nhận sau migration)" : "DRY-RUN (Chỉ kiểm tra)")}`);

    if (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(mongoUri);
            console.log("✅ Đã kết nối cơ sở dữ liệu MongoDB thành công.");
        } catch (connErr) {
            console.error("❌ Không thể kết nối MongoDB:", connErr.message);
            process.exit(1);
        }
    }

    try {
        const result = await reconcilePayments({
            dryRun: !isApply,
            contractCode: null
        });

        console.log("\n------------------ KẾT QUẢ ĐỐI SOÁT ------------------");
        console.log(`Tổng hợp đồng đã quét:       ${result.totalContractsScanned}`);
        console.log(`Số hợp đồng phát hiện lệch:   ${result.discrepanciesFound}`);
        if (isApply) {
            console.log(`Số hợp đồng đã sửa chữa:      ${result.repairedContracts}`);
            console.log(`Số bản ghi Payment tạo mới:   ${result.missingPaymentDocsCreated}`);
        }

        if (result.details.length > 0) {
            console.log("\nChi tiết hợp đồng có sai lệch:");
            result.details.slice(0, 10).forEach(d => {
                console.log(` - HĐ [${d.maHopDong}]: ${d.issues.join("; ")}`);
            });
            if (result.details.length > 10) {
                console.log(` ... và còn ${result.details.length - 10} hợp đồng khác.`);
            }
        }

        if (isVerify) {
            if (result.discrepanciesFound === 0) {
                console.log("\n🎉 [XÁC MINH THÀNH CÔNG] Sổ cái thanh toán hoàn toàn khớp 100%!");
            } else {
                console.error(`\n⚠️ [XÁC MINH CHƯA ĐẠT] Vẫn còn ${result.discrepanciesFound} hợp đồng chưa khớp.`);
                process.exit(1);
            }
        }

    } catch (err) {
        console.error("❌ Lỗi trong quá trình migration M01:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Đã đóng kết nối cơ sở dữ liệu.");
    }
}

if (require.main === module) {
    main();
}

module.exports = main;

