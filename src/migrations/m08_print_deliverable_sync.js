/**
 * Migration M08: Print Deliverables, Factory Tracking & QC Acceptance Sync
 * 
 * Objectives:
 * 1. Scan all contracts in HopDong collection.
 * 2. Backfill PrintDeliverable records from contract package snapshots, cart items, or hauKy.thongTinInAn.
 * 3. Preserve legacy print records without data corruption.
 * 4. For completed contracts (Giai đoạn 4), mark existing deliverables as QC_PASSED or DA_BAN_GIAO.
 * 5. Strictly non-destructive and fully idempotent.
 */

const HOPDONG = require("../models/hopDong.model");
const PrintDeliverable = require("../models/printDeliverable.model");
const { autoSyncContractDeliverables } = require("../services/printDeliverable.service");

async function runMigrationM08({ dryRun = true } = {}) {
    console.log(`🔍 [Migration M08] Bắt đầu đồng bộ danh mục sản phẩm in ấn & xưởng gia công (dryRun = ${dryRun})...`);

    let contractsScanned = 0;
    let deliverablesCreated = 0;
    let deliverablesUpdated = 0;

    const contracts = await HOPDONG.find({});
    contractsScanned = contracts.length;

    for (const contract of contracts) {
        if (!contract.maHopDong) continue;

        const existingItems = await PrintDeliverable.find({ maHopDong: contract.maHopDong });

        // Nếu hợp đồng đã qua giai đoạn 3 (In ảnh) hoặc có thông tin xưởng in nhưng chưa có PrintDeliverable
        const hasPrintActivity = (
            contract.giaiDoan >= 3 ||
            (contract.hauKy?.thongTinInAn?.tenXuongIn && contract.hauKy.thongTinInAn.tenXuongIn.trim().length > 0) ||
            (Array.isArray(contract.hauKy?.danhSachMaAnhChon) && contract.hauKy.danhSachMaAnhChon.length > 0)
        );

        if (existingItems.length === 0 && hasPrintActivity) {
            if (!dryRun) {
                const synced = await autoSyncContractDeliverables(contract, "Migration M08");
                deliverablesCreated += synced.length;
            } else {
                deliverablesCreated += 2; // Dự kiến ít nhất 2 sản phẩm (ảnh cổng + photobook)
            }
        } else if (existingItems.length > 0 && contract.giaiDoan === 4) {
            // Đối với hợp đồng đã hoàn thành, đảm bảo các sản phẩm in cũ được ghi nhận QC_PASSED / DA_BAN_GIAO
            for (const item of existingItems) {
                if (item.trangThai === 'CHUA_GUI_IN' || item.trangThai === 'DA_GUI_XUONG' || item.trangThai === 'XUONG_DA_GIAO') {
                    deliverablesUpdated++;
                    if (!dryRun) {
                        item.trangThai = 'DA_BAN_GIAO';
                        item.kiemTraQC.ketQua = 'PASSED';
                        item.kiemTraQC.thoiGianKiemTra = contract.updatedAt || new Date();
                        item.kiemTraQC.nguoiKiemTra = 'Migration M08 (Historical Backfill)';
                        item.banGiaoKhach.ngayBanGiao = contract.updatedAt || new Date();
                        item.auditLog.push({
                            action: 'QC_BACKFILLED',
                            performedBy: 'Migration M08',
                            timestamp: new Date(),
                            details: { reason: 'Contract already completed' }
                        });
                        await item.save();
                    }
                }
            }
        }
    }

    const summary = {
        contractsScanned,
        deliverablesCreated,
        deliverablesUpdated,
        dryRun
    };

    console.log(`🏁 [Migration M08 Hoàn tất]`, summary);
    return summary;
}

if (require.main === module) {
    const mongoose = require("mongoose");
    require("dotenv").config();
    const uri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/quanly-longwedding";
    mongoose.connect(uri).then(async () => {
        await runMigrationM08({ dryRun: process.argv.includes("--dry-run") || false });
        await mongoose.disconnect();
        process.exit(0);
    }).catch(err => {
        console.error("Migration M08 failed:", err);
        process.exit(1);
    });
}

module.exports = { runMigrationM08 };

