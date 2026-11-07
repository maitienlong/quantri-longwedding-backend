const PrintDeliverable = require("../models/printDeliverable.model");
const HOPDONG = require("../models/hopDong.model");
const NotificationOutbox = require("../models/notificationOutbox.model");
const { success, error } = require("../utils/response");

/**
 * Kiểm tra xem người dùng có quyền Quản lý / Admin không
 */
function isManagerUser(user) {
    if (!user) return false;
    const pos = (user.positon || user.chucVu || user.role || "").toLowerCase();
    return pos.includes("quản lý") || pos.includes("manager") || pos.includes("admin") || pos.includes("quản trị") || user.permission === 1;
}

/**
 * Lấy danh sách sản phẩm in ấn / bàn giao
 */
const listDeliverables = async (req, res) => {
    try {
        const { maHopDong, hopDongId, trangThai, phanLoai, tenXuongIn, qcStatus, page = 1, limit = 50 } = req.query;
        const query = {};

        if (maHopDong) {
            query.maHopDong = { $regex: new RegExp(maHopDong.trim(), 'i') };
        }
        if (hopDongId) {
            query.hopDongId = hopDongId;
        }
        if (trangThai) {
            query.trangThai = trangThai;
        }
        if (phanLoai) {
            query.phanLoai = phanLoai;
        }
        if (tenXuongIn) {
            query['thongTinXuongIn.tenXuongIn'] = { $regex: new RegExp(tenXuongIn.trim(), 'i') };
        }
        if (qcStatus) {
            query['kiemTraQC.ketQua'] = qcStatus;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [items, total] = await Promise.all([
            PrintDeliverable.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            PrintDeliverable.countDocuments(query)
        ]);

        return success(res, "Lấy danh sách sản phẩm in ấn thành công", {
            items,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err) {
        console.error("Lỗi listDeliverables:", err);
        return error(res, "Lỗi máy chủ khi lấy danh sách sản phẩm in ấn: " + err.message, 500);
    }
};

/**
 * Lấy chi tiết một sản phẩm in ấn
 */
const getDeliverableDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await PrintDeliverable.findOne({
            $or: [
                { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
                { code: id }
            ]
        });

        if (!item) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        return success(res, "Lấy thông tin sản phẩm in ấn thành công", item);
    } catch (err) {
        console.error("Lỗi getDeliverableDetail:", err);
        return error(res, "Lỗi máy chủ khi lấy thông tin sản phẩm in ấn: " + err.message, 500);
    }
};

/**
 * Tạo mới một sản phẩm in ấn độc lập
 */
const createDeliverable = async (req, res) => {
    try {
        const {
            maHopDong,
            tenSanPham,
            phanLoai,
            kichThuoc,
            widthCm,
            heightCm,
            chatLieu,
            soLuong = 1,
            danhSachFileIn,
            isRequired = true,
            thongTinXuongIn,
            ghiChu
        } = req.body || {};

        if (!maHopDong || !tenSanPham) {
            return error(res, "Vui lòng nhập mã hợp đồng và tên sản phẩm", 400);
        }

        const contract = await HOPDONG.findOne({
            maHopDong: { $regex: new RegExp(`^${maHopDong.trim()}$`, 'i') }
        });

        const count = await PrintDeliverable.countDocuments({ maHopDong: contract?.maHopDong || maHopDong });
        const code = `PRN-${(contract?.maHopDong || maHopDong).toUpperCase()}-${String(count + 1).padStart(2, '0')}`;
        const actor = req.user?.fullname || req.user?.username || "Nhân viên Studio";

        const deliverable = new PrintDeliverable({
            code,
            hopDongId: contract?._id,
            maHopDong: contract?.maHopDong || maHopDong.toUpperCase(),
            khachHangId: contract?.khachHang1,
            tenKhachHang: contract?.khachHang1Snapshot?.hoTen || "",
            soDienThoai: contract?.khachHang1Snapshot?.soDienThoai || "",
            tenSanPham: tenSanPham.trim(),
            phanLoai: phanLoai || 'KHAC',
            kichThuoc: kichThuoc || "",
            widthCm: Number(widthCm) || 0,
            heightCm: Number(heightCm) || 0,
            chatLieu: chatLieu || "",
            soLuong: Number(soLuong) || 1,
            danhSachFileIn: Array.isArray(danhSachFileIn) ? danhSachFileIn : [],
            isRequired: Boolean(isRequired),
            trangThai: 'CHUA_GUI_IN',
            thongTinXuongIn: thongTinXuongIn || {},
            auditLog: [{
                action: 'CREATED',
                performedBy: actor,
                timestamp: new Date(),
                details: { tenSanPham, kichThuoc, soLuong, ghiChu }
            }]
        });

        await deliverable.save();

        return success(res, "Tạo đơn sản phẩm in ấn thành công", deliverable, 201);
    } catch (err) {
        console.error("Lỗi createDeliverable:", err);
        return error(res, "Lỗi máy chủ khi tạo sản phẩm in ấn: " + err.message, 500);
    }
};

/**
 * Cập nhật thông tin thông số kỹ thuật sản phẩm
 */
const updateDeliverable = async (req, res) => {
    try {
        const { id } = req.params;
        const deliverable = await PrintDeliverable.findById(id);
        if (!deliverable) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        const allowedUpdates = [
            'tenSanPham', 'phanLoai', 'kichThuoc', 'widthCm', 'heightCm',
            'chatLieu', 'soLuong', 'danhSachFileIn', 'isRequired'
        ];

        const changes = {};
        allowedUpdates.forEach(key => {
            if (req.body[key] !== undefined) {
                deliverable[key] = req.body[key];
                changes[key] = req.body[key];
            }
        });

        deliverable.auditLog.push({
            action: 'UPDATED',
            performedBy: req.user?.fullname || "Nhân viên Studio",
            timestamp: new Date(),
            details: changes
        });

        await deliverable.save();
        return success(res, "Cập nhật sản phẩm in ấn thành công", deliverable);
    } catch (err) {
        console.error("Lỗi updateDeliverable:", err);
        return error(res, "Lỗi máy chủ khi cập nhật sản phẩm: " + err.message, 500);
    }
};

/**
 * Gửi sản phẩm đến xưởng in gia công (Factory Dispatch)
 */
const sendToFactory = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tenXuongIn,
            soDienThoai,
            diaChi,
            ngayGuiIn,
            ngayHenTra,
            chiPhiIn,
            maVanDon,
            ghiChuXuong
        } = req.body || {};

        const deliverable = await PrintDeliverable.findById(id);
        if (!deliverable) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        const actor = req.user?.fullname || req.user?.username || "Nhân viên Hậu kỳ";

        deliverable.trangThai = 'DA_GUI_XUONG';
        deliverable.thongTinXuongIn = {
            tenXuongIn: tenXuongIn || deliverable.thongTinXuongIn.tenXuongIn,
            soDienThoai: soDienThoai || deliverable.thongTinXuongIn.soDienThoai,
            diaChi: diaChi || deliverable.thongTinXuongIn.diaChi,
            ngayGuiIn: ngayGuiIn ? new Date(ngayGuiIn) : new Date(),
            ngayHenTra: ngayHenTra ? new Date(ngayHenTra) : deliverable.thongTinXuongIn.ngayHenTra,
            chiPhiIn: chiPhiIn !== undefined ? Number(chiPhiIn) : deliverable.thongTinXuongIn.chiPhiIn,
            maVanDon: maVanDon || deliverable.thongTinXuongIn.maVanDon,
            ghiChuXuong: ghiChuXuong || deliverable.thongTinXuongIn.ghiChuXuong
        };

        deliverable.auditLog.push({
            action: 'SENT_TO_FACTORY',
            performedBy: actor,
            timestamp: new Date(),
            details: {
                tenXuongIn: deliverable.thongTinXuongIn.tenXuongIn,
                ngayGuiIn: deliverable.thongTinXuongIn.ngayGuiIn,
                ngayHenTra: deliverable.thongTinXuongIn.ngayHenTra,
                chiPhiIn: deliverable.thongTinXuongIn.chiPhiIn
            }
        });

        await deliverable.save();

        // Đồng bộ ngược vào hopDong.hauKy.thongTinInAn
        if (deliverable.maHopDong) {
            await HOPDONG.updateOne(
                { maHopDong: deliverable.maHopDong },
                {
                    $set: {
                        'hauKy.thongTinInAn.tenXuongIn': deliverable.thongTinXuongIn.tenXuongIn,
                        'hauKy.thongTinInAn.ngayGuiIn': deliverable.thongTinXuongIn.ngayGuiIn,
                        'hauKy.thongTinInAn.ngayHenNhan': deliverable.thongTinXuongIn.ngayHenTra,
                        'hauKy.thongTinInAn.chiPhiIn': deliverable.thongTinXuongIn.chiPhiIn
                    }
                }
            );
        }

        return success(res, "Đã cập nhật trạng thái gửi xưởng in thành công", deliverable);
    } catch (err) {
        console.error("Lỗi sendToFactory:", err);
        return error(res, "Lỗi máy chủ khi gửi xưởng in: " + err.message, 500);
    }
};

/**
 * Studio tiếp nhận sản phẩm từ xưởng in về
 */
const receiveFromFactory = async (req, res) => {
    try {
        const { id } = req.params;
        const { ngayNhanThucTe, ghiChu } = req.body || {};

        const deliverable = await PrintDeliverable.findById(id);
        if (!deliverable) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        const actor = req.user?.fullname || req.user?.username || "Nhân viên Hậu kỳ";

        deliverable.trangThai = 'XUONG_DA_GIAO';
        deliverable.thongTinXuongIn.ngayNhanThucTe = ngayNhanThucTe ? new Date(ngayNhanThucTe) : new Date();

        deliverable.auditLog.push({
            action: 'RECEIVED_FROM_FACTORY',
            performedBy: actor,
            timestamp: new Date(),
            details: { ngayNhanThucTe: deliverable.thongTinXuongIn.ngayNhanThucTe, ghiChu }
        });

        await deliverable.save();

        // Đồng bộ ngày nhận vào hợp đồng
        if (deliverable.maHopDong) {
            await HOPDONG.updateOne(
                { maHopDong: deliverable.maHopDong },
                {
                    $set: {
                        'hauKy.thongTinInAn.ngayNhanThucTe': deliverable.thongTinXuongIn.ngayNhanThucTe
                    }
                }
            );
        }

        return success(res, "Studio đã nhận hàng từ xưởng in, chuyển sang chờ nghiệm thu QC", deliverable);
    } catch (err) {
        console.error("Lỗi receiveFromFactory:", err);
        return error(res, "Lỗi máy chủ khi tiếp nhận hàng từ xưởng in: " + err.message, 500);
    }
};

/**
 * Nghiệm thu chất lượng sản phẩm (QC Inspection Gate)
 */
const inspectQC = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            ketQua, // 'PASSED' | 'FAILED'
            tieuChi, // { dungKichThuoc, dungMauSac, khongTrayXuocRach, dungSoLuongTrang }
            ghiChuLoi,
            hinhAnhLoi,
            yeuCauInLai = false
        } = req.body || {};

        if (!['PASSED', 'FAILED'].includes(ketQua)) {
            return error(res, "Kết quả kiểm định QC phải là 'PASSED' hoặc 'FAILED'", 400);
        }

        const deliverable = await PrintDeliverable.findById(id);
        if (!deliverable) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        const actor = req.user?.fullname || req.user?.username || "Nhân viên QC";
        const isPassed = ketQua === 'PASSED';

        deliverable.trangThai = isPassed ? 'QC_PASSED' : 'QC_FAILED';
        deliverable.kiemTraQC = {
            nguoiKiemTra: actor,
            thoiGianKiemTra: new Date(),
            ketQua,
            tieuChi: {
                dungKichThuoc: tieuChi?.dungKichThuoc !== undefined ? Boolean(tieuChi.dungKichThuoc) : true,
                dungMauSac: tieuChi?.dungMauSac !== undefined ? Boolean(tieuChi.dungMauSac) : true,
                khongTrayXuocRach: tieuChi?.khongTrayXuocRach !== undefined ? Boolean(tieuChi.khongTrayXuocRach) : true,
                dungSoLuongTrang: tieuChi?.dungSoLuongTrang !== undefined ? Boolean(tieuChi.dungSoLuongTrang) : true
            },
            ghiChuLoi: isPassed ? "" : (ghiChuLoi || "Phát hiện lỗi kỹ thuật gia công"),
            hinhAnhLoi: Array.isArray(hinhAnhLoi) ? hinhAnhLoi : [],
            yeuCauInLai: Boolean(yeuCauInLai),
            soLanInLai: yeuCauInLai ? (deliverable.kiemTraQC?.soLanInLai || 0) + 1 : (deliverable.kiemTraQC?.soLanInLai || 0)
        };

        deliverable.auditLog.push({
            action: 'QC_INSPECTED',
            performedBy: actor,
            timestamp: new Date(),
            details: {
                ketQua,
                ghiChuLoi: deliverable.kiemTraQC.ghiChuLoi,
                yeuCauInLai: deliverable.kiemTraQC.yeuCauInLai
            }
        });

        await deliverable.save();

        // Kích hoạt thông báo Outbox nếu QC Failed cần in lại
        if (!isPassed && deliverable.kiemTraQC.yeuCauInLai) {
            try {
                await NotificationOutbox.create({
                    maHopDong: deliverable.maHopDong,
                    eventType: 'DELIVERABLE_QC_FAILED',
                    recipientType: 'STAFF',
                    recipientGroup: 'Photoshop & In Ấn',
                    payload: {
                        deliverableCode: deliverable.code,
                        tenSanPham: deliverable.tenSanPham,
                        maHopDong: deliverable.maHopDong,
                        ghiChuLoi: deliverable.kiemTraQC.ghiChuLoi,
                        soLanInLai: deliverable.kiemTraQC.soLanInLai
                    },
                    idempotencyKey: `QC_FAILED_${deliverable.code}_run${deliverable.kiemTraQC.soLanInLai}`
                });
            } catch (notifErr) {
                console.warn("[QC Outbox Warning]:", notifErr.message);
            }
        }

        const msg = isPassed
            ? "Nghiệm thu QC đạt chuẩn chất lượng thành công! Sẵn sàng bàn giao khách hàng."
            : "Đã ghi nhận sản phẩm QC không đạt chuẩn. Yêu cầu xử lý chỉnh sửa hoặc in lại.";

        return success(res, msg, deliverable);
    } catch (err) {
        console.error("Lỗi inspectQC:", err);
        return error(res, "Lỗi máy chủ khi kiểm tra QC: " + err.message, 500);
    }
};

/**
 * Quản lý phê duyệt Override cho sản phẩm in ấn (T-PRINT01)
 */
const overrideQC = async (req, res) => {
    try {
        const { id } = req.params;
        const { overrideReason } = req.body || {};

        if (!isManagerUser(req.user)) {
            return error(res, "Chỉ Quản lý hoặc Quản trị viên mới có quyền phê duyệt Override QC sản phẩm!", 403);
        }

        if (!overrideReason || !overrideReason.trim()) {
            return error(res, "Vui lòng nhập lý do Quản lý phê duyệt override QC bắt buộc!", 400);
        }

        const deliverable = await PrintDeliverable.findById(id);
        if (!deliverable) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        const actor = req.user?.fullname || req.user?.username || "Quản lý Studio";

        deliverable.qcOverride = {
            isOverridden: true,
            overrideReason: overrideReason.trim(),
            approvedBy: actor,
            approvedAt: new Date()
        };

        deliverable.auditLog.push({
            action: 'QC_OVERRIDDEN',
            performedBy: actor,
            timestamp: new Date(),
            details: { overrideReason: overrideReason.trim() }
        });

        await deliverable.save();

        return success(res, "Quản lý đã phê duyệt override QC thành công", deliverable);
    } catch (err) {
        console.error("Lỗi overrideQC:", err);
        return error(res, "Lỗi máy chủ khi override QC: " + err.message, 500);
    }
};

/**
 * Bàn giao sản phẩm in ấn cho khách hàng (Client Handover)
 */
const handoverToClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { nguoiNhan, ghiChu, chuKyKhachHang } = req.body || {};

        const deliverable = await PrintDeliverable.findById(id);
        if (!deliverable) {
            return error(res, "Không tìm thấy sản phẩm in ấn", 404);
        }

        // Kiểm tra điều kiện: Sản phẩm phải đạt QC hoặc có Manager Override trước khi bàn giao
        const isReady = deliverable.trangThai === 'QC_PASSED' || deliverable.qcOverride?.isOverridden === true;
        if (!isReady && !isManagerUser(req.user)) {
            return error(res, "Sản phẩm chưa đạt nghiệm thu QC và chưa có phê duyệt Quản lý override, không thể bàn giao!", 409);
        }

        const actor = req.user?.fullname || req.user?.username || "Nhân viên Bàn giao";

        deliverable.trangThai = 'DA_BAN_GIAO';
        deliverable.banGiaoKhach = {
            ngayBanGiao: new Date(),
            nguoiBanGiao: actor,
            nguoiNhan: nguoiNhan || deliverable.tenKhachHang || "Khách hàng",
            ghiChu: ghiChu || ""
        };

        deliverable.auditLog.push({
            action: 'DELIVERED',
            performedBy: actor,
            timestamp: new Date(),
            details: {
                ngayBanGiao: deliverable.banGiaoKhach.ngayBanGiao,
                nguoiNhan: deliverable.banGiaoKhach.nguoiNhan,
                ghiChu
            }
        });

        await deliverable.save();

        return success(res, "Đã ghi nhận bàn giao sản phẩm cho khách hàng thành công", deliverable);
    } catch (err) {
        console.error("Lỗi handoverToClient:", err);
        return error(res, "Lỗi máy chủ khi bàn giao sản phẩm: " + err.message, 500);
    }
};

/**
 * Tự động trích xuất danh sách sản phẩm in ấn từ gói dịch vụ / giỏ hàng hợp đồng (Idempotent Sync)
 */
const syncDeliverablesFromContract = async (req, res) => {
    try {
        const { contractId } = req.params;
        const contract = await HOPDONG.findOne({
            $or: [
                { _id: contractId.match(/^[0-9a-fA-F]{24}$/) ? contractId : null },
                { maHopDong: { $regex: new RegExp(`^${contractId.trim()}$`, 'i') } }
            ]
        });

        if (!contract) {
            return error(res, "Không tìm thấy hợp đồng", 404);
        }

        const syncedItems = await autoSyncContractDeliverables(contract, req.user?.fullname || "Hệ thống");

        return success(res, `Đã đồng bộ ${syncedItems.length} sản phẩm in ấn từ hợp đồng`, {
            maHopDong: contract.maHopDong,
            deliverablesCount: syncedItems.length,
            items: syncedItems
        });
    } catch (err) {
        console.error("Lỗi syncDeliverablesFromContract:", err);
        return error(res, "Lỗi máy chủ khi đồng bộ sản phẩm in ấn: " + err.message, 500);
    }
};

/**
 * Trình hỗ trợ trích xuất tự động sản phẩm in ấn từ gói hợp đồng
 */
async function autoSyncContractDeliverables(contract, actor = "Hệ thống") {
    if (!contract || !contract.maHopDong) return [];

    const existing = await PrintDeliverable.find({ maHopDong: contract.maHopDong });
    const existingNames = new Set(existing.map(i => `${i.tenSanPham.toLowerCase()}_${i.kichThuoc.toLowerCase()}`));

    const createdItems = [];
    let count = existing.length;

    // 1. Trích xuất từ packageSnapshot hoặc gioHang
    const deliverablesList = [];

    // Từ gioHang package details
    if (Array.isArray(contract.gioHang)) {
        contract.gioHang.forEach(item => {
            if (item.details?.deliverables && Array.isArray(item.details.deliverables)) {
                item.details.deliverables.forEach(d => deliverablesList.push(d));
            }
        });
    }

    // Từ packageSnapshot
    if (contract.packageSnapshot?.details?.deliverables && Array.isArray(contract.packageSnapshot.details.deliverables)) {
        contract.packageSnapshot.details.deliverables.forEach(d => deliverablesList.push(d));
    }

    // Fallback: từ các trường số lượng ảnh cũ nếu chưa có deliverables
    if (deliverablesList.length === 0) {
        if (contract.hauKy?.thongTinInAn?.tenXuongIn || contract.giaiDoan >= 3) {
            deliverablesList.push({
                name: "Ảnh phóng cổng lớn",
                widthCm: 60,
                heightCm: 90,
                quantity: 1,
                kind: "ANH_PHONG_CONG",
                material: "Tráng gương"
            });
            deliverablesList.push({
                name: "Album Photobook cưới",
                widthCm: 30,
                heightCm: 30,
                quantity: 1,
                kind: "ALBUM_PHOTOBOOK",
                material: "Bìa da"
            });
        }
    }

    for (const d of deliverablesList) {
        const name = d.name || d.tenSanPham || "Sản phẩm in";
        const sizeStr = d.kichThuoc || (d.widthCm && d.heightCm ? `${d.widthCm}x${d.heightCm}` : "");
        const key = `${name.toLowerCase()}_${sizeStr.toLowerCase()}`;

        if (!existingNames.has(key)) {
            count++;
            const code = `PRN-${contract.maHopDong.toUpperCase()}-${String(count).padStart(2, '0')}`;
            const item = new PrintDeliverable({
                code,
                hopDongId: contract._id,
                maHopDong: contract.maHopDong.toUpperCase(),
                khachHangId: contract.khachHang1,
                tenKhachHang: contract.khachHang1Snapshot?.hoTen || "",
                soDienThoai: contract.khachHang1Snapshot?.soDienThoai || "",
                tenSanPham: name,
                phanLoai: d.kind || 'KHAC',
                kichThuoc: sizeStr,
                widthCm: Number(d.widthCm) || 0,
                heightCm: Number(d.heightCm) || 0,
                chatLieu: d.material || "",
                soLuong: Number(d.quantity) || 1,
                isRequired: true,
                trangThai: contract.giaiDoan === 4 ? 'QC_PASSED' : 'CHUA_GUI_IN',
                auditLog: [{
                    action: 'SYNCED_FROM_CONTRACT',
                    performedBy: actor,
                    timestamp: new Date(),
                    details: { source: 'PackageDeliverables' }
                }]
            });
            await item.save();
            existingNames.add(key);
            createdItems.push(item);
        }
    }

    return [...existing, ...createdItems];
}

/**
 * Kiểm tra cổng nghiệm thu QC cho hợp đồng (T-PRINT01 Check)
 * 
 * @param {Object} contract - Hợp đồng cần kiểm tra
 * @returns {Promise<{ canClose: boolean, unpassedItems: Array, totalItems: number }>}
 */
async function checkContractQCGate(contract) {
    if (!contract || !contract.maHopDong) {
        return { canClose: true, unpassedItems: [], totalItems: 0 };
    }

    const items = await PrintDeliverable.find({
        maHopDong: contract.maHopDong,
        trangThai: { $ne: 'DA_HUY' }
    });

    if (!items || items.length === 0) {
        return { canClose: true, unpassedItems: [], totalItems: 0 };
    }

    const unpassedItems = items.filter(item => {
        if (item.isRequired === false) return false;
        if (item.qcOverride?.isOverridden === true) return false;
        return item.trangThai !== 'QC_PASSED' && item.trangThai !== 'DA_BAN_GIAO';
    });

    return {
        canClose: unpassedItems.length === 0,
        unpassedItems,
        totalItems: items.length
    };
}

module.exports = {
    listDeliverables,
    getDeliverableDetail,
    createDeliverable,
    updateDeliverable,
    sendToFactory,
    receiveFromFactory,
    inspectQC,
    overrideQC,
    handoverToClient,
    syncDeliverablesFromContract,
    autoSyncContractDeliverables,
    checkContractQCGate
};

