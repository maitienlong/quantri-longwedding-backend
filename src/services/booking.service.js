const Booking = require("../models/booking.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

/**
 * Checks whether two half-open intervals [A_start, A_end) and [B_start, B_end) overlap.
 * Overlap occurs if and only if: max(A_start, B_start) < min(A_end, B_end)
 * Equivalently: A_start < B_end && B_start < A_end
 */
function intervalsOverlap(startA, endA, startB, endB) {
    const sA = new Date(startA).getTime();
    const eA = new Date(endA).getTime();
    const sB = new Date(startB).getTime();
    const eB = new Date(endB).getTime();

    return sA < eB && sB < eA;
}

/**
 * Calculates effective time window taking optional buffers into account.
 */
function getEffectiveWindow(startTime, endTime, bufferBeforeMinutes = 0, bufferAfterMinutes = 0) {
    const s = new Date(startTime).getTime() - (bufferBeforeMinutes * 60 * 1000);
    const e = new Date(endTime).getTime() + (bufferAfterMinutes * 60 * 1000);
    return { effectiveStart: new Date(s), effectiveEnd: new Date(e) };
}

/**
 * Core conflict detection algorithm.
 * Searches for confirmed (and optionally tentative) bookings that share at least one resourceId
 * and have overlapping time intervals.
 */
async function findConflicts({
    startTime,
    endTime,
    resourceIds = [],
    excludeBookingId = null,
    bufferBefore = 0,
    bufferAfter = 0,
    checkTentative = false
}) {
    if (!resourceIds || resourceIds.length === 0) return [];

    const reqWin = getEffectiveWindow(startTime, endTime, bufferBefore, bufferAfter);

    // Query active bookings for the specified resources
    const statusQuery = checkTentative ? { $in: ['CONFIRMED', 'TENTATIVE'] } : 'CONFIRMED';
    const query = {
        status: statusQuery,
        "resources.resourceId": { $in: resourceIds }
    };

    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    const potentialBookings = await Booking.find(query);
    const conflicts = [];

    for (const b of potentialBookings) {
        const existWin = getEffectiveWindow(
            b.startTime,
            b.endTime,
            b.bufferMinutesBefore || 0,
            b.bufferMinutesAfter || 0
        );

        if (intervalsOverlap(reqWin.effectiveStart, reqWin.effectiveEnd, existWin.effectiveStart, existWin.effectiveEnd)) {
            // Identify which resource(s) overlap
            const matchedResources = b.resources.filter(r => resourceIds.includes(r.resourceId));
            for (const r of matchedResources) {
                conflicts.push({
                    bookingId: b._id,
                    maBooking: b.maBooking,
                    maHopDong: b.maHopDong || "",
                    title: b.title,
                    resourceId: r.resourceId,
                    resourceName: r.resourceName || r.resourceId,
                    resourceType: r.resourceType,
                    status: b.status,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    conflictWindow: {
                        start: existWin.effectiveStart,
                        end: existWin.effectiveEnd
                    }
                });
            }
        }
    }

    return conflicts;
}

/**
 * GET /api/v2/bookings/availability
 * Returns resource availability and busy intervals for a given date range.
 */
async function getAvailability(req, res) {
    try {
        const { start, end, resourceIds, bufferBefore = 0, bufferAfter = 0 } = req.query;

        if (!start || !end) {
            return error(res, "Thiếu tham số start hoặc end", 400);
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return error(res, "Định dạng thời gian không hợp lệ", 400);
        }

        if (startDate >= endDate) {
            return error(res, "Thời gian bắt đầu phải trước thời gian kết thúc", 400);
        }

        let rIds = [];
        if (resourceIds) {
            rIds = Array.isArray(resourceIds) ? resourceIds : resourceIds.split(",").map(s => s.trim()).filter(Boolean);
        }

        const query = {
            status: { $in: ['CONFIRMED', 'TENTATIVE'] },
            startTime: { $lt: endDate },
            endTime: { $gt: startDate }
        };

        if (rIds.length > 0) {
            query["resources.resourceId"] = { $in: rIds };
        }

        let queryChain = Booking.find(query);
        if (typeof queryChain.sort === 'function') {
            queryChain = queryChain.sort({ startTime: 1 });
        }
        const bookings = await queryChain;

        const resourceSchedules = {};
        for (const b of bookings) {
            for (const r of b.resources) {
                if (rIds.length > 0 && !rIds.includes(r.resourceId)) continue;
                if (!resourceSchedules[r.resourceId]) {
                    resourceSchedules[r.resourceId] = {
                        resourceId: r.resourceId,
                        resourceName: r.resourceName || r.resourceId,
                        busyIntervals: []
                    };
                }
                resourceSchedules[r.resourceId].busyIntervals.push({
                    bookingId: b._id,
                    maBooking: b.maBooking,
                    status: b.status,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    title: b.title
                });
            }
        }

        return success(res, "Kiểm tra tình trạng tài nguyên thành công", {
            queryRange: { start: startDate, end: endDate },
            totalBusyBookings: bookings.length,
            resources: resourceSchedules
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * GET /api/v2/bookings
 * List bookings with filtering and sorting.
 */
async function listBookings(req, res) {
    try {
        const { start, end, resourceId, status, maHopDong, bookingType, limit = 100, page = 1 } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }
        if (maHopDong) {
            query.maHopDong = new RegExp(maHopDong.trim(), "i");
        }
        if (bookingType && bookingType !== 'all') {
            query.bookingType = bookingType;
        }
        if (resourceId) {
            query["resources.resourceId"] = resourceId;
        }
        if (start || end) {
            query.startTime = {};
            if (start) query.startTime.$gte = new Date(start);
            if (end) query.startTime.$lte = new Date(end);
        }

        const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .sort({ startTime: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Booking.countDocuments(query)
        ]);

        return success(res, "Lấy danh sách booking thành công", {
            bookings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * GET /api/v2/bookings/:id
 */
async function getBookingById(req, res) {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return error(res, "Không tìm thấy booking", 404);
        return success(res, "Lấy thông tin booking thành công", booking);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/bookings
 * Create a new booking with conflict check when confirming.
 */
async function createBooking(req, res) {
    try {
        const {
            hopDongId,
            maHopDong,
            khachHangId,
            tenKhachHang,
            soDienThoai,
            bookingType = 'PHOTO',
            title,
            startTime,
            endTime,
            bufferMinutesBefore = 0,
            bufferMinutesAfter = 0,
            status = 'TENTATIVE',
            resources = [],
            diaDiem = 'Tại Studio',
            ghiChu = "",
            conflictOverride = {}
        } = req.body;

        if (!title) return error(res, "Tiêu đề booking không được để trống", 400);
        if (!startTime || !endTime) return error(res, "Thiếu thời gian bắt đầu hoặc kết thúc", 400);

        const sDate = new Date(startTime);
        const eDate = new Date(endTime);
        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
            return error(res, "Thời gian không hợp lệ", 400);
        }
        if (sDate >= eDate) {
            return error(res, "Thời gian bắt đầu phải trước thời gian kết thúc", 400);
        }

        const resourceIds = resources.map(r => r.resourceId).filter(Boolean);

        // Server-side conflict check if setting as CONFIRMED
        if (status === 'CONFIRMED') {
            const conflicts = await findConflicts({
                startTime: sDate,
                endTime: eDate,
                resourceIds,
                bufferBefore: Number(bufferMinutesBefore) || 0,
                bufferAfter: Number(bufferMinutesAfter) || 0
            });

            if (conflicts.length > 0) {
                // Check if manager override was provided
                const isOverridden = conflictOverride?.isOverridden === true && conflictOverride?.reason;
                if (!isOverridden) {
                    return res.status(409).json({
                        success: false,
                        message: "Xung đột lịch: Nhân sự hoặc tài nguyên đã có lịch xác nhận khác trong khoảng thời gian này.",
                        error: {
                            code: "SCHEDULING_CONFLICT",
                            conflicts
                        }
                    });
                }
            }
        }

        const maBooking = `BK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const booking = new Booking({
            maBooking,
            hopDongId,
            maHopDong: maHopDong || "",
            khachHangId,
            tenKhachHang: tenKhachHang || "",
            soDienThoai: soDienThoai || "",
            bookingType,
            title,
            startTime: sDate,
            endTime: eDate,
            bufferMinutesBefore: Number(bufferMinutesBefore) || 0,
            bufferMinutesAfter: Number(bufferMinutesAfter) || 0,
            status,
            resources,
            diaDiem,
            ghiChu,
            conflictOverride: {
                isOverridden: conflictOverride?.isOverridden || false,
                reason: conflictOverride?.reason || "",
                approvedBy: conflictOverride?.approvedBy || (conflictOverride?.isOverridden ? req.user?.fullname : ""),
                approvedAt: conflictOverride?.isOverridden ? new Date() : undefined
            },
            confirmedAt: status === 'CONFIRMED' ? new Date() : undefined,
            confirmedBy: status === 'CONFIRMED' ? (req.user?.fullname || "Hệ thống") : undefined,
            auditLog: [
                {
                    action: `Tạo booking (${status})`,
                    performedBy: req.user?.fullname || req.user?.username || "Nhân viên",
                    timestamp: new Date(),
                    details: { maBooking, status, startTime: sDate, endTime: eDate, resourcesCount: resources.length }
                }
            ]
        });

        await booking.save();

        createLog({
            action: `Tạo lịch booking ${maBooking}`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: { maBooking, title, status, startTime: sDate, endTime: eDate }
        });

        return success(res, "Tạo booking thành công", booking, 201);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * PATCH /api/v2/bookings/:id
 * Update booking with conflict check if status is/becomes CONFIRMED.
 */
async function updateBooking(req, res) {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return error(res, "Không tìm thấy booking", 404);

        const {
            title,
            startTime,
            endTime,
            bufferMinutesBefore,
            bufferMinutesAfter,
            resources,
            diaDiem,
            ghiChu,
            status,
            conflictOverride
        } = req.body;

        const nextStartTime = startTime ? new Date(startTime) : booking.startTime;
        const nextEndTime = endTime ? new Date(endTime) : booking.endTime;
        const nextBufferBefore = bufferMinutesBefore !== undefined ? Number(bufferMinutesBefore) : booking.bufferMinutesBefore;
        const nextBufferAfter = bufferMinutesAfter !== undefined ? Number(bufferMinutesAfter) : booking.bufferMinutesAfter;
        const nextResources = resources !== undefined ? resources : booking.resources;
        const nextStatus = status || booking.status;

        if (nextStartTime >= nextEndTime) {
            return error(res, "Thời gian bắt đầu phải trước thời gian kết thúc", 400);
        }

        // Check conflict if target status is CONFIRMED
        if (nextStatus === 'CONFIRMED') {
            const resourceIds = nextResources.map(r => r.resourceId).filter(Boolean);
            const conflicts = await findConflicts({
                startTime: nextStartTime,
                endTime: nextEndTime,
                resourceIds,
                excludeBookingId: booking._id,
                bufferBefore: nextBufferBefore,
                bufferAfter: nextBufferAfter
            });

            if (conflicts.length > 0) {
                const isOverridden = conflictOverride?.isOverridden === true && conflictOverride?.reason;
                if (!isOverridden) {
                    return res.status(409).json({
                        success: false,
                        message: "Xung đột lịch: Nhân sự hoặc tài nguyên đã có lịch xác nhận khác trong khoảng thời gian này.",
                        error: {
                            code: "SCHEDULING_CONFLICT",
                            conflicts
                        }
                    });
                }
            }
        }

        if (title !== undefined) booking.title = title;
        booking.startTime = nextStartTime;
        booking.endTime = nextEndTime;
        booking.bufferMinutesBefore = nextBufferBefore;
        booking.bufferMinutesAfter = nextBufferAfter;
        if (resources !== undefined) booking.resources = nextResources;
        if (diaDiem !== undefined) booking.diaDiem = diaDiem;
        if (ghiChu !== undefined) booking.ghiChu = ghiChu;
        booking.status = nextStatus;

        if (conflictOverride) {
            booking.conflictOverride = {
                isOverridden: conflictOverride.isOverridden || false,
                reason: conflictOverride.reason || "",
                approvedBy: conflictOverride.approvedBy || req.user?.fullname || "",
                approvedAt: conflictOverride.isOverridden ? new Date() : undefined
            };
        }

        booking.version = (booking.version || 1) + 1;
        booking.auditLog.push({
            action: `Cập nhật booking (v${booking.version})`,
            performedBy: req.user?.fullname || req.user?.username || "Nhân viên",
            timestamp: new Date(),
            details: { status: nextStatus, startTime: nextStartTime, endTime: nextEndTime }
        });

        await booking.save();
        return success(res, "Cập nhật booking thành công", booking);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/bookings/:id/confirm
 * Atomically confirms a tentative booking after validating no resource conflicts exist.
 */
async function confirmBooking(req, res) {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return error(res, "Không tìm thấy booking", 404);

        // Idempotent: already confirmed
        if (booking.status === 'CONFIRMED') {
            return success(res, "Booking đã được xác nhận trước đó (Idempotent)", booking);
        }

        if (booking.status === 'CANCELLED') {
            return error(res, "Không thể xác nhận booking đã bị hủy", 400);
        }

        const resourceIds = booking.resources.map(r => r.resourceId).filter(Boolean);
        const { conflictOverride } = req.body || {};

        // Perform strict conflict check
        const conflicts = await findConflicts({
            startTime: booking.startTime,
            endTime: booking.endTime,
            resourceIds,
            excludeBookingId: booking._id,
            bufferBefore: booking.bufferMinutesBefore || 0,
            bufferAfter: booking.bufferMinutesAfter || 0
        });

        if (conflicts.length > 0) {
            const isOverridden = conflictOverride?.isOverridden === true && conflictOverride?.reason;
            if (!isOverridden) {
                return res.status(409).json({
                    success: false,
                    message: "Không thể xác nhận: Lịch của nhân sự hoặc tài nguyên đã bị trùng với lịch khác.",
                    error: {
                        code: "SCHEDULING_CONFLICT",
                        conflicts
                    }
                });
            }
            booking.conflictOverride = {
                isOverridden: true,
                reason: conflictOverride.reason,
                approvedBy: req.user?.fullname || req.user?.username || "Manager Override",
                approvedAt: new Date()
            };
        }

        booking.status = 'CONFIRMED';
        booking.confirmedAt = new Date();
        booking.confirmedBy = req.user?.fullname || req.user?.username || "Hệ thống";
        booking.version = (booking.version || 1) + 1;
        booking.auditLog.push({
            action: "Xác nhận booking (CONFIRMED)",
            performedBy: req.user?.fullname || req.user?.username || "Nhân viên",
            timestamp: new Date(),
            details: { confirmedAt: booking.confirmedAt, version: booking.version }
        });

        await booking.save();

        createLog({
            action: `Xác nhận lịch booking ${booking.maBooking}`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: { maBooking: booking.maBooking, status: 'CONFIRMED' }
        });

        return success(res, "Xác nhận booking thành công", booking);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/bookings/:id/cancel
 * Cancels a booking and frees allocated resources immediately.
 */
async function cancelBooking(req, res) {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return error(res, "Không tìm thấy booking", 404);

        const { reason = "" } = req.body || {};

        booking.status = 'CANCELLED';
        booking.version = (booking.version || 1) + 1;
        booking.auditLog.push({
            action: "Hủy booking (CANCELLED)",
            performedBy: req.user?.fullname || req.user?.username || "Nhân viên",
            timestamp: new Date(),
            details: { reason, version: booking.version }
        });

        await booking.save();

        createLog({
            action: `Hủy booking ${booking.maBooking}`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: { maBooking: booking.maBooking, reason }
        });

        return success(res, "Hủy booking thành công", booking);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * Helper: Check conflicts for contract schedule updates
 * POST /api/v2/bookings/check-contract-conflicts
 */
async function checkContractConflicts(req, res) {
    try {
        const { schedules = [], excludeContractId } = req.body;
        const allConflicts = [];

        for (const item of schedules) {
            if (!item.ngayGio || !item.nhanVien) continue;
            const startTime = new Date(item.ngayGio);
            // Default shoot length: 3 hours if not specified
            const durationHours = item.durationHours || 3;
            const endTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);

            const conflicts = await findConflicts({
                startTime,
                endTime,
                resourceIds: [item.nhanVien]
            });

            // Filter out current contract if supplied
            const realConflicts = excludeContractId
                ? conflicts.filter(c => String(c.maHopDong) !== String(excludeContractId))
                : conflicts;

            if (realConflicts.length > 0) {
                allConflicts.push({
                    scheduleId: item.id || item._id,
                    serviceName: item.serviceName || item.tenDichVu || "Lịch dịch vụ",
                    nhanVien: item.nhanVien,
                    startTime,
                    endTime,
                    conflicts: realConflicts
                });
            }
        }

        return success(res, "Kiểm tra xung đột lịch hoàn tất", {
            hasConflict: allConflicts.length > 0,
            conflicts: allConflicts
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * Adapter: Synchronizes schedules from a contract into Booking collection idempotently
 */
async function syncContractToBookings(hopDong, performedBy = "System Sync") {
    if (!hopDong) return { synced: 0, conflicts: [] };

    let schedules = [];

    // 1. serviceSchedules
    if (Array.isArray(hopDong.serviceSchedules) && hopDong.serviceSchedules.length > 0) {
        schedules = hopDong.serviceSchedules.map((s, idx) => ({
            scheduleId: s.id || `sch-${idx}-${s.serviceType}`,
            serviceType: s.serviceType === 'makeup' ? 'MAKEUP' : 'PHOTO',
            title: `${hopDong.maHopDong} - ${s.serviceName || (s.serviceType === 'makeup' ? 'Trang điểm' : 'Chụp hình')}`,
            ngayGio: s.ngayGio,
            nhanVien: s.nhanVien,
            diaDiem: s.diaDiem || "Tại Studio",
            ghiChu: s.ghiChu || ""
        }));
    } else {
        // Fallback to lichChup & lichTrangDiem
        if (Array.isArray(hopDong.lichChup)) {
            hopDong.lichChup.forEach((lc, idx) => {
                schedules.push({
                    scheduleId: lc.id || `lc-${idx}`,
                    serviceType: 'PHOTO',
                    title: `${hopDong.maHopDong} - Chụp hình lượt ${idx + 1}`,
                    ngayGio: lc.ngayGio || lc.ngayChup,
                    nhanVien: lc.nhanVien || lc.thoChupHinh || hopDong.nguoiPhucVu?.thoChupHinh || "",
                    diaDiem: lc.diaDiem || hopDong.cacNgay?.diaDiemChup || "Tại Studio",
                    ghiChu: lc.ghiChu || ""
                });
            });
        }
        if (Array.isArray(hopDong.lichTrangDiem)) {
            hopDong.lichTrangDiem.forEach((mk, idx) => {
                schedules.push({
                    scheduleId: mk.id || `mk-${idx}`,
                    serviceType: 'MAKEUP',
                    title: `${hopDong.maHopDong} - Trang điểm lượt ${idx + 1}`,
                    ngayGio: mk.ngayTrangDiem || mk.ngay,
                    nhanVien: mk.thoMakeUp || hopDong.nguoiPhucVu?.thoMakeUp || "",
                    diaDiem: mk.diaDiem || "Tại Studio",
                    ghiChu: mk.ghiChu || ""
                });
            });
        }
        // Single dates in cacNgay fallback
        if (schedules.length === 0 && hopDong.cacNgay?.ngayChup) {
            schedules.push({
                scheduleId: `cacNgay-chup-${hopDong._id}`,
                serviceType: 'PHOTO',
                title: `${hopDong.maHopDong} - Lịch chụp ảnh`,
                ngayGio: hopDong.cacNgay.ngayChup,
                nhanVien: hopDong.nguoiPhucVu?.thoChupHinh || "",
                diaDiem: hopDong.cacNgay.diaDiemChup || "Tại Studio",
                ghiChu: ""
            });
        }
    }

    let syncedCount = 0;
    const conflictReports = [];

    for (const item of schedules) {
        if (!item.ngayGio) continue;
        const startTime = new Date(item.ngayGio);
        if (isNaN(startTime.getTime())) continue;

        // Default 3 hours for photo, 2 hours for makeup
        const durationHours = item.serviceType === 'MAKEUP' ? 2 : 3;
        const endTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);

        const resources = [];
        if (item.nhanVien) {
            resources.push({
                resourceId: item.nhanVien,
                resourceType: item.serviceType === 'MAKEUP' ? 'STAFF_MAKEUP' : 'STAFF_PHOTO',
                resourceName: item.nhanVien,
                role: item.serviceType === 'MAKEUP' ? 'Thợ makeup' : 'Thợ chụp chính'
            });
        }

        // Upsert by legacyRef
        const legacyScheduleId = `${hopDong._id}_${item.scheduleId}`;
        let booking = await Booking.findOne({ "legacyRef.scheduleId": legacyScheduleId });

        if (booking) {
            booking.startTime = startTime;
            booking.endTime = endTime;
            booking.resources = resources;
            booking.diaDiem = item.diaDiem;
            booking.ghiChu = item.ghiChu;
            await booking.save();
            syncedCount++;
        } else {
            const maBooking = `BK-HD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
            booking = new Booking({
                maBooking,
                hopDongId: hopDong._id,
                maHopDong: hopDong.maHopDong,
                title: item.title,
                bookingType: item.serviceType,
                startTime,
                endTime,
                status: 'CONFIRMED',
                resources,
                diaDiem: item.diaDiem,
                ghiChu: item.ghiChu,
                legacyRef: {
                    source: 'HopDong',
                    contractId: String(hopDong._id),
                    scheduleId: legacyScheduleId
                },
                confirmedAt: new Date(),
                confirmedBy: performedBy
            });
            await booking.save();
            syncedCount++;
        }
    }

    return { synced: syncedCount, conflicts: conflictReports };
}

module.exports = {
    intervalsOverlap,
    getEffectiveWindow,
    findConflicts,
    getAvailability,
    listBookings,
    getBookingById,
    createBooking,
    updateBooking,
    confirmBooking,
    cancelBooking,
    checkContractConflicts,
    syncContractToBookings
};
