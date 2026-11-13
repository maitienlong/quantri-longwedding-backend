const HopDong = require("../models/hopDong.model");
const KhachHang = require("../models/khachHang.model");
const DichVu = require("../models/dichVu.model");
const Payment = require("../models/payment.model");
const Album = require("../models/album.model");
const PrintDeliverable = require("../models/printDeliverable.model");
const Booking = require("../models/booking.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");
const { getICTDateTimeString, formatICTDateTime } = require("../utils/dateUtils");
const { validateTransition, normalizeSubStage, STAGE_NAMES, SUB_STAGE_NAMES } = require("./contractStateMachine");
const { calculateContractPricing } = require("./contractPricing");
const bookingService = require("./booking.service");

// Đảm bảo thông tin thanh toán có đầy đủ phanTramDaThanhToan và trangThaiThanhToan chuẩn xác
function ensurePaymentProgress(contract) {
    if (!contract) return contract;
    const doc = typeof contract.toObject === 'function' ? contract.toObject() : contract;
    if (!doc.thanhToan) doc.thanhToan = {};

    const calc = calculateContractPricing(doc);
    if (calc) {
        doc.thanhToan.tongGiaTri = calc.tongGiaTri;
        doc.thanhToan.tongPhatSinh = calc.tongPhatSinh;
        doc.thanhToan.tongGiaTriSauGiam = calc.tongGiaTriSauGiam;
        doc.thanhToan.khachHangDaThanhToan = calc.khachHangDaThanhToan;
        doc.thanhToan.conLai = calc.conLai;
        doc.thanhToan.phanTramDaThanhToan = calc.phanTramDaThanhToan;
        doc.thanhToan.trangThaiThanhToan = calc.trangThaiThanhToan;
    }

    return doc;
}

/**
 * Tự động hoàn thành toàn bộ các tiến trình, lịch hẹn và thành phẩm liên quan khi hợp đồng hoàn thành (Giai đoạn 4)
 */
async function completeContractProgressAndSchedules(hopDong, performedBy = "Hệ thống") {
    if (!hopDong) return;

    // 1. Chốt trạng thái tiến trình và các mốc
    hopDong.giaiDoan = 4;
    hopDong.subGiaiDoan = 'hoan_thanh';
    if (!hopDong.cacNgay) hopDong.cacNgay = {};
    hopDong.cacNgay.chotLich = 'Đã hoàn thành';

    if (!hopDong.khachHangXacNhanAnh) hopDong.khachHangXacNhanAnh = {};
    hopDong.khachHangXacNhanAnh.daXacNhan = true;
    if (!hopDong.khachHangXacNhanAnh.thoiGianXacNhan) {
        hopDong.khachHangXacNhanAnh.thoiGianXacNhan = new Date();
    }

    // 2. Hoàn thành tất cả các lịch trong serviceSchedules
    if (Array.isArray(hopDong.serviceSchedules)) {
        hopDong.serviceSchedules.forEach(item => {
            if (item) {
                item.trangThai = 'Hoàn thành';
                item.isCompleted = true;
            }
        });
    }

    // 3. Hoàn thành các lịch chụp, lịch quay phim, lịch trang điểm
    if (Array.isArray(hopDong.lichChup)) {
        hopDong.lichChup.forEach(item => {
            if (item) {
                item.trangThai = 'Hoàn thành';
                item.isCompleted = true;
            }
        });
    }
    if (Array.isArray(hopDong.lichQuayPhim)) {
        hopDong.lichQuayPhim.forEach(item => {
            if (item) {
                item.trangThai = 'Hoàn thành';
                item.isCompleted = true;
            }
        });
    }
    if (Array.isArray(hopDong.lichTrangDiem)) {
        hopDong.lichTrangDiem.forEach(item => {
            if (item) {
                item.trangThai = 'Hoàn thành';
                item.isCompleted = true;
            }
        });
    }

    // 4. Cập nhật trang phục giữ (nếu đang giữ chỗ hoặc đang mượn thì chuyển sang đã trả)
    if (Array.isArray(hopDong.trangPhucGiu)) {
        hopDong.trangPhucGiu.forEach(tp => {
            if (tp && ['GIU_CHO', 'DANG_MUON'].includes(tp.trangThai)) {
                tp.trangThai = 'DA_TRA';
                if (!tp.ngayTraThucTe) tp.ngayTraThucTe = new Date();
            }
        });
    }

    // 5. Cập nhật soạn đồ (nếu có)
    if (hopDong.soanDo && hopDong.soanDo.trangThai && hopDong.soanDo.trangThai !== 'Đã trả') {
        hopDong.soanDo.trangThai = 'Đã trả';
    }

    // 6. Cập nhật Album khách hàng
    try {
        await Album.updateMany(
            { maHopDong: hopDong.maHopDong },
            {
                $set: {
                    trangThai: 'Hoàn thành',
                    trangThaiChinhSua: 'Hoàn thành',
                    khachHangXacNhan: true,
                    currentVersionApproved: true,
                    ngayKhachXacNhan: new Date()
                }
            }
        );
    } catch (albumErr) {
        console.warn("[completeContract Album sync warning]:", albumErr.message);
    }

    // 7. Cập nhật PrintDeliverable (In ấn & Bàn giao)
    try {
        await PrintDeliverable.updateMany(
            {
                $or: [{ hopDongId: hopDong._id }, { maHopDong: hopDong.maHopDong }],
                trangThai: { $nin: ['DA_BAN_GIAO', 'DA_HUY'] }
            },
            {
                $set: {
                    trangThai: 'DA_BAN_GIAO',
                    banGiao: {
                        ngayBanGiao: new Date(),
                        nguoiNhan: hopDong.khachHang1?.tenKhachHang || 'Khách hàng',
                        ghiChuBanGiao: 'Tự động bàn giao khi hoàn thành hợp đồng'
                    }
                }
            }
        );
    } catch (printErr) {
        console.warn("[completeContract PrintDeliverable sync warning]:", printErr.message);
    }

    // 8. Cập nhật Booking collection
    try {
        await Booking.updateMany(
            {
                $or: [{ hopDongId: hopDong._id }, { maHopDong: hopDong.maHopDong }],
                status: { $ne: 'CANCELLED' }
            },
            {
                $set: {
                    status: 'COMPLETED',
                    confirmedBy: performedBy
                }
            }
        );
    } catch (bookingErr) {
        console.warn("[completeContract Booking sync warning]:", bookingErr.message);
    }
}

async function create(req, res) {
    try {
        const hasAssignCrewPerm = req.user && (
            req.user.username === 'along' ||
            req.user.positon === 'Quản lý' ||
            req.user.positon === 'Admin' ||
            (Array.isArray(req.user.permissions)
                ? (req.user.permissions.includes('*') || req.user.permissions.includes('all') || req.user.permissions.includes('phan-cong-tho'))
                : (req.user.permission === 1)
            )
        );

        if (!hasAssignCrewPerm) {
            if (req.body.nguoiPhucVu) {
                req.body.nguoiPhucVu.thoChupHinh = "";
                req.body.nguoiPhucVu.thoMakeUp = "";
                req.body.nguoiPhucVu.thoChinhAnh = "";
                req.body.nguoiPhucVu.thoQuayPhim = "";
            }
            if (Array.isArray(req.body.serviceSchedules)) {
                req.body.serviceSchedules.forEach(s => { s.nhanVien = ""; });
            }
            if (Array.isArray(req.body.lichChup)) {
                req.body.lichChup.forEach(s => { s.thoChupHinh = ""; s.nhanVien = ""; });
            }
            if (Array.isArray(req.body.lichTrangDiem)) {
                req.body.lichTrangDiem.forEach(s => { s.thoMakeUp = ""; s.nhanVien = ""; });
            }
            if (Array.isArray(req.body.lichQuayPhim)) {
                req.body.lichQuayPhim.forEach(s => { s.thoQuayPhim = ""; s.nhanVien = ""; });
            }
        }
        // Kiểm tra trùng lịch chụp hình (khoảng cách dưới 3 tiếng)
        if (req.body.cacNgay?.ngayChup) {
            const ngayChupTime = new Date(req.body.cacNgay.ngayChup).getTime();
            if (!isNaN(ngayChupTime)) {
                const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
                const minTime = new Date(ngayChupTime - THREE_HOURS_MS);
                const maxTime = new Date(ngayChupTime + THREE_HOURS_MS);

                const conflictingContract = await HopDong.findOne({
                    giaiDoan: 1,
                    "cacNgay.ngayChup": {
                        $gte: minTime,
                        $lte: maxTime
                    }
                }).populate("khachHang1", "tenKhachHang");

                if (conflictingContract) {
                    const timeStr = formatICTDateTime(conflictingContract.cacNgay.ngayChup);
                    const khachHangName = conflictingContract.khachHang1?.tenKhachHang || "Khách hàng";
                    return error(res, `Không thể lưu hợp đồng! Lịch chụp hình bị trùng hoặc quá gần (dưới 3 tiếng) với HĐ ${conflictingContract.maHopDong} (${khachHangName}) vào lúc ${timeStr}.`);
                }
            }
        }

        const hopDong = new HopDong({
            maHopDong: req.body.maHopDong,
            ngayHopDong: getICTDateTimeString(),
            khachHang1: req.body.khachHang1,
            khachHang2: req.body.khachHang2 || undefined,
            gioHang: req.body.gioHang,
            thanhToan: req.body.thanhToan || {},
            cacNgay: req.body.cacNgay,
            nguoiPhucVu: req.body.nguoiPhucVu,
            giaiDoan: req.body.giaiDoan || 1,
            subGiaiDoan: req.body.subGiaiDoan || 'dang_thuc_hien',
            lichSuGiaiDoan: [{
                giaiDoan: req.body.giaiDoan || 1,
                subGiaiDoan: req.body.subGiaiDoan || 'dang_thuc_hien',
                thoiGian: new Date(),
                nguoiThucHien: req.user?.tenNhanVien || req.user?.name || req.user?.username || 'Nhân viên',
                vaiTro: req.user?.chucVu || req.user?.positon || req.user?.role || 'Admin',
                ghiChu: 'Khởi tạo hợp đồng mới'
            }],
            dichVuChinh: req.body.dichVuChinh,
            isSpecialCollection: req.body.isSpecialCollection || false,
            linkAnhGoc: req.body.linkAnhGoc || "",
            linkAnhChinhSua: req.body.linkAnhChinhSua || "",
            extraDriveLinks: Array.isArray(req.body.extraDriveLinks) ? req.body.extraDriveLinks : [],
            lichTrangDiem: req.body.lichTrangDiem || [],
            lichChup: req.body.lichChup || [],
            lichQuayPhim: req.body.lichQuayPhim || [],
            serviceSchedules: req.body.serviceSchedules || []
        });

        // Xử lý khách thanh toán trước
        const khachThanhToan = req.body.thanhToan?.khachThanhToan;
        if (khachThanhToan) {
            let amount = 0;
            let method = "Tiền mặt";
            let noiDung = "Thanh toán trước hợp đồng";
            let date = new Date();
            let paymentId = `TT-${req.body.maHopDong || Date.now()}-${Date.now()}`;

            if (typeof khachThanhToan === "object") {
                amount = Number(khachThanhToan.amount) || 0;
                method = khachThanhToan.method || "Tiền mặt";
                noiDung = khachThanhToan.noiDung || "Thanh toán trước hợp đồng";
                if (khachThanhToan.date) {
                    date = new Date(khachThanhToan.date);
                }
                if (khachThanhToan.id) {
                    paymentId = khachThanhToan.id;
                }
            } else if (typeof khachThanhToan === "number" || !isNaN(Number(khachThanhToan))) {
                amount = Number(khachThanhToan);
            }

            if (amount > 0) {
                // Lấy tên khách hàng
                let khachHangName = "";
                if (req.body.khachHang1) {
                    const kh = await KhachHang.findById(req.body.khachHang1);
                    khachHangName = kh ? kh.tenKhachHang : req.body.khachHang1.toString();
                } else {
                    khachHangName = "Khách hàng";
                }

                // Tạo đối tượng Payment mới trong CSDL
                const pProvider = method.includes("SePay") ? "SEPAY" : (method.includes("Chuyển khoản") ? "MANUAL_TRANSFER" : "CASH");
                const newPayment = new Payment({
                    id: paymentId,
                    provider: pProvider,
                    providerTransactionId: paymentId,
                    maHopDong: hopDong.maHopDong,
                    hopDongId: hopDong._id,
                    khachHang: khachHangName,
                    amount: amount,
                    date: date,
                    method: method,
                    noiDung: noiDung,
                    status: "SUCCESS"
                });
                await newPayment.save();

                // Đẩy vào danh sách các lượt thanh toán của hợp đồng
                if (!hopDong.thanhToan) {
                    hopDong.thanhToan = {};
                }
                if (!hopDong.thanhToan.cacLuotThanhToan) {
                    hopDong.thanhToan.cacLuotThanhToan = [];
                }
                hopDong.thanhToan.cacLuotThanhToan.push({
                    id: paymentId,
                    khachHang: khachHangName,
                    amount: amount,
                    date: date,
                    method: method,
                    noiDung: noiDung
                });

                // Cập nhật lại số tiền khách đã thanh toán
                hopDong.thanhToan.khachHangDaThanhToan = (hopDong.thanhToan.khachHangDaThanhToan || 0) + amount;
            }
        }

        await hopDong.save();

        // Ghi nhận sử dụng voucher nếu có
        if (req.body.thanhToan?.voucherCode || req.body.thanhToan?.voucherId) {
            try {
                const voucherService = require("./voucher.service");
                await voucherService.recordUsage({
                    voucherCode: req.body.thanhToan.voucherCode,
                    voucherId: req.body.thanhToan.voucherId,
                    hopDongId: hopDong._id,
                    maHopDong: hopDong.maHopDong,
                    khachHangId: hopDong.khachHang1,
                    tenKhachHang: req.body.tenKhachHang1 || "",
                    soDienThoai: req.body.soDienThoaiKH1 || "",
                    giamGiaAmount: req.body.thanhToan.voucherGiamGia || 0
                });
            } catch (vErr) {
                console.error("Lỗi ghi nhận voucher usage:", vErr);
            }
        }
        console.log("Đã tạo hợp đồng mã số: " + req.body.maHopDong + " thành công !");
        
        let tenKhach = "";
        try {
            if (req.body.khachHang1) {
                const khObj = await KhachHang.findById(req.body.khachHang1);
                tenKhach = khObj ? khObj.tenKhachHang : "";
            }
        } catch (e) {}

        createLog({
            action: `Tạo hợp đồng mới (${req.body.maHopDong})`,
            user: req.user?.fullname || req.body.createBy || "Nhân viên",
            req,
            details: {
                maHopDong: req.body.maHopDong,
                khachHang: tenKhach || "Khách hàng",
                tongTien: req.body.thanhToan?.tongGiaTriSauGiam || req.body.thanhToan?.tongGiaTri || 0
            }
        });

        return success(res, "Đã tạo hợp đồng mã số: " + req.body.maHopDong + " thành công !", hopDong);
    } catch (err) {
        if (err.code === 11000) {
            return error(res, "Mã hợp đồng đã tồn tại, vui lòng sử dụng mã khác.");
        }
        return error(res, "Không thể tạo hợp đồng: " + err.message);
    }
}

async function update(req, res) {
    try {
        const { maHopDong, gioHang, thanhToan, nguoiPhucVu, giaiDoan, subGiaiDoan, cacNgay, linkAnhGoc, linkAnhChinhSua, extraDriveLinks, danhSachAnhIn, isSpecialCollection, lichTrangDiem, lichChup, lichQuayPhim, serviceSchedules, dichVuChinh, auditLog, newAuditEntry } = req.body;
        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (dichVuChinh !== undefined) hopDong.dichVuChinh = Number(dichVuChinh);

        if (isSpecialCollection !== undefined) hopDong.isSpecialCollection = isSpecialCollection;
        if (lichTrangDiem !== undefined) hopDong.lichTrangDiem = lichTrangDiem;
        if (lichChup !== undefined) hopDong.lichChup = lichChup;
        if (lichQuayPhim !== undefined) hopDong.lichQuayPhim = lichQuayPhim;
        if (serviceSchedules !== undefined) hopDong.serviceSchedules = serviceSchedules;
        if (gioHang !== undefined) {
            hopDong.gioHang = Array.isArray(gioHang) ? gioHang.map(item => {
                const donGia = parseFloat(item.donGia?.toString().replace(/[^0-9.-]+/g, "") || item.giaChoThueDichVu?.toString().replace(/[^0-9.-]+/g, "") || 0);
                const soLuong = Math.max(1, Number(item.soLuong) || 1);
                const giamGiaDichVu = Math.max(0, Number(item.giamGiaDichVu) || 0);
                const thanhTien = Math.max(0, (donGia * soLuong) - giamGiaDichVu);
                return {
                    ...item,
                    dichVu: item.dichVu?._id || item.dichVu || item._id,
                    donGia,
                    soLuong,
                    giamGiaDichVu,
                    thanhTien,
                    tenDichVuSnapshot: item.tenDichVuSnapshot || item.tenDichVu || ""
                };
            }) : [];
        }
        if (cacNgay !== undefined) {
            const oldNgayChuyen = hopDong.cacNgay?.ngayChuyenInAnh;
            hopDong.cacNgay = cacNgay;
            if (oldNgayChuyen && !hopDong.cacNgay.ngayChuyenInAnh) {
                hopDong.cacNgay.ngayChuyenInAnh = oldNgayChuyen;
            }
        }
        // Kiểm tra quyền phân công thợ
        const hasAssignCrewPerm = req.user && (
            req.user.username === 'along' ||
            req.user.positon === 'Quản lý' ||
            req.user.positon === 'Admin' ||
            (Array.isArray(req.user.permissions)
                ? (req.user.permissions.includes('*') || req.user.permissions.includes('all') || req.user.permissions.includes('phan-cong-tho'))
                : (req.user.permission === 1)
            )
        );

        if (nguoiPhucVu !== undefined) {
            const isAttemptingToChangeCrew = (
                (nguoiPhucVu.thoChupHinh !== undefined && nguoiPhucVu.thoChupHinh !== (hopDong.nguoiPhucVu?.thoChupHinh || "")) ||
                (nguoiPhucVu.thoMakeUp !== undefined && nguoiPhucVu.thoMakeUp !== (hopDong.nguoiPhucVu?.thoMakeUp || "")) ||
                (nguoiPhucVu.thoChinhAnh !== undefined && nguoiPhucVu.thoChinhAnh !== (hopDong.nguoiPhucVu?.thoChinhAnh || ""))
            );

            if (!hasAssignCrewPerm && isAttemptingToChangeCrew) {
                return error(res, "Bạn không có quyền phân công hoặc thay đổi thợ & ekip (Yêu cầu quyền: phan-cong-tho)", 403);
            }

            if (!hasAssignCrewPerm && hopDong.nguoiPhucVu) {
                // Bảo lưu nhân sự thợ cũ nếu tài khoản không có quyền phân công thợ
                hopDong.nguoiPhucVu = {
                    ...nguoiPhucVu,
                    thoChupHinh: hopDong.nguoiPhucVu.thoChupHinh || "",
                    thoMakeUp: hopDong.nguoiPhucVu.thoMakeUp || "",
                    thoChinhAnh: hopDong.nguoiPhucVu.thoChinhAnh || ""
                };
            } else {
                hopDong.nguoiPhucVu = nguoiPhucVu;
            }
        }
        const prevStage = hopDong.giaiDoan;
        const prevSubStage = hopDong.subGiaiDoan;

        if (giaiDoan !== undefined) {
            if (Number(giaiDoan) === 3 && hopDong.giaiDoan !== 3) {
                if (!hopDong.cacNgay) hopDong.cacNgay = {};
                if (!hopDong.cacNgay.ngayChuyenInAnh) hopDong.cacNgay.ngayChuyenInAnh = new Date();
            }
            hopDong.giaiDoan = Number(giaiDoan);
        }
        if (!hasAssignCrewPerm) {
            if (serviceSchedules !== undefined && Array.isArray(serviceSchedules)) {
                serviceSchedules.forEach(sch => {
                    const orig = (hopDong.serviceSchedules || []).find(os => (os.id && os.id === sch.id) || (os._id && String(os._id) === String(sch._id || sch.id)));
                    sch.nhanVien = orig ? (orig.nhanVien || "") : "";
                });
            }
            if (lichChup !== undefined && Array.isArray(lichChup)) {
                lichChup.forEach(sch => {
                    const orig = (hopDong.lichChup || []).find(os => (os.id && os.id === sch.id) || (os._id && String(os._id) === String(sch._id || sch.id)));
                    sch.thoChupHinh = orig ? (orig.thoChupHinh || "") : "";
                    sch.nhanVien = orig ? (orig.nhanVien || orig.thoChupHinh || "") : "";
                });
            }
            if (lichTrangDiem !== undefined && Array.isArray(lichTrangDiem)) {
                lichTrangDiem.forEach(sch => {
                    const orig = (hopDong.lichTrangDiem || []).find(os => (os.id && os.id === sch.id) || (os._id && String(os._id) === String(sch._id || sch.id)));
                    sch.thoMakeUp = orig ? (orig.thoMakeUp || "") : "";
                    sch.nhanVien = orig ? (orig.nhanVien || orig.thoMakeUp || "") : "";
                });
            }
        }

        if (subGiaiDoan !== undefined) {
            hopDong.subGiaiDoan = subGiaiDoan;
        } else if (giaiDoan !== undefined && Number(giaiDoan) !== prevStage) {
            // Chuẩn hóa subGiaiDoan khi chuyển giai đoạn chính mà không truyền subGiaiDoan
            const targetStage = Number(giaiDoan);
            if (targetStage === 2) hopDong.subGiaiDoan = 'cho_chinh';
            else if (targetStage === 4) hopDong.subGiaiDoan = 'hoan_thanh';
            else hopDong.subGiaiDoan = 'dang_thuc_hien';
        }

        // Ghi lại lịch sử giai đoạn nếu có thay đổi giaiDoan hoặc subGiaiDoan qua hàm update
        if (hopDong.giaiDoan !== prevStage || hopDong.subGiaiDoan !== prevSubStage) {
            if (!hopDong.lichSuGiaiDoan) hopDong.lichSuGiaiDoan = [];
            const stageNames = { 1: "Chụp hình", 2: "Hậu kỳ", 3: "In ảnh", 4: "Hoàn thành" };
            const subStageNames = {
                'cho_chinh': "Chờ chỉnh",
                'dang_chinh': "Đang chỉnh",
                'cho_khach_duyet': "Khách duyệt",
                'hoan_thanh': "Hoàn thành",
                'bao_luu': "Bảo lưu",
                'huy': "Đã hủy"
            };
            const showSub = hopDong.giaiDoan === 2 || ['bao_luu', 'huy'].includes(hopDong.subGiaiDoan);
            const subText = showSub && subStageNames[hopDong.subGiaiDoan] ? ` (${subStageNames[hopDong.subGiaiDoan]})` : '';
            hopDong.lichSuGiaiDoan.push({
                giaiDoan: hopDong.giaiDoan,
                subGiaiDoan: hopDong.subGiaiDoan,
                thoiGian: new Date(),
                nguoiThucHien: req.user?.tenNhanVien || req.user?.fullname || req.user?.name || req.user?.username || 'Nhân viên',
                vaiTro: req.user?.chucVu || req.user?.positon || req.user?.role || 'Admin',
                ghiChu: `Cập nhật trạng thái sang: ${stageNames[hopDong.giaiDoan] || hopDong.giaiDoan}${subText}`
            });
        }

        if (linkAnhGoc !== undefined) hopDong.linkAnhGoc = linkAnhGoc;
        if (linkAnhChinhSua !== undefined) hopDong.linkAnhChinhSua = linkAnhChinhSua;
        if (extraDriveLinks !== undefined) hopDong.extraDriveLinks = extraDriveLinks;
        if (danhSachAnhIn !== undefined) hopDong.danhSachAnhIn = danhSachAnhIn;

        if (thanhToan !== undefined || gioHang !== undefined) {
            const currentThanhToan = hopDong.thanhToan || {};
            const incomingThanhToan = thanhToan || {};

            const giamGia = incomingThanhToan.giamGia !== undefined ? Number(incomingThanhToan.giamGia) || 0 : (currentThanhToan.giamGia || 0);
            const loaiGiamGia = incomingThanhToan.loaiGiamGia !== undefined ? Number(incomingThanhToan.loaiGiamGia) || 0 : (currentThanhToan.loaiGiamGia || 0);
            const voucherCode = incomingThanhToan.voucherCode !== undefined ? incomingThanhToan.voucherCode : (currentThanhToan.voucherCode || "");
            const voucherGiamGia = incomingThanhToan.voucherGiamGia !== undefined ? Number(incomingThanhToan.voucherGiamGia) || 0 : (Number(currentThanhToan.voucherGiamGia) || 0);
            const voucherId = incomingThanhToan.voucherId !== undefined ? incomingThanhToan.voucherId : currentThanhToan.voucherId;
            const tongPhatSinh = incomingThanhToan.tongPhatSinh !== undefined ? Number(incomingThanhToan.tongPhatSinh) || 0 : (Number(currentThanhToan.tongPhatSinh) || 0);
            const cacLuotThanhToan = incomingThanhToan.cacLuotThanhToan !== undefined ? incomingThanhToan.cacLuotThanhToan : (currentThanhToan.cacLuotThanhToan || []);

            // Recalculate totals from active cart items + add-ons
            const activeGioHang = hopDong.gioHang || [];
            const tongCart = activeGioHang.reduce((sum, item) => {
                if (item.thanhTien !== undefined && item.thanhTien !== null) {
                    return sum + (Number(item.thanhTien) || 0);
                }
                const donGia = parseFloat(item.donGia?.toString().replace(/[^0-9.-]+/g, "") || item.giaChoThueDichVu?.toString().replace(/[^0-9.-]+/g, "") || 0);
                const soLuong = Math.max(1, Number(item.soLuong) || 1);
                const giamGiaDichVu = Math.max(0, Number(item.giamGiaDichVu) || 0);
                return sum + Math.max(0, (donGia * soLuong) - giamGiaDichVu);
            }, 0);
            const tongGiaTri = tongCart + tongPhatSinh;

            let tongGiaTriSauGiam = tongGiaTri;
            if (Number(loaiGiamGia) === 1) {
                tongGiaTriSauGiam = tongGiaTri - (tongGiaTri * (giamGia / 100));
            } else {
                tongGiaTriSauGiam = tongGiaTri - giamGia;
            }
            tongGiaTriSauGiam = Math.max(0, tongGiaTriSauGiam - voucherGiamGia);

            // Recalculate total paid
            const khachHangDaThanhToan = cacLuotThanhToan.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // Validate: If cart was modified, contract total after discount must not be less than the amount already paid
            if (gioHang !== undefined && khachHangDaThanhToan > 0 && tongGiaTriSauGiam < khachHangDaThanhToan) {
                return error(res, `Không thể xóa/giảm sản phẩm vì tổng tiền hợp đồng (${tongGiaTriSauGiam.toLocaleString("vi-VN")} đ) sẽ nhỏ hơn số tiền khách hàng đã thanh toán (${khachHangDaThanhToan.toLocaleString("vi-VN")} đ)!`);
            }

            const conLai = Math.max(0, tongGiaTriSauGiam - khachHangDaThanhToan);
            let phanTramDaThanhToan = 0;
            if (tongGiaTriSauGiam > 0) {
                const pt = (khachHangDaThanhToan / tongGiaTriSauGiam) * 100;
                phanTramDaThanhToan = Math.min(100, Math.max(0, Math.round(pt * 10) / 10));
            } else {
                phanTramDaThanhToan = khachHangDaThanhToan > 0 ? 100 : 0;
            }
            const trangThaiThanhToan = conLai <= 0 && (khachHangDaThanhToan > 0 || tongGiaTriSauGiam === 0) ? "Đã thanh toán đủ" : (khachHangDaThanhToan > 0 ? "Đang thanh toán" : "Chưa thanh toán");

            hopDong.thanhToan = {
                tongGiaTri,
                tongPhatSinh,
                giamGia,
                loaiGiamGia,
                voucherCode,
                voucherGiamGia,
                voucherId,
                tongGiaTriSauGiam,
                khachHangDaThanhToan,
                conLai,
                phanTramDaThanhToan,
                trangThaiThanhToan,
                cacLuotThanhToan
            };

            // Save new payments to Payment collection
            if (cacLuotThanhToan && cacLuotThanhToan.length > 0) {
                for (let payment of cacLuotThanhToan) {
                    if (payment.id) {
                        const pMethod = payment.method || "Tiền mặt";
                        const pProvider = pMethod.includes("SePay") ? "SEPAY" : (pMethod.includes("Chuyển khoản") ? "MANUAL_TRANSFER" : "CASH");
                        const existing = await Payment.findOne({
                            $or: [
                                { id: payment.id },
                                { provider: pProvider, providerTransactionId: payment.id }
                            ]
                        });
                        if (!existing) {
                            const newPayment = new Payment({
                                id: payment.id,
                                provider: pProvider,
                                providerTransactionId: payment.id,
                                maHopDong: hopDong.maHopDong,
                                hopDongId: hopDong._id,
                                khachHang: payment.khachHang || "Khách hàng",
                                amount: Number(payment.amount) || 0,
                                date: payment.date ? new Date(payment.date) : new Date(),
                                method: pMethod,
                                noiDung: payment.noiDung || "Thanh toán",
                                status: "SUCCESS"
                            });
                            await newPayment.save();
                        }
                    }
                }
            }
        }

        // Ghi lại lịch sử hoạt động hợp đồng (Audit Log)
        if (newAuditEntry) {
            if (!hopDong.auditLog) hopDong.auditLog = [];
            hopDong.auditLog.push({
                action: newAuditEntry.action || "Cập nhật hợp đồng",
                reason: newAuditEntry.reason || "",
                oldValue: newAuditEntry.oldValue || null,
                newValue: newAuditEntry.newValue || null,
                details: newAuditEntry.details || [],
                performedBy: req.user?.fullname || req.user?.tenNhanVien || newAuditEntry.performedBy || "Nhân viên",
                role: req.user?.chucVu || req.user?.positon || newAuditEntry.role || "Admin",
                timestamp: new Date()
            });
        } else if (Array.isArray(auditLog)) {
            hopDong.auditLog = auditLog;
        }

        // Nếu hợp đồng được cập nhật thành Giai đoạn 4 (Hoàn thành), tự động hoàn tất toàn bộ tiến trình & lịch
        if (hopDong.giaiDoan === 4) {
            await completeContractProgressAndSchedules(hopDong, req.user?.fullname || "Hệ thống");
        }

        await hopDong.save();

        if (hopDong.giaiDoan === 4 && prevStage !== 4) {
            try {
                const workflowEngine = require("./workflowEngine");
                await workflowEngine.onContractStageTransition({
                    contract: hopDong,
                    previousStage: prevStage,
                    nextStage: 4,
                    nextSubStage: 'hoan_thanh',
                    performedBy: req.user?.fullname || "Hệ thống"
                });
            } catch (wfErr) {
                console.warn("[Workflow Engine Warning]:", wfErr.message);
            }
        }

        // Tự động đồng bộ lịch sang Booking service
        if (hopDong.giaiDoan === 4 || lichChup !== undefined || lichTrangDiem !== undefined || serviceSchedules !== undefined || cacNgay !== undefined) {
            try {
                await bookingService.syncContractToBookings(hopDong, req.user?.fullname || "Hệ thống");
            } catch (syncErr) {
                console.warn("[Booking Sync Warning]:", syncErr.message);
            }
        }

        createLog({
            action: `Cập nhật hợp đồng (${maHopDong})`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: {
                maHopDong,
                giaiDoan: giaiDoan !== undefined ? giaiDoan : hopDong.giaiDoan,
                thoChupHinh: hopDong.nguoiPhucVu?.thoChupHinh,
                thoMakeUp: hopDong.nguoiPhucVu?.thoMakeUp,
                thoChinhAnh: hopDong.nguoiPhucVu?.thoChinhAnh
            }
        });

        return success(res, "Đã cập nhật thành công", hopDong);

    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const maHopDong = req.body?.maHopDong || req.query?.maHopDong || (typeof req.body === "string" ? req.body : req.body?.id);
        if (!maHopDong) {
            return error(res, "Thiếu mã hợp đồng để xóa");
        }

        const hopDong = await HopDong.findOne({ maHopDong: maHopDong });
        if (!hopDong) {
            return error(res, "Không tìm thấy hợp đồng để xóa");
        }

        // 1. Kiểm tra hợp đồng đã có thanh toán
        const daThanhToan = Number(hopDong.thanhToan?.khachHangDaThanhToan) || 0;
        const cacLuotThanhToan = hopDong.thanhToan?.cacLuotThanhToan || [];
        if (daThanhToan > 0 || (Array.isArray(cacLuotThanhToan) && cacLuotThanhToan.length > 0)) {
            return error(
                res,
                `Không thể xóa hợp đồng vì đã có phát sinh thanh toán (${daThanhToan > 0 ? daThanhToan.toLocaleString("vi-VN") + " đ" : "có lịch sử thanh toán"})!`
            );
        }

        // 2. Kiểm tra phiếu thuê đồ đang cho thuê / đang mượn
        const LichSoanDo = require("../models/lichSoanDo.model");
        const activeRental = await LichSoanDo.findOne({
            $or: [{ maHopDong: maHopDong }, { hopDongId: hopDong._id }],
            trangThai: { $in: ["Đang mượn", "Đang thuê", "Đang cho thuê"] }
        });

        const trangThaiSoanDoEmbedded = hopDong.soanDo?.trangThai;
        const isEmbeddedRenting = ["Đang mượn", "Đang thuê", "Đang cho thuê"].includes(trangThaiSoanDoEmbedded);

        if (activeRental || isEmbeddedRenting) {
            return error(
                res,
                "Không thể xóa hợp đồng vì đang có phiếu thuê đồ ở trạng thái đang cho thuê/mượn!"
            );
        }

        const deletedHD = await HopDong.findOneAndDelete({ maHopDong: maHopDong });

        // Xóa lịch soạn đồ đi kèm nếu có (khi ở trạng thái Chưa mượn / Đã trả)
        try {
            await LichSoanDo.deleteMany({ $or: [{ maHopDong: maHopDong }, { hopDongId: hopDong._id }] });
        } catch (e) {
            console.error("Lỗi khi xóa lịch soạn đồ đi kèm:", e);
        }

        // Xóa album đi kèm nếu có
        try {
            await Album.findOneAndDelete({ maHopDong: maHopDong });
        } catch (e) {
            console.error("Lỗi khi xóa album đi kèm:", e);
        }

        console.log("Đã xóa hợp đồng:", deletedHD.maHopDong);
        createLog({
            action: `Xóa hợp đồng (${deletedHD.maHopDong})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { maHopDong: deletedHD.maHopDong }
        });
        return success(res, "Xóa hợp đồng thành công");
    } catch (err) {
        return error(res, err.message);
    }
}

async function pay(req, res) {
    try {
        const { maHopDong, amount, method, noiDung } = req.body;
        if (!maHopDong) return error(res, "Thiếu mã hợp đồng", 400);
        const payAmount = Number(amount);
        if (isNaN(payAmount) || payAmount <= 0) return error(res, "Số tiền không hợp lệ", 400);

        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng", 404);

        const paymentId = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const pMethod = method || "Tiền mặt";
        const pProvider = pMethod === "Chuyển khoản" ? "MANUAL_TRANSFER" : (pMethod === "SePay" ? "SEPAY" : "CASH");

        const newPayment = new Payment({
            id: paymentId,
            provider: pProvider,
            providerTransactionId: paymentId,
            maHopDong: hopDong.maHopDong,
            hopDongId: hopDong._id,
            khachHangId: hopDong.khachHang1?._id || hopDong.khachHang1,
            khachHang: hopDong.khachHang1?.tenKhachHang || "Khách hàng",
            amount: payAmount,
            date: new Date(),
            method: pMethod,
            noiDung: noiDung || `Thanh toán hợp đồng ${hopDong.maHopDong}`,
            status: "SUCCESS"
        });
        await newPayment.save();

        if (!hopDong.thanhToan) hopDong.thanhToan = {};
        if (!Array.isArray(hopDong.thanhToan.cacLuotThanhToan)) {
            hopDong.thanhToan.cacLuotThanhToan = [];
        }

        hopDong.thanhToan.cacLuotThanhToan.push({
            id: paymentId,
            amount: payAmount,
            date: new Date(),
            method: pMethod,
            noiDung: noiDung || `Thanh toán hợp đồng ${hopDong.maHopDong}`
        });

        ensurePaymentProgress(hopDong);
        await hopDong.save();

        createLog({
            action: `Thanh toán hợp đồng (${maHopDong})`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: { maHopDong, amount: payAmount, method: pMethod }
        });

        return success(res, "Thanh toán thành công", {
            paymentId,
            thanhToan: hopDong.thanhToan
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

// Helper functions for ICT date filtering
function getICTStartOfDay() {
    const now = new Date();
    const tzOffset = 7 * 60; // ICT is UTC+7
    const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
    const ictDate = new Date(localTime);
    
    const ictStart = new Date(Date.UTC(
        ictDate.getFullYear(),
        ictDate.getMonth(),
        ictDate.getDate(),
        0, 0, 0, 0
    ));
    
    ictStart.setHours(ictStart.getHours() - 7);
    return ictStart;
}

function getICTStartDateForFilter(filter) {
    if (!filter) return null;
    const startOfToday = getICTStartOfDay();
    
    switch (filter) {
        case 1:
        case '1':
        case 'today':
        case 'hôm nay':
            return startOfToday;
        case 2:
        case '2':
        case 'week':
        case '1week':
        case '1 tuần':
        case 'tuần':
            const weekStart = new Date(startOfToday);
            weekStart.setDate(weekStart.getDate() - 7);
            return weekStart;
        case 3:
        case '3':
        case 'month':
        case '1month':
        case '1 tháng':
        case 'tháng':
            const monthStart = new Date(startOfToday);
            monthStart.setMonth(monthStart.getMonth() - 1);
            return monthStart;
        case 4:
        case '4':
        case '4months':
        case '4month':
        case '4 tháng':
            const fourMonthsStart = new Date(startOfToday);
            fourMonthsStart.setMonth(fourMonthsStart.getMonth() - 4);
            return fourMonthsStart;
        case 'year':
        case 'năm':
            const yearStart = new Date(startOfToday);
            yearStart.setMonth(0, 1);
            return yearStart;
        default:
            return null;
    }
}

function getICTDateRange(period) {
    if (!period) return null;
    const startOfToday = getICTStartOfDay();
    
    let start, end;
    switch (period) {
        case 'today':
        case 'hôm nay': {
            start = startOfToday;
            end = new Date(startOfToday);
            end.setDate(end.getDate() + 1);
            break;
        }
        case 'week':
        case 'this_week':
        case 'tuần':
        case 'tuần này': {
            const now = new Date();
            const tzOffset = 7 * 60;
            const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
            const ictDate = new Date(localTime);
            const day = ictDate.getDay();
            const diffToMonday = ictDate.getDate() - (day === 0 ? 6 : day - 1);
            
            const startOfWeek = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth(),
                diffToMonday,
                0, 0, 0, 0
            ));
            startOfWeek.setHours(startOfWeek.getHours() - 7);
            
            start = startOfWeek;
            end = new Date(startOfWeek);
            end.setDate(end.getDate() + 7);
            break;
        }
        case 'month':
        case 'this_month':
        case 'tháng':
        case 'tháng này': {
            const now = new Date();
            const tzOffset = 7 * 60;
            const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
            const ictDate = new Date(localTime);
            
            const startOfMonth = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth(),
                1,
                0, 0, 0, 0
            ));
            startOfMonth.setHours(startOfMonth.getHours() - 7);
            
            const endOfMonth = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth() + 1,
                1,
                0, 0, 0, 0
            ));
            endOfMonth.setHours(endOfMonth.getHours() - 7);
            
            start = startOfMonth;
            end = endOfMonth;
            break;
        }
        default:
            return null;
    }
    return { start, end };
}

async function list(req, res) {
    try {
        const filter = req.body.filter || req.query.filter;
        const status = req.body.status || req.query.status || req.body.giaiDoan || req.query.giaiDoan;
        const keyword = req.body.keyword || req.query.keyword || req.body.q || req.query.q;
        const isCalendar = req.body.isCalendar === true || req.body.isCalendar === 'true';
        const dateField = req.body.dateField || req.query.dateField || 'cacNgay.ngayChup';
        const chotLich = req.body.chotLich || req.query.chotLich;
        
        let query = {};

        if (chotLich !== undefined && chotLich !== null && chotLich !== '' && chotLich !== 'all') {
            if (Array.isArray(chotLich)) {
                query['cacNgay.chotLich'] = { $in: chotLich };
            } else {
                query['cacNgay.chotLich'] = chotLich;
            }
        }

        // 1. Lọc theo thời gian
        let dateConditions = null;
        if (isCalendar) {
            if (dateField === 'anHoiVaCuoi') {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        dateConditions = {
                            $or: [
                                { 'cacNgay.ngayAnHoi': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayCuoi': { $gte: range.start, $lt: range.end } }
                            ]
                        };
                    }
                } else {
                    dateConditions = {
                        $or: [
                            { 'cacNgay.ngayAnHoi': { $exists: true, $ne: null } },
                            { 'cacNgay.ngayCuoi': { $exists: true, $ne: null } }
                        ]
                    };
                }
            } else if (dateField === 'makeUp' || dateField === 'makeup' || dateField === 'cacNgay.ngayTrangDiem') {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        dateConditions = {
                            $or: [
                                { 'cacNgay.ngayTrangDiem': { $gte: range.start, $lt: range.end } },
                                { 'lichTrangDiem.ngayTrangDiem': { $gte: range.start, $lt: range.end } },
                                { 'serviceSchedules.ngayGio': { $gte: range.start.toISOString().slice(0, 10), $lte: range.end.toISOString() } }
                            ]
                        };
                    }
                } else {
                    dateConditions = {
                        $or: [
                            { 'cacNgay.ngayTrangDiem': { $exists: true, $ne: null } },
                            { 'serviceSchedules.serviceType': 'makeup' },
                            { 'lichTrangDiem.0': { $exists: true } }
                        ]
                    };
                }
            } else if (dateField === 'quayPhim' || dateField === 'cacNgay.ngayQuayPhim') {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        dateConditions = {
                            $or: [
                                { 'cacNgay.ngayQuayPhim': { $gte: range.start, $lt: range.end } },
                                { 'lichQuayPhim.ngayGio': { $gte: range.start, $lt: range.end } },
                                { 'serviceSchedules.ngayGio': { $gte: range.start.toISOString().slice(0, 10), $lte: range.end.toISOString() } }
                            ]
                        };
                    }
                } else {
                    dateConditions = {
                        $or: [
                            { 'cacNgay.ngayQuayPhim': { $exists: true, $ne: null } },
                            { 'serviceSchedules.serviceType': 'video' },
                            { 'lichQuayPhim.0': { $exists: true } }
                        ]
                    };
                }
            } else if (dateField === 'chupHinh' || dateField === 'chup' || dateField === 'cacNgay.ngayChup') {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        dateConditions = {
                            $or: [
                                { 'cacNgay.ngayChup': { $gte: range.start, $lt: range.end } },
                                { 'lichChup.ngayGio': { $gte: range.start, $lt: range.end } },
                                { 'serviceSchedules.ngayGio': { $gte: range.start.toISOString().slice(0, 10), $lte: range.end.toISOString() } }
                            ]
                        };
                    }
                } else {
                    dateConditions = {
                        $or: [
                            { 'cacNgay.ngayChup': { $exists: true, $ne: null } },
                            { 'serviceSchedules.serviceType': 'photo' },
                            { 'lichChup.0': { $exists: true } }
                        ]
                    };
                }
            } else if (dateField === 'tongHop') {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        dateConditions = {
                            $or: [
                                { 'cacNgay.ngayChup': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayTrangDiem': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayQuayPhim': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayChinhAnh': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayTraAnh': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayAnHoi': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayCuoi': { $gte: range.start, $lt: range.end } },
                                { 'serviceSchedules.ngayGio': { $gte: range.start.toISOString().slice(0, 10), $lte: range.end.toISOString() } }
                            ]
                        };
                    }
                }
            } else {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        query[dateField] = { $gte: range.start, $lt: range.end };
                    }
                } else {
                    query[dateField] = { $exists: true, $ne: null };
                }
            }
        } else {
            if (filter && filter !== 'all') {
                const startDate = getICTStartDateForFilter(filter);
                if (startDate) {
                    query.ngayHopDong = { $gte: startDate };
                }
            }
        }

        // 2. Lọc theo trạng thái
        const subGiaiDoan = req.body.subGiaiDoan || req.query.subGiaiDoan;
        if (status !== undefined && status !== null && status !== '' && status !== 'all') {
            if (Array.isArray(status)) {
                query.giaiDoan = { $in: status.map(Number) };
            } else if (typeof status === 'string' && status.includes('_')) {
                const parts = status.split('_');
                query.giaiDoan = Number(parts[0]);
                const sub = parts.slice(1).join('_');
                if (query.giaiDoan === 2 && sub === 'cho_chinh') {
                    query.subGiaiDoan = { $in: ['cho_chinh', 'da_giao_file_goc', 'khach_da_chon_anh'] };
                } else if (query.giaiDoan === 2 && (sub === 'dang_chinh' || sub === 'dang_hau_ky')) {
                    query.subGiaiDoan = { $in: ['dang_chinh', 'dang_hau_ky', 'dang_chinh_anh', 'dang_thuc_hien'] };
                } else if (query.giaiDoan === 2 && (sub === 'cho_khach_duyet' || sub === 'khach_duyet_anh')) {
                    query.subGiaiDoan = { $in: ['cho_khach_duyet', 'khach_duyet_anh', 'cho_khach_duyet_layout', 'khach_da_duyet_layout'] };
                } else {
                    query.subGiaiDoan = sub;
                }
            } else {
                query.giaiDoan = Number(status);
            }
        }
        if (subGiaiDoan && subGiaiDoan !== 'all' && !query.subGiaiDoan) {
            query.subGiaiDoan = subGiaiDoan;
        }

        // 3. Tìm kiếm theo từ khóa (mã hợp đồng, số điện thoại, tên khách hàng)
        let keywordConditions = null;
        if (keyword) {
            const customers = await KhachHang.find({
                $or: [
                    { soDienThoai: { $regex: keyword, $options: 'i' } },
                    { tenKhachHang: { $regex: keyword, $options: 'i' } }
                ]
            });
            const customerIds = customers.map(c => c._id);
            
            keywordConditions = {
                $or: [
                    { maHopDong: { $regex: keyword, $options: 'i' } },
                    { khachHang1: { $in: customerIds } },
                    { khachHang2: { $in: customerIds } }
                ]
            };
        }

        // Kết hợp dateConditions và keywordConditions
        if (dateConditions && keywordConditions) {
            query.$and = [dateConditions, keywordConditions];
        } else if (dateConditions) {
            Object.assign(query, dateConditions);
        } else if (keywordConditions) {
            Object.assign(query, keywordConditions);
        }

        // ==========================================
        // SỬ DỤNG .POPULATE() ĐỂ LẤY THÔNG TIN
        // HỖ TRỢ PHÂN TRANG (PAGE & LIMIT)
        // ==========================================
        let sortQuery = { ngayHopDong: -1 };
        if (isCalendar) {
            if (dateField === 'anHoiVaCuoi') {
                sortQuery = { 'cacNgay.ngayAnHoi': 1, 'cacNgay.ngayCuoi': 1 };
            } else if (dateField === 'makeUp' || dateField === 'makeup' || dateField === 'cacNgay.ngayTrangDiem') {
                sortQuery = { 'cacNgay.ngayTrangDiem': 1 };
            } else if (dateField === 'quayPhim' || dateField === 'cacNgay.ngayQuayPhim') {
                sortQuery = { 'cacNgay.ngayQuayPhim': 1 };
            } else if (dateField === 'tongHop') {
                sortQuery = { ngayHopDong: -1 };
            } else {
                sortQuery = { [dateField]: 1 };
            }
        }

        const page = Math.max(1, parseInt(req.body.page || req.query.page) || 1);
        const limit = Math.max(0, parseInt(req.body.limit || req.query.limit) || 0);

        let hopDongQuery = HopDong.find(query)
            .populate({
                path: 'khachHang1',      // Tên trường chứa ObjectId của khách hàng 1
                select: 'tenKhachHang soDienThoai diaChi facebookId' // Chỉ định các trường muốn lấy
            })
            .populate({
                path: 'khachHang2',      // Tên trường chứa ObjectId của khách hàng 2
                select: 'tenKhachHang soDienThoai diaChi facebookId'
            })
            .populate({
                path: 'gioHang.dichVu',
                select: 'loaiDichVu tenDichVu giaChoThueDichVu maDichVu'
            })
            .sort(sortQuery);

        let totalCount = 0;
        let hasMore = false;
        let totalPages = 1;

        if (limit > 0) {
            totalCount = await HopDong.countDocuments(query);
            hopDongQuery = hopDongQuery.skip((page - 1) * limit).limit(limit);
            totalPages = Math.ceil(totalCount / limit);
            hasMore = (page * limit) < totalCount;
        }

        const hopDong = await hopDongQuery;
        const formattedList = hopDong.map(h => sanitizeContractForRole(ensurePaymentProgress(h), req.user));

        if (limit === 0) {
            totalCount = formattedList.length;
        }

        return success(res, "Tải dữ liệu thành công !", {
            filter: filter || "all",
            status: status || "all",
            keyword: keyword || "",
            count: totalCount,
            page: page,
            limit: limit,
            totalPages: totalPages,
            hasMore: hasMore,
            hopDong: formattedList
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function search(req, res) {
    try {
        const keyword = req.body.keyword || req.query.keyword || req.body.q || req.query.q;
        const maHopDong = req.body.maHopDong || req.query.maHopDong;
        const soDienThoai = req.body.soDienThoai || req.query.soDienThoai;
        
        let query = {};
        
        if (keyword) {
            // Tìm kiếm khách hàng theo số điện thoại hoặc tên khách hàng (chứa keyword)
            const customers = await KhachHang.find({
                $or: [
                    { soDienThoai: { $regex: keyword, $options: 'i' } },
                    { tenKhachHang: { $regex: keyword, $options: 'i' } }
                ]
            });
            const customerIds = customers.map(c => c._id);
            
            // Tìm kiếm theo mã hợp đồng hoặc khách hàng có ID trong danh sách
            query = {
                $or: [
                    { maHopDong: { $regex: keyword, $options: 'i' } },
                    { khachHang1: { $in: customerIds } },
                    { khachHang2: { $in: customerIds } }
                ]
            };
        } else {
            let orConditions = [];
            if (maHopDong) {
                orConditions.push({ maHopDong: { $regex: maHopDong, $options: 'i' } });
            }
            if (soDienThoai) {
                const customers = await KhachHang.find({
                    soDienThoai: { $regex: soDienThoai, $options: 'i' }
                });
                const customerIds = customers.map(c => c._id);
                orConditions.push({ khachHang1: { $in: customerIds } });
                orConditions.push({ khachHang2: { $in: customerIds } });
            }
            
            if (orConditions.length > 0) {
                query = { $or: orConditions };
            }
        }
        
        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'khachHang2',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'gioHang.dichVu',
                select: 'loaiDichVu tenDichVu giaChoThueDichVu maDichVu'
            })
            .sort({ ngayHopDong: -1 });
            
        const formattedList = hopDong.map(h => sanitizeContractForRole(ensurePaymentProgress(h), req.user));
            
        return success(res, "Tìm kiếm hợp đồng thành công !", {
            count: formattedList.length,
            hopDong: formattedList
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function updateProgress(req, res) {
    try {
        const { maHopDong, giaiDoan, subGiaiDoan, data, dichVuChinh } = req.body;
        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (dichVuChinh !== undefined) {
            hopDong.dichVuChinh = Number(dichVuChinh);
        }

        const nextStage = giaiDoan !== undefined ? Number(giaiDoan) : hopDong.giaiDoan;
        let nextSubStage = subGiaiDoan !== undefined ? subGiaiDoan : (hopDong.subGiaiDoan || 'dang_thuc_hien');

        // Chuẩn hóa subGiaiDoan theo quy tắc: chỉ Giai đoạn 2 có 4 trạng thái phụ (cho_chinh, dang_chinh, cho_khach_duyet, hoan_thanh)
        if (!['bao_luu', 'huy'].includes(nextSubStage)) {
            if (nextStage === 1 || nextStage === 3) {
                nextSubStage = 'dang_thuc_hien';
            } else if (nextStage === 4) {
                nextSubStage = 'hoan_thanh';
            } else if (nextStage === 2) {
                if (['cho_chinh', 'da_giao_file_goc', 'khach_da_chon_anh'].includes(nextSubStage)) {
                    nextSubStage = 'cho_chinh';
                } else if (['cho_khach_duyet', 'khach_duyet_anh', 'cho_khach_duyet_layout', 'khach_da_duyet_layout'].includes(nextSubStage)) {
                    nextSubStage = 'cho_khach_duyet';
                } else if (nextSubStage === 'hoan_thanh') {
                    nextSubStage = 'hoan_thanh';
                } else if (['dang_chinh', 'dang_hau_ky', 'dang_chinh_anh'].includes(nextSubStage)) {
                    nextSubStage = 'dang_chinh';
                } else {
                    nextSubStage = 'cho_chinh';
                }
            }
        }

        if (nextStage < 1 || nextStage > 4) {
            return error(res, "Giai đoạn không hợp lệ (quy trình gồm 4 giai đoạn: 1. Chụp hình, 2. Hậu kỳ, 3. In ảnh, 4. Hoàn thành)");
        }

        const transitionCheck = await validateTransition({
            contract: hopDong,
            album: null,
            nextStage,
            nextSubStage,
            user: req.user,
            data: data || {},
            forceOverride: Boolean(req.body?.forceOverride)
        });

        if (!transitionCheck.valid) {
            return error(res, transitionCheck.error || "Chuyển giai đoạn không hợp lệ", 400);
        }

        if (!hopDong.thoiGianChuyenGiaiDoan) hopDong.thoiGianChuyenGiaiDoan = {};
        const stageTimeKeys = { 1: "chupHinh", 2: "hauKy", 3: "inAnh", 4: "hoanThanh" };
        if (stageTimeKeys[nextStage]) {
            hopDong.thoiGianChuyenGiaiDoan[stageTimeKeys[nextStage]] = new Date();
        }

        // Cập nhật dữ liệu tương ứng nếu có
        if (data) {
            if (data.linkAnhGoc !== undefined) {
                hopDong.linkAnhGoc = data.linkAnhGoc;
            }
            if (data.linkAnhChinhSua !== undefined) {
                hopDong.linkAnhChinhSua = data.linkAnhChinhSua;
            }
            if (Array.isArray(data.danhSachAnhIn)) {
                hopDong.danhSachAnhIn = data.danhSachAnhIn;
                if (!hopDong.cacNgay) hopDong.cacNgay = {};
                if (!hopDong.cacNgay.ngayChuyenInAnh) {
                    hopDong.cacNgay.ngayChuyenInAnh = new Date();
                }
            }
            if (data.cacNgay) {
                hopDong.cacNgay = {
                    ...(hopDong.cacNgay || {}),
                    ...data.cacNgay
                };
            }
            if (data.nguoiPhucVu) {
                hopDong.nguoiPhucVu = {
                    ...(hopDong.nguoiPhucVu || {}),
                    ...data.nguoiPhucVu
                };
            }
        }

        // Ghi lại lịch sử giai đoạn (Audit trail)
        if (!hopDong.lichSuGiaiDoan) {
            hopDong.lichSuGiaiDoan = [];
        }

        const performerName = req.user?.tenNhanVien || req.user?.name || req.user?.username || 'Nhân viên';
        const performerRole = req.user?.chucVu || req.user?.positon || req.user?.role || 'Admin';
        const stageChanged = (hopDong.giaiDoan !== nextStage) || (hopDong.subGiaiDoan !== nextSubStage);

        const stageNames = { 1: "Chụp hình", 2: "Hậu kỳ", 3: "In ảnh", 4: "Hoàn thành" };
        const subStageNames = { 
            'dang_thuc_hien': "Đang thực hiện", 
            'cho_chinh': "Chờ chỉnh",
            'dang_chinh': "Đang chỉnh",
            'dang_hau_ky': "Đang chỉnh",
            'dang_chinh_anh': "Đang chỉnh",
            'cho_khach_duyet': "Khách duyệt",
            'khach_duyet_anh': "Khách duyệt",
            'cho_khach_duyet_layout': "Khách duyệt",
            'khach_da_duyet_layout': "Khách duyệt",
            'da_giao_file_goc': "Chờ chỉnh",
            'khach_da_chon_anh': "Chờ chỉnh",
            'da_gui_xuong_in': "Đã gửi xưởng in",
            'studio_da_nhan_hang': "Đã nhận tại Studio",
            'da_tra_khach': "Đã bàn giao khách",
            'hoan_thanh': "Hoàn thành",
            'bao_luu': "Bảo lưu",
            'huy': "Đã hủy"
        };
        const subLabel = (nextStage === 2 || ['bao_luu', 'huy'].includes(nextSubStage))
            ? ` (${subStageNames[nextSubStage] || nextSubStage})`
            : '';

        if (stageChanged || (data && (data.linkAnhGoc || data.linkAnhChinhSua || data.danhSachAnhIn || data.ghiChu))) {
            const defaultNote = `Chuyển tiến trình thủ công sang: ${stageNames[nextStage] || nextStage}${subLabel}`;

            hopDong.lichSuGiaiDoan.push({
                giaiDoan: nextStage,
                subGiaiDoan: nextSubStage,
                thoiGian: new Date(),
                nguoiThucHien: performerName,
                vaiTro: performerRole,
                ghiChu: data?.ghiChu || defaultNote,
                duLieuKemTheo: {
                    linkAnhGoc: hopDong.linkAnhGoc,
                    linkAnhChinhSua: hopDong.linkAnhChinhSua,
                    soLuongAnhIn: Array.isArray(hopDong.danhSachAnhIn) ? hopDong.danhSachAnhIn.length : 0
                }
            });

            if (!hopDong.auditLog) hopDong.auditLog = [];
            hopDong.auditLog.push({
                action: "Chuyển tiến trình",
                reason: data?.ghiChu || defaultNote,
                oldValue: { giaiDoan: hopDong.giaiDoan, subGiaiDoan: hopDong.subGiaiDoan },
                newValue: { giaiDoan: nextStage, subGiaiDoan: nextSubStage },
                performedBy: performerName,
                role: performerRole,
                timestamp: new Date()
            });
        }

        // Nếu chuyển sang Giai đoạn 4 (Hoàn thành), tự động hoàn thành toàn bộ tiến trình & lịch
        if (nextStage === 4) {
            await completeContractProgressAndSchedules(hopDong, performerName);
        }

        hopDong.giaiDoan = nextStage;
        hopDong.subGiaiDoan = nextSubStage;
        hopDong.thoiGianChuyenGiaiDoan = new Date();
        await hopDong.save();

        // Tự động đồng bộ lịch sang Booking service
        try {
            await bookingService.syncContractToBookings(hopDong, performerName);
        } catch (syncErr) {
            console.warn("[Booking Sync Warning]:", syncErr.message);
        }

        try {
            const workflowEngine = require("./workflowEngine");
            await workflowEngine.onContractStageTransition({
                contract: hopDong,
                previousStage: stageChanged ? hopDong.giaiDoan : nextStage,
                nextStage,
                nextSubStage,
                performedBy: performerName
            });
        } catch (wfErr) {
            console.warn("[Workflow Engine Warning]:", wfErr.message);
        }

        const msg = `Cập nhật tiến trình: ${stageNames[nextStage] || nextStage}${subLabel} thành công!`;
        return success(res, msg, hopDong);

    } catch (err) {
        return error(res, err.message);
    }
}

async function getCustomerContracts(req, res) {
    try {
        const customerId = req.user.id;
        if (!customerId) return error(res, "Không xác định được khách hàng");

        const query = {
            $or: [
                { khachHang1: customerId },
                { khachHang2: customerId }
            ]
        };

        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'khachHang2',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'gioHang.dichVu',
                select: 'loaiDichVu tenDichVu giaChoThueDichVu maDichVu'
            })
            .sort({ ngayHopDong: -1 })
            .lean(); // Use lean to modify the objects

        // Attach album data to each contract if exists
        for (let contract of hopDong) {
            const album = await Album.findOne({ maHopDong: contract.maHopDong }).lean();
            if (album) {
                const coverPhoto = (album.danhSachAnh && album.danhSachAnh.find(p => p.isCover))
                    || (album.danhSachAnhChinhSua && album.danhSachAnhChinhSua[0])
                    || (album.danhSachAnh && album.danhSachAnh[0])
                    || null;
                const thumbUrl = coverPhoto ? (coverPhoto.urlNen || coverPhoto.urlGoc || coverPhoto.url) : null;
                contract.album = {
                    publicLink: album.publicLink,
                    trangThai: album.trangThai,
                    trangThaiChinhSua: album.trangThaiChinhSua,
                    soLuongAnh: album.danhSachAnh ? album.danhSachAnh.length : 0,
                    khachHangXacNhan: album.khachHangXacNhan,
                    thumbnail: thumbUrl,
                    coverPhoto: coverPhoto ? {
                        idDrive: coverPhoto.idDrive,
                        urlNen: coverPhoto.urlNen,
                        urlGoc: coverPhoto.urlGoc
                    } : null
                };
            }
        }

        const formattedList = hopDong.map(ensurePaymentProgress);

        return success(res, "Lấy danh sách hợp đồng thành công!", formattedList);
    } catch (err) {
        return error(res, err.message);
    }
}


async function customerApproveAlbum(req, res) {
    try {
        const { maHopDong, daXacNhan, ghiChu } = req.body;
        const customerId = req.user.id;
        if (!customerId) return error(res, "Không xác định được khách hàng");

        const hopDong = await HopDong.findOne({ 
            maHopDong,
            $or: [
                { khachHang1: customerId },
                { khachHang2: customerId }
            ]
        });

        if (!hopDong) return error(res, "Không tìm thấy hợp đồng của quý khách");

        const isApproved = daXacNhan !== false;
        hopDong.khachHangXacNhanAnh = {
            daXacNhan: isApproved,
            thoiGianXacNhan: new Date(),
            ghiChuKhachHang: ghiChu || (isApproved ? "Đã duyệt chốt bản in" : "Yêu cầu chỉnh sửa thêm")
        };

        if (!hopDong.lichSuGiaiDoan) {
            hopDong.lichSuGiaiDoan = [];
        }

        const customerName = req.user?.tenKhachHang || req.user?.name || "Khách Hàng";

        // Không tự động chuyển subGiaiDoan khi khách duyệt; nhân viên sẽ chuyển trạng thái thủ công
        hopDong.lichSuGiaiDoan.push({
            giaiDoan: hopDong.giaiDoan,
            subGiaiDoan: hopDong.subGiaiDoan,
            thoiGian: new Date(),
            nguoiThucHien: `Khách hàng (${customerName})`,
            vaiTro: 'KHACH_HANG',
            ghiChu: isApproved 
                ? `Khách hàng đã duyệt chốt bản in trên Website: ${ghiChu || 'Đồng ý chuyển in'}`
                : `Khách hàng gửi yêu cầu chỉnh sửa lại: ${ghiChu || ''}`,
            duLieuKemTheo: {
                linkAnhChinhSua: hopDong.linkAnhChinhSua
            }
        });

        await hopDong.save();

        const msg = isApproved 
            ? "Cảm ơn quý khách! Studio đã ghi nhận xác nhận duyệt ảnh của quý khách." 
            : "Đã gửi ý kiến chỉnh sửa của quý khách đến studio.";

        return success(res, msg, hopDong);
    } catch (err) {
        return error(res, err.message);
    }
}


// =============================================================
// ROLE-BASED ACCESS CONTROL & JOB CARD SANITIZATION
// =============================================================
function isTechnicianUser(user) {
    if (!user) return false;
    
    // Nếu là admin hoặc có quyền quản lý, dev, along -> chắc chắn không phải kỹ thuật viên
    if (user.permission === 1 || user.username === "dev" || user.username === "along" || user.is_admin === true) {
        return false;
    }
    
    const role = (user.positon || user.role || user.chucVu || "").toLowerCase();
    
    // Nếu role thuộc nhóm quản lý, admin, kế toán, sale -> không phải kỹ thuật viên
    if (
        role.includes("quản lý") || 
        role.includes("admin") || 
        role.includes("quản trị") || 
        role.includes("kế toán") ||
        role.includes("sale") ||
        role.includes("bán hàng") ||
        role.includes("thu ngân") ||
        role.includes("tiếp tân")
    ) {
        return false;
    }
    
    // Chỉ xem là kỹ thuật viên khi role RÕ RÀNG là thợ (chụp hình, makeup, chỉnh ảnh...)
    if (
        role.includes("thợ") ||
        role.includes("chụp") ||
        role.includes("make") ||
        role.includes("photoshop") ||
        role.includes("chỉnh ảnh") ||
        role.includes("kỹ thuật")
    ) {
        return true;
    }

    // Mặc định an toàn: Không ẩn đơn giá nếu không xác định rõ là kỹ thuật viên
    return false;
}

function sanitizeContractForRole(contractDoc, user) {
    if (!isTechnicianUser(user)) return contractDoc;
    
    const sanitized = typeof contractDoc.toObject === 'function' ? contractDoc.toObject() : { ...contractDoc };
    
    // Ẩn chi tiết tài chính đối với kỹ thuật viên (Chụp, Makeup, Photoshop)
    if (sanitized.thanhToan) {
        sanitized.thanhToan = {
            trangThaiThanhToan: sanitized.thanhToan.trangThaiThanhToan,
            tongGiaTri: undefined,
            giamGia: undefined,
            tongGiaTriSauGiam: undefined,
            khachHangDaThanhToan: undefined,
            conLai: undefined,
            cacLuotThanhToan: []
        };
    }
    
    // Ẩn đơn giá trong giỏ hàng
    if (Array.isArray(sanitized.gioHang)) {
        sanitized.gioHang = sanitized.gioHang.map(item => {
            const itemObj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
            delete itemObj.donGia;
            delete itemObj.thanhTien;
            delete itemObj.giamGiaDichVu;
            return itemObj;
        });
    }

    // Ẩn đơn giá trong phụ lục phát sinh
    if (Array.isArray(sanitized.phuLucPhatSinh)) {
        sanitized.phuLucPhatSinh = sanitized.phuLucPhatSinh.map(item => {
            const itemObj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
            delete itemObj.donGia;
            delete itemObj.thanhTien;
            return itemObj;
        });
    }

    sanitized.cacLuotChi = [];

    // Kỹ thuật viên chỉ thấy hoa hồng của chính mình
    if (Array.isArray(sanitized.hoaHongEkip)) {
        sanitized.hoaHongEkip = sanitized.hoaHongEkip.filter(h => 
            h.tenNhanVien === user.fullname || (user._id && h.nhanVienId && h.nhanVienId.toString() === user._id.toString())
        );
    }
    
    return sanitized;
}

// =============================================================
// CẬP NHẬT HẬU KỲ & IN ẤN (POST-PRODUCTION WORKFLOW - MANUAL STATUS)
// =============================================================
async function updatePostProduction(req, res) {
    try {
        const {
            maHopDong,
            contractId,
            subGiaiDoan,
            hauKy: nestedHauKy,
            linkAnhGoc: topLinkAnhGoc,
            linkAnhChon: topLinkAnhChon,
            danhSachMaAnhChon: topDanhSachMaAnhChon,
            linkLayoutMaket: topLinkLayoutMaket,
            layoutNote: topLayoutNote,
            thongTinInAn: topThongTinInAn
        } = req.body;

        if (!maHopDong && !contractId) return error(res, "Thiếu mã hợp đồng hoặc ID hợp đồng");

        const hopDong = maHopDong
            ? await HopDong.findOne({ maHopDong })
            : await HopDong.findById(contractId);
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (!hopDong.hauKy) hopDong.hauKy = {};

        const linkAnhGoc = topLinkAnhGoc !== undefined ? topLinkAnhGoc : nestedHauKy?.linkAnhGoc;
        const linkAnhChon = topLinkAnhChon !== undefined ? topLinkAnhChon : nestedHauKy?.linkAnhChon;
        const danhSachMaAnhChon = topDanhSachMaAnhChon !== undefined ? topDanhSachMaAnhChon : nestedHauKy?.danhSachMaAnhChon;
        const linkLayoutMaket = topLinkLayoutMaket !== undefined ? topLinkLayoutMaket : nestedHauKy?.linkLayoutMaket;
        const layoutNote = topLayoutNote !== undefined ? topLayoutNote : nestedHauKy?.layoutNote;
        const thongTinInAn = topThongTinInAn !== undefined ? topThongTinInAn : nestedHauKy?.thongTinInAn;

        if (subGiaiDoan) hopDong.subGiaiDoan = subGiaiDoan;
        if (linkAnhGoc !== undefined) {
            hopDong.hauKy.linkAnhGoc = linkAnhGoc;
            hopDong.linkAnhGoc = linkAnhGoc;
        }
        if (linkAnhChon !== undefined) hopDong.hauKy.linkAnhChon = linkAnhChon;
        if (Array.isArray(danhSachMaAnhChon)) hopDong.hauKy.danhSachMaAnhChon = danhSachMaAnhChon;

        // Lưu vết versioning layout nếu có link maket mới
        if (linkLayoutMaket && linkLayoutMaket !== hopDong.hauKy.linkLayoutMaket) {
            hopDong.hauKy.linkLayoutMaket = linkLayoutMaket;
            hopDong.hauKy.soLanSuaLayout = (hopDong.hauKy.soLanSuaLayout || 0) + 1;
            if (!hopDong.hauKy.layoutHistory) hopDong.hauKy.layoutHistory = [];
            hopDong.hauKy.layoutHistory.push({
                version: hopDong.hauKy.soLanSuaLayout,
                link: linkLayoutMaket,
                note: layoutNote || "Cập nhật layout",
                createdAt: new Date()
            });
        }

        if (thongTinInAn) {
            hopDong.hauKy.thongTinInAn = {
                ...hopDong.hauKy.thongTinInAn,
                ...thongTinInAn
            };
        }

        // Ghi lại lịch sử giai đoạn
        hopDong.lichSuGiaiDoan.push({
            giaiDoan: hopDong.giaiDoan,
            subGiaiDoan: hopDong.subGiaiDoan,
            thoiGian: new Date(),
            nguoiThucHien: req.user?.fullname || req.user?.tenNhanVien || "Hậu kỳ",
            vaiTro: req.user?.positon || req.user?.chucVu || "Photoshop",
            ghiChu: layoutNote || "Cập nhật thông tin hậu kỳ/in ấn"
        });

        await hopDong.save();
        return success(res, "Cập nhật thông tin hậu kỳ thành công", hopDong.hauKy);
    } catch (err) {
        return error(res, err.message);
    }
}

// =============================================================
// THÊM PHỤ LỤC PHÁT SINH (ADD-ON / UPSELL SAU KÝ)
// =============================================================
async function addAddonItem(req, res) {
    try {
        const { maHopDong, contractId, item } = req.body;
        const tenDichVu = req.body.tenDichVu || item?.tenDichVu;
        const donGia = req.body.donGia !== undefined ? req.body.donGia : item?.donGia;
        const soLuong = req.body.soLuong !== undefined ? req.body.soLuong : item?.soLuong;
        const ghiChu = req.body.ghiChu !== undefined ? req.body.ghiChu : item?.ghiChu;

        if ((!maHopDong && !contractId) || !tenDichVu) {
            return error(res, "Thiếu mã hợp đồng hoặc tên dịch vụ phát sinh");
        }

        const hopDong = maHopDong
            ? await HopDong.findOne({ maHopDong })
            : await HopDong.findById(contractId);
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (!hopDong.phuLucPhatSinh) hopDong.phuLucPhatSinh = [];

        const sl = Number(soLuong) || 1;
        const dg = Number(donGia) || 0;
        const thanhTien = sl * dg;

        const newAddon = {
            id: 'ADDON-' + Date.now().toString().slice(-6),
            tenDichVu,
            donGia: dg,
            soLuong: sl,
            thanhTien,
            ghiChu: ghiChu || "",
            ngayTao: new Date(),
            nguoiTao: req.user?.fullname || "Sale",
            isAddon: true
        };

        hopDong.phuLucPhatSinh.push(newAddon);

        // Ghi Audit Log bắt buộc
        hopDong.auditLog.push({
            action: "Thêm phụ lục phát sinh (Upsell)",
            reason: ghiChu || ("Thêm " + tenDichVu + " (+" + thanhTien.toLocaleString('vi-VN') + " đ)"),
            newValue: newAddon,
            performedBy: req.user?.fullname || "Nhân viên",
            role: req.user?.positon || "Sale",
            timestamp: new Date()
        });

        await hopDong.save();
        return success(res, "Đã thêm phụ lục phát sinh thành công", hopDong);
    } catch (err) {
        return error(res, err.message);
    }
}

// =============================================================
// CẬP NHẬT TÀI CHÍNH / HỦY / BẢO LƯU KÈM AUDIT LOG BẮT BUỘC
// =============================================================
async function updateWithAudit(req, res) {
    try {
        const { maHopDong, reason, action, newStatus, giamGia, loaiGiamGia } = req.body;
        if (!maHopDong) return error(res, "Thiếu mã hợp đồng");
        if (!reason || reason.trim().length < 5) {
            return error(res, "Bắt buộc phải nhập lý do cụ thể (tối thiểu 5 ký tự) cho thao tác này!");
        }

        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        const oldValue = {
            giaiDoan: hopDong.giaiDoan,
            subGiaiDoan: hopDong.subGiaiDoan,
            thanhToan: hopDong.thanhToan
        };

        if (newStatus) {
            if (newStatus === 'bao_luu') {
                hopDong.subGiaiDoan = 'bao_luu';
            } else if (newStatus === 'huy') {
                hopDong.subGiaiDoan = 'huy';
            } else if (typeof newStatus === 'number') {
                hopDong.giaiDoan = newStatus;
            }
        }

        if (giamGia !== undefined) {
            hopDong.thanhToan.giamGia = Number(giamGia) || 0;
            if (loaiGiamGia !== undefined) hopDong.thanhToan.loaiGiamGia = Number(loaiGiamGia);
        }

        hopDong.auditLog.push({
            action: action || "Cập nhật tài chính / trạng thái hợp đồng",
            reason: reason.trim(),
            oldValue,
            newValue: {
                giaiDoan: hopDong.giaiDoan,
                subGiaiDoan: hopDong.subGiaiDoan,
                thanhToan: hopDong.thanhToan
            },
            performedBy: req.user?.fullname || "Quản lý",
            role: req.user?.positon || "Admin",
            timestamp: new Date()
        });

        await hopDong.save();
        return success(res, "Cập nhật và ghi vết thành công", hopDong);
    } catch (err) {
        return error(res, err.message);
    }
}

// =============================================================
// HỆ THỐNG CẢNH BÁO TỰ ĐỘNG & NHẮC LỊCH (T-3, T-1, QUÁ HẠN)
// =============================================================
async function getReminders(req, res) {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const tomorrowStart = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowEnd = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const t3End = new Date(endOfToday.getTime() + 3 * 24 * 60 * 60 * 1000);

        // 1. Chụp hình ngày mai (T-1)
        const upcomingShoots = await HopDong.find({
            "cacNgay.ngayChup": { $gte: tomorrowStart, $lte: tomorrowEnd },
            subGiaiDoan: { $nin: ['bao_luu', 'huy', 'hoan_thanh'] }
        }).populate('khachHang1', 'tenKhachHang soDienThoai diaChi');

        // 2. Trang điểm tiệc cưới / ăn hỏi ngày mai (T-1)
        const upcomingMakeups = await HopDong.find({
            $or: [
                { "cacNgay.ngayAnHoi": { $gte: tomorrowStart, $lte: tomorrowEnd } },
                { "cacNgay.ngayCuoi": { $gte: tomorrowStart, $lte: tomorrowEnd } },
                { "lichTrangDiem.ngayTrangDiem": { $gte: tomorrowStart, $lte: tomorrowEnd } }
            ],
            subGiaiDoan: { $nin: ['bao_luu', 'huy', 'hoan_thanh'] }
        }).populate('khachHang1', 'tenKhachHang soDienThoai diaChi');

        // 3. Khách hẹn lấy váy cưới / áo dài trong 3 ngày tới (T-3)
        const upcomingDressPickups = await HopDong.find({
            "trangPhucGiu": {
                $elemMatch: {
                    ngayHenLay: { $gte: startOfToday, $lte: t3End },
                    trangThai: 'GIU_CHO'
                }
            }
        }).populate('khachHang1', 'tenKhachHang soDienThoai');

        // 4. Quá hạn trả đồ cưới về studio (Đang mượn mà quá ngày hẹn trả)
        const overdueDressReturns = await HopDong.find({
            "trangPhucGiu": {
                $elemMatch: {
                    ngayHenTra: { $lt: startOfToday },
                    trangThai: 'DANG_MUON'
                }
            }
        }).populate('khachHang1', 'tenKhachHang soDienThoai');

        // 5. Hậu kỳ quá hạn trả ảnh cho khách
        const overduePostProductions = await HopDong.find({
            "cacNgay.ngayTraAnh": { $lt: startOfToday },
            subGiaiDoan: { $nin: ['da_tra_khach', 'hoan_thanh', 'bao_luu', 'huy'] }
        }).populate('khachHang1', 'tenKhachHang soDienThoai');

        // 6. Khách vừa xác nhận chọn ảnh trên Cổng Khách Hàng (chờ nhân viên xử lý & chuyển trạng thái thủ công)
        const customerApprovedAlbums = await HopDong.find({
            "khachHangXacNhanAnh.daXacNhan": true,
            giaiDoan: { $in: [1, 2] },
            subGiaiDoan: { $nin: ['hoan_thanh', 'bao_luu', 'huy'] }
        }).populate('khachHang1', 'tenKhachHang soDienThoai');

        const mappedShoots = upcomingShoots.map(h => ({
            maHopDong: h.maHopDong,
            tenKhachHang: h.khachHang1?.tenKhachHang,
            soDienThoai: h.khachHang1?.soDienThoai,
            gioChup: h.cacNgay?.gioChup,
            diaDiem: h.cacNgay?.diaDiemChup,
            thoChup: h.nguoiPhucVu?.thoChupHinh,
            thoMake: h.nguoiPhucVu?.thoMakeUp
        }));

        const mappedMakeups = upcomingMakeups.map(h => ({
            maHopDong: h.maHopDong,
            tenKhachHang: h.khachHang1?.tenKhachHang,
            soDienThoai: h.khachHang1?.soDienThoai,
            ngayAnHoi: h.cacNgay?.ngayAnHoi,
            ngayCuoi: h.cacNgay?.ngayCuoi,
            thoMake: h.nguoiPhucVu?.thoMakeUp
        }));

        const mappedPickups = upcomingDressPickups.map(h => ({
            maHopDong: h.maHopDong,
            tenKhachHang: h.khachHang1?.tenKhachHang,
            soDienThoai: h.khachHang1?.soDienThoai,
            items: (h.trangPhucGiu || []).filter(i => i.trangThai === 'GIU_CHO' && new Date(i.ngayHenLay) <= t3End)
        }));

        const mappedOverdueDresses = overdueDressReturns.map(h => ({
            maHopDong: h.maHopDong,
            tenKhachHang: h.khachHang1?.tenKhachHang,
            soDienThoai: h.khachHang1?.soDienThoai,
            items: (h.trangPhucGiu || []).filter(i => i.trangThai === 'DANG_MUON' && new Date(i.ngayHenTra) < startOfToday)
        }));

        const mappedOverduePhotos = overduePostProductions.map(h => ({
            maHopDong: h.maHopDong,
            tenKhachHang: h.khachHang1?.tenKhachHang,
            soDienThoai: h.khachHang1?.soDienThoai,
            ngayTraAnh: h.cacNgay?.ngayTraAnh,
            subGiaiDoan: h.subGiaiDoan,
            thoChinhAnh: h.nguoiPhucVu?.thoChinhAnh
        }));

        const mappedCustomerApproved = customerApprovedAlbums.map(h => ({
            maHopDong: h.maHopDong,
            tenKhachHang: h.khachHang1?.tenKhachHang,
            soDienThoai: h.khachHang1?.soDienThoai,
            thoiGianXacNhan: h.khachHangXacNhanAnh?.thoiGianXacNhan,
            ghiChu: h.khachHangXacNhanAnh?.ghiChuKhachHang,
            soAnhChon: (h.hauKy?.danhSachMaAnhChon || []).length
        }));

        const totalCount =
            mappedShoots.length +
            mappedMakeups.length +
            mappedPickups.length +
            mappedOverdueDresses.length +
            mappedOverduePhotos.length +
            mappedCustomerApproved.length;

        return success(res, "Tải danh sách nhắc nhở và cảnh báo thành công", {
            totalCount,
            upcomingShoots: mappedShoots,
            upcomingMakeups: mappedMakeups,
            upcomingDressPickups: mappedPickups,
            overdueDressReturns: mappedOverdueDresses,
            overduePostProductions: mappedOverduePhotos,
            customerApprovedAlbums: mappedCustomerApproved
        });
    } catch (err) {
        return error(res, err.message);
    }
}



async function reconcilePaymentsEndpoint(req, res) {
    try {
        const { reconcilePayments } = require("./reconciliation.service");
        const dryRun = req.body?.dryRun !== false && req.body?.dryRun !== "false";
        const contractCode = req.body?.contractCode || req.query?.contractCode || null;

        const result = await reconcilePayments({
            dryRun,
            contractCode,
            req
        });

        return success(res, dryRun ? "Kiểm tra đối soát thành công (Dry-run)" : "Đồng bộ sổ cái thành công (Apply)", result);
    } catch (err) {
        return error(res, "Lỗi khi đối soát sổ cái: " + err.message);
    }
}

module.exports = {
    updatePostProduction,
    addAddonItem,
    updateWithAudit,
    getReminders,
    create,
    update,
    pay,
    remove,
    list,
    search,
    updateProgress,
    getCustomerContracts,
    customerApproveAlbum,
    reconcilePaymentsEndpoint,
    ensurePaymentProgress,
    completeContractProgressAndSchedules
};
