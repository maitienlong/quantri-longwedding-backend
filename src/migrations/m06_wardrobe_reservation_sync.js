/**
 * Migration M06: Garment History to WardrobeReservation Sync & Inventory Audit
 * 
 * Objectives:
 * 1. Scan all garments in TrangPhuc collection.
 * 2. Mark garments without recent usage or inspection evidence as 'NEEDS_INVENTORY' (never auto-mark all as available).
 * 3. Scan HopDong.trangPhucGiu and LichSoanDo to backfill WardrobeReservation records.
 * 4. Detect historical overlapping reservations without data loss.
 * 5. Fully idempotent.
 */

const TrangPhuc = require("../models/trangPhuc.model");
const HopDong = require("../models/hopDong.model");
const WardrobeReservation = require("../models/wardrobeReservation.model");
const { intervalsOverlapWithBuffer } = require("../services/wardrobe.service");

async function runMigrationM06({ dryRun = true, markInventoryDays = 60 } = {}) {
    console.log(`🔍 [Migration M06] Bắt đầu đồng bộ kho trang phục & phiếu mượn (dryRun = ${dryRun})...`);

    let garmentsScanned = 0;
    let garmentsMarkedNeedsInventory = 0;
    let reservationsScanned = 0;
    let reservationsCreated = 0;
    let reservationsUpdated = 0;
    const historicalConflicts = [];

    // 1. Audit garments inventory status
    const garments = await TrangPhuc.find({});
    garmentsScanned = garments.length;

    const inventoryCutoff = new Date(Date.now() - (markInventoryDays * 24 * 60 * 60 * 1000));

    for (const g of garments) {
        // If garment is marked SAN_SANG but has not been updated or used in > markInventoryDays, flag as NEEDS_INVENTORY
        const lastActivity = g.updatedAt || g.createdAt || new Date(0);
        if (g.tinhTrang === 'SAN_SANG' && lastActivity < inventoryCutoff) {
            garmentsMarkedNeedsInventory++;
            if (!dryRun) {
                g.tinhTrang = 'NEEDS_INVENTORY';
                if (!g.maintenanceHistory) g.maintenanceHistory = [];
                g.maintenanceHistory.push({
                    action: 'KIEM_KE',
                    startDate: new Date(),
                    notes: `Tự động đánh dấu cần kiểm kê bởi Migration M06 (Không có hoạt động trong ${markInventoryDays} ngày qua)`,
                    performedBy: 'Migration M06'
                });
                await g.save();
            }
        }
    }

    // 2. Scan HopDong for garment holds
    const contracts = await HopDong.find({
        "trangPhucGiu.0": { $exists: true }
    });

    const extractedReservations = [];

    for (const hd of contracts) {
        if (!Array.isArray(hd.trangPhucGiu)) continue;

        for (let idx = 0; idx < hd.trangPhucGiu.length; idx++) {
            const item = hd.trangPhucGiu[idx];
            if (!item.maTrangPhuc) continue;

            reservationsScanned++;
            const sDate = item.ngayHenLay ? new Date(item.ngayHenLay) : (hd.cacNgay?.ngayChup || hd.ngayHopDong || new Date());
            const eDate = item.ngayHenTra ? new Date(item.ngayHenTra) : new Date(sDate.getTime() + 2 * 24 * 3600 * 1000);

            let status = 'RESERVED';
            if (item.trangThai === 'DANG_MUON') status = 'IN_USE';
            else if (item.trangThai === 'DA_TRA') status = 'RETURNED';
            else if (item.trangThai === 'HUY' || hd.subGiaiDoan === 'huy') status = 'CANCELLED';

            extractedReservations.push({
                contractId: String(hd._id),
                maHopDong: hd.maHopDong,
                scheduleId: `${hd._id}_tp_${idx}`,
                maTrangPhuc: item.maTrangPhuc.toUpperCase().trim(),
                tenTrangPhuc: item.tenTrangPhuc || item.maTrangPhuc,
                startDate: sDate,
                endDate: eDate,
                cleaningBufferHours: 24,
                status,
                tinhTrangKhiTra: item.tinhTrangKhiTra || "",
                tienCocDo: Number(item.tienCocDo) || 0
            });
        }
    }

    // 3. Detect historical conflicts among active extracted holds
    for (let i = 0; i < extractedReservations.length; i++) {
        for (let j = i + 1; j < extractedReservations.length; j++) {
            const rA = extractedReservations[i];
            const rB = extractedReservations[j];

            if (rA.maTrangPhuc === rB.maTrangPhuc && rA.status !== 'CANCELLED' && rB.status !== 'CANCELLED') {
                if (intervalsOverlapWithBuffer(rA.startDate, rA.endDate, rA.cleaningBufferHours, rB.startDate, rB.endDate, rB.cleaningBufferHours)) {
                    historicalConflicts.push({
                        maTrangPhuc: rA.maTrangPhuc,
                        contractA: rA.maHopDong,
                        datesA: `${rA.startDate.toISOString()} - ${rA.endDate.toISOString()}`,
                        contractB: rB.maHopDong,
                        datesB: `${rB.startDate.toISOString()} - ${rB.endDate.toISOString()}`
                    });
                }
            }
        }
    }

    // 4. Apply mode: Upsert WardrobeReservation
    if (!dryRun) {
        for (const ev of extractedReservations) {
            const legacyScheduleId = `${ev.contractId}_${ev.scheduleId}`;
            let existing = await WardrobeReservation.findOne({ "legacyRef.scheduleId": legacyScheduleId });

            if (existing) {
                existing.startDate = ev.startDate;
                existing.endDate = ev.endDate;
                existing.status = ev.status;
                existing.maTrangPhuc = ev.maTrangPhuc;
                await existing.save();
                reservationsUpdated++;
            } else {
                const maPhieu = `WR-M06-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
                const newRes = new WardrobeReservation({
                    maPhieu,
                    maHopDong: ev.maHopDong,
                    maTrangPhuc: ev.maTrangPhuc,
                    tenTrangPhuc: ev.tenTrangPhuc,
                    startDate: ev.startDate,
                    endDate: ev.endDate,
                    cleaningBufferHours: ev.cleaningBufferHours,
                    status: ev.status,
                    legacyRef: {
                        source: 'HopDong.trangPhucGiu',
                        contractId: ev.contractId,
                        scheduleId: legacyScheduleId
                    },
                    conflictOverride: {
                        isOverridden: true,
                        reason: "Historical garment hold migrated via Migration M06",
                        approvedBy: "Migration M06",
                        approvedAt: new Date()
                    },
                    auditLog: [
                        {
                            action: "Khởi tạo từ dữ liệu lịch sử (Migration M06)",
                            performedBy: "Migration M06",
                            timestamp: new Date()
                        }
                    ]
                });
                await newRes.save();
                reservationsCreated++;
            }
        }
    }

    const summary = {
        dryRun,
        garmentsScanned,
        garmentsMarkedNeedsInventory,
        reservationsScanned,
        reservationsCreated,
        reservationsUpdated,
        historicalConflictsCount: historicalConflicts.length,
        historicalConflicts
    };

    console.log(`🏁 [Migration M06 Hoàn tất] Trang phục quét: ${garmentsScanned} | Cần kiểm kê: ${garmentsMarkedNeedsInventory} | Lịch mượn quét: ${reservationsScanned} | Đã tạo phiếu: ${reservationsCreated} | Đã cập nhật: ${reservationsUpdated} | Trùng lịch sử: ${historicalConflicts.length}`);
    return summary;
}

module.exports = {
    runMigrationM06
};

