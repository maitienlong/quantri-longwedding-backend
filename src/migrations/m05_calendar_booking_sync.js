/**
 * Migration M05: Calendar Entries to Booking / ResourceAssignment Sync
 * 
 * Objectives:
 * 1. Scan all contracts in HopDong collection.
 * 2. Extract scheduled photography, makeup, and service events.
 * 3. Convert them into structured Booking documents with resource assignments.
 * 4. Detect historical scheduling overlaps/conflicts and report them clearly.
 * 5. Idempotent: Re-running will not duplicate Booking records.
 */

const HopDong = require("../models/hopDong.model");
const Booking = require("../models/booking.model");
const { intervalsOverlap, getEffectiveWindow } = require("../services/booking.service");

async function runMigrationM05({ dryRun = true, contractCode = null } = {}) {
    console.log(`🔍 [Migration M05] Bắt đầu đồng bộ lịch sang Booking (dryRun = ${dryRun}${contractCode ? `, contract = ${contractCode}` : ""})...`);

    const query = {};
    if (contractCode) {
        query.maHopDong = contractCode;
    }

    const contracts = await HopDong.find(query);
    let totalScanned = contracts.length;
    let totalSchedulesExtracted = 0;
    let totalBookingsCreated = 0;
    let totalBookingsUpdated = 0;
    let historicalConflicts = [];

    const extractedEvents = [];

    for (const hd of contracts) {
        let schedules = [];

        if (Array.isArray(hd.serviceSchedules) && hd.serviceSchedules.length > 0) {
            schedules = hd.serviceSchedules.map((s, idx) => ({
                scheduleId: s.id || `sch-${idx}-${s.serviceType}`,
                serviceType: s.serviceType === 'makeup' ? 'MAKEUP' : 'PHOTO',
                title: `${hd.maHopDong} - ${s.serviceName || (s.serviceType === 'makeup' ? 'Trang điểm' : 'Chụp hình')}`,
                ngayGio: s.ngayGio,
                nhanVien: s.nhanVien,
                diaDiem: s.diaDiem || "Tại Studio",
                ghiChu: s.ghiChu || ""
            }));
        } else {
            if (Array.isArray(hd.lichChup)) {
                hd.lichChup.forEach((lc, idx) => {
                    schedules.push({
                        scheduleId: lc.id || `lc-${idx}`,
                        serviceType: 'PHOTO',
                        title: `${hd.maHopDong} - Chụp hình lượt ${idx + 1}`,
                        ngayGio: lc.ngayGio || lc.ngayChup,
                        nhanVien: lc.nhanVien || lc.thoChupHinh || hd.nguoiPhucVu?.thoChupHinh || "",
                        diaDiem: lc.diaDiem || hd.cacNgay?.diaDiemChup || "Tại Studio",
                        ghiChu: lc.ghiChu || ""
                    });
                });
            }
            if (Array.isArray(hd.lichTrangDiem)) {
                hd.lichTrangDiem.forEach((mk, idx) => {
                    schedules.push({
                        scheduleId: mk.id || `mk-${idx}`,
                        serviceType: 'MAKEUP',
                        title: `${hd.maHopDong} - Trang điểm lượt ${idx + 1}`,
                        ngayGio: mk.ngayTrangDiem || mk.ngay,
                        nhanVien: mk.thoMakeUp || hd.nguoiPhucVu?.thoMakeUp || "",
                        diaDiem: mk.diaDiem || "Tại Studio",
                        ghiChu: mk.ghiChu || ""
                    });
                });
            }
            if (schedules.length === 0 && hd.cacNgay?.ngayChup) {
                schedules.push({
                    scheduleId: `cacNgay-chup-${hd._id}`,
                    serviceType: 'PHOTO',
                    title: `${hd.maHopDong} - Lịch chụp ảnh`,
                    ngayGio: hd.cacNgay.ngayChup,
                    nhanVien: hd.nguoiPhucVu?.thoChupHinh || "",
                    diaDiem: hd.cacNgay.diaDiemChup || "Tại Studio",
                    ghiChu: ""
                });
            }
        }

        for (const item of schedules) {
            if (!item.ngayGio) continue;
            const startTime = new Date(item.ngayGio);
            if (isNaN(startTime.getTime())) continue;

            const durationHours = item.serviceType === 'MAKEUP' ? 2 : 3;
            const endTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);

            extractedEvents.push({
                contractId: String(hd._id),
                maHopDong: hd.maHopDong,
                scheduleId: item.scheduleId,
                legacyScheduleId: `${hd._id}_${item.scheduleId}`,
                serviceType: item.serviceType,
                title: item.title,
                startTime,
                endTime,
                nhanVien: item.nhanVien || "",
                diaDiem: item.diaDiem,
                ghiChu: item.ghiChu
            });
            totalSchedulesExtracted++;
        }
    }

    // Check for historical conflicts within extracted events
    for (let i = 0; i < extractedEvents.length; i++) {
        for (let j = i + 1; j < extractedEvents.length; j++) {
            const evA = extractedEvents[i];
            const evB = extractedEvents[j];

            if (evA.nhanVien && evB.nhanVien && evA.nhanVien === evB.nhanVien) {
                if (intervalsOverlap(evA.startTime, evA.endTime, evB.startTime, evB.endTime)) {
                    historicalConflicts.push({
                        staff: evA.nhanVien,
                        contractA: evA.maHopDong,
                        eventA: evA.title,
                        timeA: `${evA.startTime.toISOString()} - ${evA.endTime.toISOString()}`,
                        contractB: evB.maHopDong,
                        eventB: evB.title,
                        timeB: `${evB.startTime.toISOString()} - ${evB.endTime.toISOString()}`
                    });
                }
            }
        }
    }

    // Apply mode: Persist to Booking collection
    if (!dryRun) {
        for (const ev of extractedEvents) {
            let booking = await Booking.findOne({ "legacyRef.scheduleId": ev.legacyScheduleId });
            const resources = [];
            if (ev.nhanVien) {
                resources.push({
                    resourceId: ev.nhanVien,
                    resourceType: ev.serviceType === 'MAKEUP' ? 'STAFF_MAKEUP' : 'STAFF_PHOTO',
                    resourceName: ev.nhanVien,
                    role: ev.serviceType === 'MAKEUP' ? 'Thợ makeup' : 'Thợ chụp chính'
                });
            }

            if (booking) {
                booking.startTime = ev.startTime;
                booking.endTime = ev.endTime;
                booking.resources = resources;
                booking.diaDiem = ev.diaDiem;
                booking.ghiChu = ev.ghiChu;
                await booking.save();
                totalBookingsUpdated++;
            } else {
                const maBooking = `BK-M05-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
                booking = new Booking({
                    maBooking,
                    maHopDong: ev.maHopDong,
                    title: ev.title,
                    bookingType: ev.serviceType,
                    startTime: ev.startTime,
                    endTime: ev.endTime,
                    status: 'CONFIRMED',
                    resources,
                    diaDiem: ev.diaDiem,
                    ghiChu: ev.ghiChu,
                    conflictOverride: {
                        isOverridden: true,
                        reason: "Historical schedule backfill via Migration M05",
                        approvedBy: "Migration M05",
                        approvedAt: new Date()
                    },
                    legacyRef: {
                        source: 'HopDong',
                        contractId: ev.contractId,
                        scheduleId: ev.legacyScheduleId
                    },
                    confirmedAt: new Date(),
                    confirmedBy: "Migration M05"
                });
                await booking.save();
                totalBookingsCreated++;
            }
        }
    }

    const summary = {
        dryRun,
        contractsScanned: totalScanned,
        schedulesExtracted: totalSchedulesExtracted,
        bookingsCreated: totalBookingsCreated,
        bookingsUpdated: totalBookingsUpdated,
        historicalConflictsCount: historicalConflicts.length,
        historicalConflicts
    };

    console.log(`🏁 [Migration M05 Hoàn tất] Hợp đồng quét: ${totalScanned} | Lịch trích xuất: ${totalSchedulesExtracted} | Đã tạo: ${totalBookingsCreated} | Đã cập nhật: ${totalBookingsUpdated} | Trùng lịch lịch sử: ${historicalConflicts.length}`);
    return summary;
}

module.exports = {
    runMigrationM05
};

