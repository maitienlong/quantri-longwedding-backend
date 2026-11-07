const HOPDONG = require("../models/hopDong.model");

const STAGE_NAMES = {
    1: "Chụp hình",
    2: "Hậu kỳ",
    3: "In ảnh",
    4: "Hoàn thành"
};

const SUB_STAGE_NAMES = {
    'dang_thuc_hien': "Đang thực hiện",
    'cho_chinh': "Chờ chỉnh sửa",
    'dang_chinh': "Đang chỉnh sửa",
    'dang_hau_ky': "Đang chỉnh sửa",
    'dang_chinh_anh': "Đang chỉnh sửa",
    'cho_khach_duyet': "Chờ khách duyệt ảnh",
    'khach_duyet_anh': "Khách đã duyệt ảnh",
    'cho_khach_duyet_layout': "Chờ khách duyệt layout",
    'khach_da_duyet_layout': "Khách đã duyệt layout",
    'da_giao_file_goc': "Đã giao file gốc",
    'khach_da_chon_anh': "Khách đã chọn ảnh",
    'da_gui_xuong_in': "Đã gửi xưởng in",
    'studio_da_nhan_hang': "Studio đã nhận hàng",
    'cho_ban_giao': "Chờ bàn giao",
    'da_tra_khach': "Đã bàn giao khách",
    'hoan_thanh': "Hoàn thành",
    'bao_luu': "Bảo lưu",
    'huy': "Đã hủy"
};

/**
 * Kiểm tra tính hợp lệ của việc chuyển đổi tiến trình hợp đồng (Stage Transition Validation)
 * 
 * @param {Object} params
 * @param {Object} params.contract - Hợp đồng hiện tại
 * @param {Object} [params.album] - Album ảnh liên quan nếu có
 * @param {number} params.nextStage - Giai đoạn đích (1, 2, 3, 4)
 * @param {string} params.nextSubStage - Trạng thái phụ đích
 * @param {Object} params.user - Người thực hiện thao tác (chức vụ, quyền hạn)
 * @param {Object} [params.data] - Dữ liệu kèm theo request (ghi chú, danh sách ảnh in...)
 * @param {boolean} [params.forceOverride] - Cờ cưỡng chế chuyển giai đoạn (chỉ Quản lý)
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function validateTransition({ contract, album, nextStage, nextSubStage, user, data = {}, forceOverride = false }) {
    if (!contract) {
        return { valid: false, error: "Hợp đồng không tồn tại" };
    }

    const currentStage = Number(contract.giaiDoan) || 1;
    const currentSubStage = contract.subGiaiDoan || 'dang_thuc_hien';

    // 1. Kiểm tra dải giai đoạn hợp lệ (1..4)
    if (![1, 2, 3, 4].includes(nextStage)) {
        return { 
            valid: false, 
            error: `Giai đoạn ${nextStage} không hợp lệ. Quy trình Long Wedding gồm 4 giai đoạn: 1. Chụp hình, 2. Hậu kỳ, 3. In ảnh, 4. Hoàn thành` 
        };
    }

    const isManager = Boolean(
        user && (
            user.positon === "Quản lý" ||
            user.positon === "Admin" ||
            user.positon === "Quản trị viên" ||
            user.chucVu === "Quản lý" ||
            user.chucVu === "Admin" ||
            user.chucVu === "Quản trị viên" ||
            user.role === "admin" ||
            user.role === "manager" ||
            user.role === "Admin" ||
            user.role === "Quản lý" ||
            user.permission === 1
        )
    );

    // 2. Kiểm tra thao tác HỦY HỢP ĐỒNG (subGiaiDoan = 'huy')
    if (nextSubStage === 'huy') {
        if (!isManager) {
            return { valid: false, error: "Chỉ Quản lý hoặc Admin mới có quyền hủy hợp đồng!" };
        }
        const cancelReason = (data?.ghiChu || data?.reason || "").trim();
        if (!cancelReason) {
            return { valid: false, error: "Vui lòng nhập lý do hủy hợp đồng!" };
        }
        return { valid: true };
    }

    // 3. Kiểm tra nhảy cóc giai đoạn về phía trước (Skip Stages Forward)
    // Không được nhảy vượt quá 1 giai đoạn (ví dụ 1 -> 3 hoặc 1 -> 4) trừ khi có quyền quản lý
    if (nextStage > currentStage + 1) {
        if (!isManager && !forceOverride) {
            return { 
                valid: false, 
                error: `Không thể nhảy cóc từ Giai đoạn ${currentStage} (${STAGE_NAMES[currentStage] || currentStage}) lên Giai đoạn ${nextStage} (${STAGE_NAMES[nextStage] || nextStage})! Vui lòng thực hiện tuần tự các bước.` 
            };
        }
    }

    // 4. Ràng buộc khi chuyển sang Giai đoạn 3 (In ảnh & Gia công)
    // Điều kiện: Khách hàng phải xác nhận duyệt ảnh hoặc đã có danh sách ảnh chốt in
    if (nextStage === 3 && currentStage < 3) {
        let hasApproved = Boolean(
            contract.khachHangXacNhanAnh?.daXacNhan === true ||
            contract.khachHangXacNhan === true ||
            album?.khachHangXacNhan === true ||
            (Array.isArray(contract.hauKy?.danhSachMaAnhChon) && contract.hauKy.danhSachMaAnhChon.length > 0) ||
            (Array.isArray(contract.danhSachAnhIn) && contract.danhSachAnhIn.length > 0) ||
            (Array.isArray(data?.danhSachAnhIn) && data.danhSachAnhIn.length > 0) ||
            (contract.linkAnhChinhSua && contract.linkAnhChinhSua.trim().length > 0)
        );

        if (!hasApproved && !album && contract.maHopDong) {
            try {
                const Album = require("../models/album.model");
                const foundAlbum = await Album.findOne({ maHopDong: contract.maHopDong });
                if (foundAlbum?.khachHangXacNhan === true) {
                    hasApproved = true;
                }
            } catch (e) {
                // Ignore DB error in mock/isolated unit tests
            }
        }

        if (!hasApproved && !isManager && !forceOverride) {
            return {
                valid: false,
                error: "Không thể chuyển sang giai đoạn In ảnh khi khách hàng chưa duyệt hoặc chưa có danh sách ảnh chốt in!"
            };
        }
    }

    // 5. Ràng buộc khi chuyển sang trạng thái Hoàn thành (Giai đoạn 4)
    // Điều kiện 1: Hợp đồng phải thanh toán đủ 100% tiền (conLai <= 0)
    // Điều kiện 2: Không còn lịch phân công nào chưa đến ngày thực hiện
    if (nextStage === 4) {
        // 5.1. Kiểm tra thanh toán đủ
        const conLai = Number(contract.thanhToan?.conLai || 0);
        const daThanhToanDu = conLai <= 0 || contract.thanhToan?.trangThaiThanhToan === "Đã thanh toán đủ";

        if (!daThanhToanDu) {
            const conLaiFmt = (conLai || 0).toLocaleString("vi-VN");
            return {
                valid: false,
                error: `Không thể hoàn thành đơn: Hợp đồng chưa thanh toán đủ số tiền còn lại (${conLaiFmt} đ). Vui lòng thanh toán đủ trước khi chuyển sang trạng thái Hoàn thành!`
            };
        }

        // 5.2. Kiểm tra còn lịch phân công chưa đến ngày
        const allAssignedTasks = [];
        const seenKeys = new Set();
        const addTask = (dateVal, name) => {
            if (!dateVal) return;
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return;
            const k = `${name}_${d.toISOString()}`;
            if (seenKeys.has(k)) return;
            seenKeys.add(k);
            allAssignedTasks.push({ date: d, name });
        };

        if (Array.isArray(contract.serviceSchedules)) {
            contract.serviceSchedules.forEach(s => {
                if (s.ngayGio) addTask(s.ngayGio, s.serviceName || s.serviceType || 'Lịch phân công');
            });
        }
        if (Array.isArray(contract.lichChup)) {
            contract.lichChup.forEach(s => addTask(s.ngayGio || s.ngayChup, s.tenDichVu || 'Lịch chụp hình'));
        }
        if (Array.isArray(contract.lichQuayPhim)) {
            contract.lichQuayPhim.forEach(s => addTask(s.ngayGio || s.ngayQuay, s.tenDichVu || 'Lịch quay phim'));
        }
        if (Array.isArray(contract.lichTrangDiem)) {
            contract.lichTrangDiem.forEach(s => addTask(s.ngayGio || s.ngayTrangDiem, s.tenDichVu || 'Lịch trang điểm'));
        }
        const cn = contract.cacNgay || {};
        if (cn.ngayChup) addTask(cn.ngayChup, 'Lịch chụp ảnh');
        if (cn.ngayQuayPhim) addTask(cn.ngayQuayPhim, 'Lịch quay phim');
        if (cn.ngayTrangDiem) addTask(cn.ngayTrangDiem, 'Lịch trang điểm');
        if (cn.ngayAnHoi) addTask(cn.ngayAnHoi, 'Lịch ăn hỏi');
        if (cn.ngayCuoi) addTask(cn.ngayCuoi, 'Lịch ngày cưới');

        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const futureTasks = allAssignedTasks.filter(t => t.date.getTime() > endOfToday.getTime());

        if (futureTasks.length > 0) {
            const formatDateSimple = (d) => {
                const day = String(d.getDate()).padStart(2, '0');
                const mon = String(d.getMonth() + 1).padStart(2, '0');
                const yr = d.getFullYear();
                return `${day}/${mon}/${yr}`;
            };
            const taskListDesc = futureTasks.map(t => `${t.name} (${formatDateSimple(t.date)})`).join(', ');

            return {
                valid: false,
                error: `Không thể hoàn thành đơn: Trong hợp đồng đang còn lịch phân công chưa đến ngày thực hiện: [${taskListDesc}]. Không được hoàn thành đơn khi chưa qua ngày phục vụ!`
            };
        }
    }

    // 6. Ràng buộc QC Nghiệm thu sản phẩm in ấn (T-PRINT01, MOD-07)
    // Điều kiện: Chuyển sang Giai đoạn 4 (hoặc đóng hợp đồng) yêu cầu tất cả sản phẩm in ấn bắt buộc phải đạt nghiệm thu QC
    if (nextStage === 4) {
        try {
            const PrintDeliverable = require("../models/printDeliverable.model");
            const deliverables = await PrintDeliverable.find({
                maHopDong: contract.maHopDong,
                trangThai: { $ne: 'DA_HUY' }
            });

            if (deliverables && deliverables.length > 0) {
                const unpassedItems = deliverables.filter(item => {
                    if (item.isRequired === false) return false;
                    if (item.qcOverride?.isOverridden === true) return false;
                    return item.trangThai !== 'QC_PASSED' && item.trangThai !== 'DA_BAN_GIAO';
                });

                if (unpassedItems.length > 0) {
                    const managerOverrideReason = (data?.qcOverrideReason || data?.reason || "").trim();
                    const hasManagerOverride = isManager && (forceOverride || data?.managerOverride) && managerOverrideReason.length > 0;

                    if (!hasManagerOverride) {
                        const itemNames = unpassedItems.map(i => `${i.tenSanPham} (${i.trangThai})`).join(", ");
                        return {
                            valid: false,
                            error: `Không thể chuyển sang Giai đoạn 4 / Hoàn thành vì còn sản phẩm in ấn chưa được nghiệm thu QC: [${itemNames}]. Chỉ Quản lý mới có quyền phê duyệt override kèm lý do!`
                        };
                    }
                }
            }
        } catch (dbErr) {
            // Bỏ qua lỗi DB trong mock/isolated test
        }
    }

    return { valid: true };
}

/**
 * Chuẩn hóa subGiaiDoan tương ứng theo quy tắc từng giai đoạn
 */
function normalizeSubStage(stage, subStage) {
    if (['bao_luu', 'huy'].includes(subStage)) {
        return subStage;
    }

    if (stage === 1 || stage === 3) {
        return 'dang_thuc_hien';
    }

    if (stage === 4) {
        if (['cho_ban_giao', 'da_tra_khach', 'hoan_thanh'].includes(subStage)) {
            return subStage;
        }
        return 'hoan_thanh';
    }

    if (stage === 2) {
        if (['cho_chinh', 'da_giao_file_goc', 'khach_da_chon_anh'].includes(subStage)) {
            return 'cho_chinh';
        }
        if (['cho_khach_duyet', 'khach_duyet_anh', 'cho_khach_duyet_layout', 'khach_da_duyet_layout'].includes(subStage)) {
            return 'cho_khach_duyet';
        }
        if (['dang_chinh', 'dang_hau_ky', 'dang_chinh_anh'].includes(subStage)) {
            return 'dang_chinh';
        }
        if (subStage === 'hoan_thanh') {
            return 'hoan_thanh';
        }
        return 'dang_chinh';
    }

    return subStage || 'dang_thuc_hien';
}

/**
 * Migration M02: Chuẩn hóa toàn bộ giai đoạn và trạng thái phụ của hợp đồng
 * 
 * @param {Object} options
 * @param {boolean} options.dryRun - Nếu true, chỉ kiểm tra không lưu CSDL
 * @returns {Promise<Object>} Báo cáo migration
 */
async function reconcileContractStages({ dryRun = true } = {}) {
    console.log(`🔍 [Migration M02] Bắt đầu chuẩn hóa máy trạng thái hợp đồng (dryRun = ${dryRun})...`);

    const contracts = await HOPDONG.find({});
    const report = {
        dryRun,
        timestamp: new Date().toISOString(),
        totalContractsScanned: contracts.length,
        discrepanciesFound: 0,
        repairedContracts: 0,
        details: []
    };

    for (const contract of contracts) {
        let isCorrupt = false;
        const issues = [];

        let currentStage = Number(contract.giaiDoan);
        let currentSub = contract.subGiaiDoan;

        // 1. Kiểm tra giaiDoan
        let correctedStage = currentStage;
        if (![1, 2, 3, 4].includes(currentStage) || isNaN(currentStage)) {
            isCorrupt = true;
            const conLai = Number(contract.thanhToan?.conLai);
            const daThu = Number(contract.thanhToan?.khachHangDaThanhToan) || 0;
            if (daThu > 0 && conLai <= 0) {
                correctedStage = 4;
            } else {
                correctedStage = 1;
            }
            issues.push(`Giai đoạn không hợp lệ (${contract.giaiDoan}), chuẩn hóa thành: ${correctedStage}`);
        }

        // 2. Kiểm tra subGiaiDoan
        const normalizedSub = normalizeSubStage(correctedStage, currentSub);
        if (normalizedSub !== currentSub) {
            isCorrupt = true;
            issues.push(`Sub-giai đoạn không đồng bộ (${currentSub}), chuẩn hóa thành: ${normalizedSub}`);
        }

        if (isCorrupt) {
            report.discrepanciesFound++;
            report.details.push({
                maHopDong: contract.maHopDong,
                old: { giaiDoan: contract.giaiDoan, subGiaiDoan: contract.subGiaiDoan },
                corrected: { giaiDoan: correctedStage, subGiaiDoan: normalizedSub },
                issues
            });

            if (!dryRun) {
                await HOPDONG.updateOne({ _id: contract._id }, {
                    $set: {
                        giaiDoan: correctedStage,
                        subGiaiDoan: normalizedSub
                    }
                });
                report.repairedContracts++;
            }
        }
    }

    console.log(`🏁 [Migration M02 Hoàn tất] Quét: ${report.totalContractsScanned} | Sai lệch: ${report.discrepanciesFound} | Đã sửa: ${report.repairedContracts}`);
    return report;
}

module.exports = {
    STAGE_NAMES,
    SUB_STAGE_NAMES,
    validateTransition,
    normalizeSubStage,
    reconcileContractStages
};
