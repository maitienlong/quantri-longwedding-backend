const WardrobeReservation = require("../models/wardrobeReservation.model");
const TrangPhuc = require("../models/trangPhuc.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

/**
 * Checks whether two time intervals taking cleaning buffer hours into account overlap.
 * Interval 1: [start1, end1 + buffer1Hours)
 * Interval 2: [start2, end2 + buffer2Hours)
 * Overlap occurs if and only if: start1 < (end2 + buffer2) && start2 < (end1 + buffer1)
 */
function intervalsOverlapWithBuffer(start1, end1, buffer1Hours, start2, end2, buffer2Hours) {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime() + (Number(buffer1Hours || 0) * 3600 * 1000);
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime() + (Number(buffer2Hours || 0) * 3600 * 1000);

    return s1 < e2 && s2 < e1;
}

/**
 * Core conflict detection algorithm for wardrobe reservations.
 * Scans both active WardrobeReservation documents and HopDong.trangPhucGiu holds.
 * Automatically ignores cancelled contracts/reservations.
 */
async function findWardrobeConflicts({
    maTrangPhuc,
    startDate,
    endDate,
    cleaningBufferHours = 24,
    excludeReservationId = null,
    excludeContractId = null
}) {
    if (!maTrangPhuc || !startDate || !endDate) return [];

    const normCode = maTrangPhuc.toUpperCase().trim();
    const reqStart = new Date(startDate);
    const reqEnd = new Date(endDate);
    const conflicts = [];

    // 1. Check WardrobeReservation collection
    const reservationQuery = {
        maTrangPhuc: normCode,
        status: { $in: ['RESERVED', 'IN_USE'] }
    };
    if (excludeReservationId) {
        reservationQuery._id = { $ne: excludeReservationId };
    }
    if (excludeContractId) {
        reservationQuery.maHopDong = { $ne: excludeContractId };
    }

    const activeReservations = await WardrobeReservation.find(reservationQuery);

    for (const r of activeReservations) {
        if (intervalsOverlapWithBuffer(
            reqStart,
            reqEnd,
            cleaningBufferHours,
            r.startDate,
            r.endDate,
            r.cleaningBufferHours || 24
        )) {
            conflicts.push({
                source: "WardrobeReservation",
                reservationId: r._id,
                maPhieu: r.maPhieu,
                maHopDong: r.maHopDong,
                tenKhachHang: r.tenKhachHang,
                soDienThoai: r.soDienThoai,
                maTrangPhuc: r.maTrangPhuc,
                startDate: r.startDate,
                endDate: r.endDate,
                cleaningBufferHours: r.cleaningBufferHours || 24,
                status: r.status,
                conflictReason: "Đã có khách đặt giữ trùng ngày hoặc trong thời gian giặt hấp"
            });
        }
    }

    // 2. Check legacy HopDong.trangPhucGiu (excluding cancelled contracts)
    const contractQuery = {
        "trangPhucGiu.maTrangPhuc": normCode,
        "trangPhucGiu.trangThai": { $in: ['GIU_CHO', 'DANG_MUON'] },
        // Do not block if contract is cancelled
        subGiaiDoan: { $ne: 'huy' }
    };
    if (excludeContractId) {
        contractQuery.maHopDong = { $ne: excludeContractId };
    }

    const activeContracts = await HopDong.find(contractQuery).populate('khachHang1', 'tenKhachHang soDienThoai');

    for (const hd of activeContracts) {
        for (const item of (hd.trangPhucGiu || [])) {
            if (item.maTrangPhuc === normCode && ['GIU_CHO', 'DANG_MUON'].includes(item.trangThai)) {
                if (!item.ngayHenLay || !item.ngayHenTra) continue;

                if (intervalsOverlapWithBuffer(
                    reqStart,
                    reqEnd,
                    cleaningBufferHours,
                    new Date(item.ngayHenLay),
                    new Date(item.ngayHenTra),
                    24 // default legacy 24h buffer
                )) {
                    // Check if already captured in reservations (avoid duplicate report)
                    const alreadyReported = conflicts.some(c => c.maHopDong === hd.maHopDong);
                    if (!alreadyReported) {
                        conflicts.push({
                            source: "HopDong",
                            maHopDong: hd.maHopDong,
                            tenKhachHang: hd.khachHang1?.tenKhachHang || "Khách hàng",
                            soDienThoai: hd.khachHang1?.soDienThoai || "",
                            maTrangPhuc: item.maTrangPhuc,
                            startDate: item.ngayHenLay,
                            endDate: item.ngayHenTra,
                            cleaningBufferHours: 24,
                            status: item.trangThai,
                            conflictReason: "Hợp đồng đã giữ váy trong thời gian này"
                        });
                    }
                }
            }
        }
    }

    return conflicts;
}

/**
 * GET /api/v2/wardrobe/conflicts
 */
async function getConflictsEndpoint(req, res) {
    try {
        const { maTrangPhuc, startDate, endDate, cleaningBufferHours = 24, excludeReservationId, excludeContractId } = req.query;

        if (!maTrangPhuc || !startDate || !endDate) {
            return error(res, "Thiếu tham số maTrangPhuc, startDate hoặc endDate", 400);
        }

        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate >= eDate) {
            return error(res, "Thời gian bắt đầu và kết thúc không hợp lệ", 400);
        }

        const conflicts = await findWardrobeConflicts({
            maTrangPhuc,
            startDate: sDate,
            endDate: eDate,
            cleaningBufferHours: Number(cleaningBufferHours) || 24,
            excludeReservationId,
            excludeContractId
        });

        return success(res, "Kiểm tra xung đột trang phục hoàn tất", {
            isConflict: conflicts.length > 0,
            conflicts
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/wardrobe/reservations
 * Create a new wardrobe reservation with strict conflict check
 */
async function createReservation(req, res) {
    try {
        const {
            itemId,
            maTrangPhuc,
            tenTrangPhuc,
            hopDongId,
            maHopDong,
            khachHangId,
            tenKhachHang,
            soDienThoai,
            startDate,
            endDate,
            cleaningBufferHours = 24,
            ghiChu = "",
            conflictOverride
        } = req.body;

        const code = (maTrangPhuc || "").toUpperCase().trim();
        if (!code) return error(res, "Thiếu mã trang phục", 400);
        if (!startDate || !endDate) return error(res, "Thiếu ngày hẹn lấy hoặc ngày hẹn trả", 400);

        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate >= eDate) {
            return error(res, "Khoảng thời gian mượn đồ không hợp lệ", 400);
        }

        // Find garment details
        let garment = null;
        if (itemId) {
            garment = await TrangPhuc.findById(itemId);
        } else {
            garment = await TrangPhuc.findOne({ maTrangPhuc: code });
        }

        // Check if garment is retired
        if (garment && garment.tinhTrang === 'NGUNG_SU_DUNG') {
            return error(res, "Trang phục này đã ngừng sử dụng / thanh lý", 400);
        }

        // Server-side conflict check
        const conflicts = await findWardrobeConflicts({
            maTrangPhuc: code,
            startDate: sDate,
            endDate: eDate,
            cleaningBufferHours: Number(cleaningBufferHours) || 24,
            excludeContractId: maHopDong
        });

        if (conflicts.length > 0) {
            const isOverridden = conflictOverride?.isOverridden === true && conflictOverride?.reason;
            if (!isOverridden) {
                return res.status(409).json({
                    success: false,
                    message: "Xung đột lịch giữ đồ: Trang phục đã có khách khác đặt hoặc đang trong thời gian giặt hấp.",
                    error: {
                        code: "WARDROBE_CONFLICT",
                        conflicts
                    }
                });
            }
        }

        const maPhieu = `WR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const reservation = new WardrobeReservation({
            maPhieu,
            hopDongId,
            maHopDong: maHopDong || "",
            khachHangId,
            tenKhachHang: tenKhachHang || "",
            soDienThoai: soDienThoai || "",
            trangPhucId: garment?._id,
            maTrangPhuc: code,
            tenTrangPhuc: tenTrangPhuc || garment?.tenTrangPhuc || code,
            startDate: sDate,
            endDate: eDate,
            cleaningBufferHours: Number(cleaningBufferHours) || 24,
            status: 'RESERVED',
            ghiChu,
            conflictOverride: {
                isOverridden: conflictOverride?.isOverridden || false,
                reason: conflictOverride?.reason || "",
                approvedBy: conflictOverride?.isOverridden ? (req.user?.fullname || "Quản lý") : "",
                approvedAt: conflictOverride?.isOverridden ? new Date() : undefined
            },
            auditLog: [
                {
                    action: "Đặt giữ trang phục (RESERVED)",
                    performedBy: req.user?.fullname || req.user?.username || "Nhân viên",
                    timestamp: new Date(),
                    details: { maPhieu, maTrangPhuc: code, startDate: sDate, endDate: eDate }
                }
            ]
        });

        await reservation.save();

        // Update garment status if currently SAN_SANG
        if (garment && garment.tinhTrang === 'SAN_SANG') {
            garment.tinhTrang = 'DANG_GIU';
            await garment.save();
        }

        createLog({
            action: `Đặt giữ trang phục ${code} (${maPhieu})`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: { maPhieu, maTrangPhuc: code, startDate: sDate, endDate: eDate }
        });

        return success(res, "Đặt giữ trang phục thành công", reservation, 201);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/wardrobe/reservations/:id/check-out
 * Bàn giao trang phục cho khách (Check-out)
 */
async function checkOut(req, res) {
    try {
        const reservation = await WardrobeReservation.findById(req.params.id);
        if (!reservation) return error(res, "Không tìm thấy phiếu giữ đồ", 404);

        if (reservation.status === 'CANCELLED') {
            return error(res, "Không thể bàn giao phiếu giữ đồ đã bị hủy", 400);
        }
        if (reservation.status === 'IN_USE') {
            return success(res, "Trang phục đã được bàn giao trước đó (Idempotent)", reservation);
        }
        if (reservation.status === 'RETURNED') {
            return error(res, "Trang phục này đã được khách trả hoàn tất", 400);
        }

        const { conditionNotes = "", photos = [] } = req.body;
        const performedBy = req.user?.fullname || req.user?.username || "Nhân viên bàn giao";

        reservation.status = 'IN_USE';
        reservation.checkOut = {
            actualDate: new Date(),
            performedBy,
            conditionNotes,
            photos
        };
        reservation.auditLog.push({
            action: "Bàn giao trang phục (CHECK_OUT)",
            performedBy,
            timestamp: new Date(),
            details: { conditionNotes, photosCount: photos.length }
        });

        await reservation.save();

        // Update TrangPhuc model
        if (reservation.trangPhucId) {
            await TrangPhuc.findByIdAndUpdate(reservation.trangPhucId, {
                tinhTrang: 'DANG_CHO_THUE'
            });
        } else {
            await TrangPhuc.updateOne(
                { maTrangPhuc: reservation.maTrangPhuc },
                { tinhTrang: 'DANG_CHO_THUE' }
            );
        }

        createLog({
            action: `Bàn giao váy/vest ${reservation.maTrangPhuc} (${reservation.maPhieu})`,
            user: performedBy,
            req,
            details: { maPhieu: reservation.maPhieu, maTrangPhuc: reservation.maTrangPhuc }
        });

        return success(res, "Bàn giao trang phục thành công", reservation);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/wardrobe/reservations/:id/check-in
 * Nhận lại trang phục từ khách (Check-in)
 */
async function checkIn(req, res) {
    try {
        const reservation = await WardrobeReservation.findById(req.params.id);
        if (!reservation) return error(res, "Không tìm thấy phiếu mượn đồ", 404);

        if (reservation.status === 'RETURNED') {
            return success(res, "Trang phục đã được nhận trả trước đó (Idempotent)", reservation);
        }
        if (reservation.status !== 'IN_USE') {
            return error(res, "Chỉ có thể nhận trả trang phục đang ở trạng thái Đang mượn (IN_USE)", 400);
        }

        const { conditionNotes = "", damageFee = 0, photos = [], sendToLaundry = true } = req.body;
        const receivedBy = req.user?.fullname || req.user?.username || "Nhân viên nhận đồ";

        reservation.status = 'RETURNED';
        reservation.checkIn = {
            actualDate: new Date(),
            receivedBy,
            conditionNotes,
            damageFee: Number(damageFee) || 0,
            photos
        };
        reservation.auditLog.push({
            action: "Nhận trả trang phục (CHECK_IN)",
            performedBy: receivedBy,
            timestamp: new Date(),
            details: { conditionNotes, damageFee: Number(damageFee) || 0, photosCount: photos.length }
        });

        await reservation.save();

        // Update TrangPhuc: increment usage and set laundry status
        const nextStatus = sendToLaundry ? 'DANG_GIAT_HAP' : 'SAN_SANG';
        const updateDoc = {
            $inc: { soLanSuDung: 1 },
            $set: { tinhTrang: nextStatus }
        };

        if (reservation.trangPhucId) {
            await TrangPhuc.findByIdAndUpdate(reservation.trangPhucId, updateDoc);
        } else {
            await TrangPhuc.updateOne({ maTrangPhuc: reservation.maTrangPhuc }, updateDoc);
        }

        createLog({
            action: `Nhận trả váy/vest ${reservation.maTrangPhuc} (${reservation.maPhieu})`,
            user: receivedBy,
            req,
            details: { maPhieu: reservation.maPhieu, damageFee: Number(damageFee) || 0, nextStatus }
        });

        return success(res, "Nhận trả trang phục thành công", reservation);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/wardrobe/reservations/:id/cancel
 * Hủy phiếu giữ đồ & giải phóng trang phục
 */
async function cancelReservation(req, res) {
    try {
        const reservation = await WardrobeReservation.findById(req.params.id);
        if (!reservation) return error(res, "Không tìm thấy phiếu giữ đồ", 404);

        if (reservation.status === 'CANCELLED') {
            return success(res, "Phiếu đã được hủy trước đó", reservation);
        }

        const { reason = "" } = req.body;
        const performedBy = req.user?.fullname || req.user?.username || "Nhân viên";

        reservation.status = 'CANCELLED';
        reservation.auditLog.push({
            action: "Hủy phiếu giữ đồ (CANCELLED)",
            performedBy,
            timestamp: new Date(),
            details: { reason }
        });
        await reservation.save();

        // Check if there are other active reservations for this garment
        const remainingActive = await WardrobeReservation.countDocuments({
            maTrangPhuc: reservation.maTrangPhuc,
            status: { $in: ['RESERVED', 'IN_USE'] }
        });

        if (remainingActive === 0) {
            await TrangPhuc.updateOne(
                { maTrangPhuc: reservation.maTrangPhuc, tinhTrang: { $in: ['DANG_GIU', 'DANG_CHO_THUE'] } },
                { $set: { tinhTrang: 'SAN_SANG' } }
            );
        }

        createLog({
            action: `Hủy phiếu giữ đồ ${reservation.maPhieu}`,
            user: performedBy,
            req,
            details: { maPhieu: reservation.maPhieu, reason }
        });

        return success(res, "Hủy phiếu giữ đồ thành công", reservation);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * POST /api/v2/wardrobe/:itemId/maintenance
 * Ghi nhận lịch giặt sấy / sửa chữa trang phục
 */
async function recordMaintenance(req, res) {
    try {
        const itemId = req.params.itemId;
        const garment = await TrangPhuc.findById(itemId);
        if (!garment) return error(res, "Không tìm thấy trang phục", 404);

        const { action = 'GIAT_HAP', startDate, endDate, cost = 0, notes = "", photos = [], complete = false } = req.body;
        const performedBy = req.user?.fullname || req.user?.username || "Nhân viên kho";

        if (!garment.maintenanceHistory) garment.maintenanceHistory = [];

        garment.maintenanceHistory.push({
            action,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : (complete ? new Date() : undefined),
            cost: Number(cost) || 0,
            performedBy,
            notes,
            photos,
            createdAt: new Date()
        });

        if (complete) {
            garment.tinhTrang = 'SAN_SANG';
        } else if (action === 'GIAT_HAP') {
            garment.tinhTrang = 'DANG_GIAT_HAP';
        } else if (action === 'SUA_CHUA') {
            garment.tinhTrang = 'DANG_SUA_CHUA';
        }

        await garment.save();

        createLog({
            action: `Ghi nhận bảo trì/giặt hấp cho ${garment.maTrangPhuc}`,
            user: performedBy,
            req,
            details: { maTrangPhuc: garment.maTrangPhuc, action, complete }
        });

        return success(res, complete ? "Hoàn tất bảo trì trang phục" : "Ghi nhận gửi bảo trì/giặt hấp thành công", garment);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * GET /api/v2/wardrobe/reservations
 * List reservations with filter
 */
async function listReservations(req, res) {
    try {
        const { maTrangPhuc, maHopDong, status, startDate, endDate, limit = 100, page = 1 } = req.query;
        const query = {};

        if (maTrangPhuc) {
            query.maTrangPhuc = maTrangPhuc.toUpperCase().trim();
        }
        if (maHopDong) {
            query.maHopDong = new RegExp(maHopDong.trim(), "i");
        }
        if (status && status !== 'all') {
            query.status = status;
        }
        if (startDate || endDate) {
            query.startDate = {};
            if (startDate) query.startDate.$gte = new Date(startDate);
            if (endDate) query.startDate.$lte = new Date(endDate);
        }

        const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        const [reservations, total] = await Promise.all([
            WardrobeReservation.find(query)
                .sort({ startDate: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            WardrobeReservation.countDocuments(query)
        ]);

        return success(res, "Lấy danh sách phiếu giữ đồ thành công", {
            reservations,
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

module.exports = {
    intervalsOverlapWithBuffer,
    findWardrobeConflicts,
    getConflictsEndpoint,
    createReservation,
    checkOut,
    checkIn,
    cancelReservation,
    recordMaintenance,
    listReservations
};

