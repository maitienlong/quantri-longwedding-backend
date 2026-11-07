/**
 * contractPricing.js
 * Unified Pricing Engine & Package Snapshotting for Long Wedding v2.0
 * 
 * Implements:
 * - Single Source of Truth for price, discount, voucher, and debt calculation.
 * - Non-destructive snapshotting of PackageVersion and DeliverablesSpec.
 * - Migration M03 reconciliation logic.
 */

/**
 * Tính toán toàn bộ thông số giá trị, giảm giá, voucher và số dư của hợp đồng
 * 
 * @param {Object} contractOrPayload - Đối tượng hợp đồng hoặc payload
 * @returns {Object} Kết quả tính toán chuẩn xác
 */
function calculateContractPricing(contractOrPayload) {
    if (!contractOrPayload) return null;
    const doc = typeof contractOrPayload.toObject === 'function' ? contractOrPayload.toObject() : contractOrPayload;
    const tt = doc.thanhToan || {};

    // 1. Tính tổng từ giỏ hàng (Cart Items)
    let tongCart = 0;
    if (Array.isArray(doc.gioHang) && doc.gioHang.length > 0) {
        tongCart = doc.gioHang.reduce((sum, item) => {
            const donGia = parseFloat(
                item.donGia?.toString().replace(/[^0-9.-]+/g, "") ||
                item.giaChoThueDichVu?.toString().replace(/[^0-9.-]+/g, "") ||
                0
            );
            const soLuong = Math.max(1, Number(item.soLuong) || 1);
            const giamGiaDichVu = Math.max(0, Number(item.giamGiaDichVu) || 0);
            const thanhTien = Math.max(0, (donGia * soLuong) - giamGiaDichVu);
            return sum + thanhTien;
        }, 0);
    }

    // 2. Tính tổng phụ lục phát sinh (Add-on / Upsell sau ký)
    let tongPhatSinh = 0;
    if (Array.isArray(doc.phuLucPhatSinh) && doc.phuLucPhatSinh.length > 0) {
        tongPhatSinh = doc.phuLucPhatSinh.reduce((sum, addon) => {
            const sl = Number(addon.soLuong) || 1;
            const dg = Number(addon.donGia) || 0;
            const thanhTien = Math.max(0, sl * dg);
            return sum + thanhTien;
        }, 0);
    } else if (Number(tt.tongPhatSinh) > 0) {
        tongPhatSinh = Number(tt.tongPhatSinh);
    }

    // 3. Tổng giá trị gốc trước chiết khấu của hợp đồng
    let tongGoc = tongCart + tongPhatSinh;
    if (tongGoc === 0 && (!doc.gioHang || doc.gioHang.length === 0) && Number(tt.tongGiaTri) > 0) {
        tongGoc = Number(tt.tongGiaTri);
    }

    // 4. Chiết khấu hợp đồng (Theo % hoặc số tiền cố định VND)
    const giamGiaValue = Math.max(0, Number(tt.giamGia) || 0);
    const loaiGiamGia = Number(tt.loaiGiamGia) || 0; // 0: VND, 1: %
    let soTienGiamHopDong = 0;
    if (loaiGiamGia === 1) {
        soTienGiamHopDong = Math.round((tongGoc * giamGiaValue) / 100);
    } else {
        soTienGiamHopDong = giamGiaValue;
    }

    // 5. Giảm giá từ Voucher
    const voucherGiamGia = Math.max(0, Number(tt.voucherGiamGia) || 0);

    // 6. Tổng số tiền được giảm
    const tongGiamGia = soTienGiamHopDong + voucherGiamGia;

    // 7. Tổng giá trị hợp đồng sau giảm
    const tongGiaTriSauGiam = Math.max(0, Math.round(tongGoc - tongGiamGia));

    // 8. Số tiền khách hàng đã thanh toán
    const cacLuot = Array.isArray(tt.cacLuotThanhToan) ? tt.cacLuotThanhToan : [];
    const khachHangDaThanhToan = cacLuot.length > 0
        ? cacLuot.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        : Math.max(0, Number(tt.khachHangDaThanhToan) || 0);

    // 9. Số tiền còn lại
    const conLai = Math.max(0, Math.round(tongGiaTriSauGiam - khachHangDaThanhToan));

    // 10. Phần trăm thanh toán (%)
    let phanTramDaThanhToan = 0;
    if (tongGiaTriSauGiam > 0) {
        phanTramDaThanhToan = Math.min(100, Math.max(0, Math.round((khachHangDaThanhToan / tongGiaTriSauGiam) * 100 * 10) / 10));
    } else {
        phanTramDaThanhToan = khachHangDaThanhToan > 0 ? 100 : 0;
    }

    // 11. Trạng thái thanh toán
    let trangThaiThanhToan = "Chưa thanh toán";
    if (conLai <= 0 && (khachHangDaThanhToan > 0 || tongGiaTriSauGiam === 0)) {
        trangThaiThanhToan = "Đã thanh toán đủ";
    } else if (khachHangDaThanhToan > 0) {
        trangThaiThanhToan = "Đang thanh toán";
    }

    return {
        tongCart,
        tongPhatSinh,
        tongGiaTri: tongGoc,
        soTienGiamHopDong,
        voucherGiamGia,
        tongGiamGia,
        tongGiaTriSauGiam,
        khachHangDaThanhToan,
        conLai,
        phanTramDaThanhToan,
        trangThaiThanhToan
    };
}

/**
 * Cập nhật trực tiếp đối tượng thanhToan của hợp đồng
 */
function applyPricingToContract(contract) {
    if (!contract) return contract;
    const calc = calculateContractPricing(contract);
    if (!calc) return contract;

    if (!contract.thanhToan) contract.thanhToan = {};
    contract.thanhToan.tongGiaTri = calc.tongGiaTri;
    contract.thanhToan.tongPhatSinh = calc.tongPhatSinh;
    contract.thanhToan.tongGiaTriSauGiam = calc.tongGiaTriSauGiam;
    contract.thanhToan.khachHangDaThanhToan = calc.khachHangDaThanhToan;
    contract.thanhToan.conLai = calc.conLai;
    contract.thanhToan.phanTramDaThanhToan = calc.phanTramDaThanhToan;
    contract.thanhToan.trangThaiThanhToan = calc.trangThaiThanhToan;

    return contract;
}

/**
 * Snapshot thông tin chi tiết dịch vụ vào giỏ hàng của hợp đồng để đảm bảo tính bất biến
 * 
 * @param {Object} cartItem - Phần tử trong gioHang
 * @param {Object} dichVuDoc - Bản ghi dịch vụ trong collection DichVu
 * @returns {Object} cartItem đã được snapshot đầy đủ
 */
function snapshotContractPackage(cartItem, dichVuDoc) {
    if (!cartItem || !dichVuDoc) return cartItem;

    if (!cartItem.donGia) cartItem.donGia = dichVuDoc.giaTriDichVu;
    if (!cartItem.tenDichVuSnapshot) cartItem.tenDichVuSnapshot = dichVuDoc.tenDichVu;
    if (!cartItem.loaiDichVu) cartItem.loaiDichVu = dichVuDoc.loaiDichVu;

    // Snapshot details (DeliverableSpec[], photoSchedules, makeupSessions, wardrobe, extras, terms)
    if (!cartItem.detailsSnapshot && dichVuDoc.details) {
        cartItem.detailsSnapshot = JSON.parse(JSON.stringify(dichVuDoc.details));
    }

    // Snapshot legacy size and schedule fields
    if (cartItem.soLuongAnh16x21 === undefined || cartItem.soLuongAnh16x21 === null) cartItem.soLuongAnh16x21 = dichVuDoc.soLuongAnh16x21 || 0;
    if (cartItem.soLuongAnh20x30 === undefined || cartItem.soLuongAnh20x30 === null) cartItem.soLuongAnh20x30 = dichVuDoc.soLuongAnh20x30 || 0;
    if (cartItem.soLuongAnh60x90 === undefined || cartItem.soLuongAnh60x90 === null) cartItem.soLuongAnh60x90 = dichVuDoc.soLuongAnh60x90 || 0;
    if (cartItem.soLuongAnhChinhSua === undefined || cartItem.soLuongAnhChinhSua === null) cartItem.soLuongAnhChinhSua = dichVuDoc.soLuongAnhChinhSua || 0;
    if (cartItem.soLuongLichChup === undefined || cartItem.soLuongLichChup === null) cartItem.soLuongLichChup = dichVuDoc.soLuongLichChup || 0;
    if (cartItem.soLuongLichMake === undefined || cartItem.soLuongLichMake === null) cartItem.soLuongLichMake = dichVuDoc.soLuongLichMake || 0;

    return cartItem;
}

/**
 * Migration M03: Đối soát tính toán giá, voucher và snapshot sản phẩm bàn giao
 * 
 * @param {Object} options
 * @param {boolean} options.dryRun - Nếu true, chỉ kiểm tra không ghi CSDL
 * @returns {Promise<Object>} Báo cáo migration
 */
async function reconcileContractPricing({ dryRun = true } = {}) {
    console.log(`🔍 [Migration M03] Bắt đầu đối soát giá, voucher & snapshot bàn giao (dryRun = ${dryRun})...`);

    const HOPDONG = require("../models/hopDong.model");
    const DICHVU = require("../models/dichVu.model");
    const contracts = await HOPDONG.find({});
    const report = {
        dryRun,
        timestamp: new Date().toISOString(),
        totalContractsScanned: contracts.length,
        discrepanciesFound: 0,
        repairedContracts: 0,
        snapshotsBackfilled: 0,
        details: []
    };

    // Cache dịch vụ để tránh query lặp lại
    const dichVuCache = new Map();

    for (const contract of contracts) {
        let isCorrupt = false;
        const issues = [];
        const updateSet = {};

        const expected = calculateContractPricing(contract);
        const tt = contract.thanhToan || {};

        // 1. Kiểm tra chênh lệch tongGiaTri
        if (Number(tt.tongGiaTri) !== expected.tongGiaTri) {
            isCorrupt = true;
            issues.push(`Lệch tongGiaTri: Lưu=${tt.tongGiaTri}, Chuẩn=${expected.tongGiaTri}`);
            updateSet["thanhToan.tongGiaTri"] = expected.tongGiaTri;
        }

        // 2. Kiểm tra chênh lệch tongPhatSinh
        if (Number(tt.tongPhatSinh || 0) !== expected.tongPhatSinh) {
            isCorrupt = true;
            issues.push(`Lệch tongPhatSinh: Lưu=${tt.tongPhatSinh}, Chuẩn=${expected.tongPhatSinh}`);
            updateSet["thanhToan.tongPhatSinh"] = expected.tongPhatSinh;
        }

        // 3. Kiểm tra chênh lệch tongGiaTriSauGiam
        if (Number(tt.tongGiaTriSauGiam) !== expected.tongGiaTriSauGiam) {
            isCorrupt = true;
            issues.push(`Lệch tongGiaTriSauGiam: Lưu=${tt.tongGiaTriSauGiam}, Chuẩn=${expected.tongGiaTriSauGiam}`);
            updateSet["thanhToan.tongGiaTriSauGiam"] = expected.tongGiaTriSauGiam;
        }

        // 4. Kiểm tra chênh lệch conLai
        if (Number(tt.conLai) !== expected.conLai) {
            isCorrupt = true;
            issues.push(`Lệch conLai: Lưu=${tt.conLai}, Chuẩn=${expected.conLai}`);
            updateSet["thanhToan.conLai"] = expected.conLai;
        }

        // 5. Kiểm tra chênh lệch phanTramDaThanhToan
        if (Number(tt.phanTramDaThanhToan) !== expected.phanTramDaThanhToan) {
            isCorrupt = true;
            issues.push(`Lệch phanTramDaThanhToan: Lưu=${tt.phanTramDaThanhToan}, Chuẩn=${expected.phanTramDaThanhToan}`);
            updateSet["thanhToan.phanTramDaThanhToan"] = expected.phanTramDaThanhToan;
        }

        // 6. Kiểm tra trạng thái thanh toán
        if (tt.trangThaiThanhToan !== expected.trangThaiThanhToan) {
            isCorrupt = true;
            issues.push(`Lệch trangThaiThanhToan: Lưu="${tt.trangThaiThanhToan}", Chuẩn="${expected.trangThaiThanhToan}"`);
            updateSet["thanhToan.trangThaiThanhToan"] = expected.trangThaiThanhToan;
        }

        // 7. Kiểm tra & backfill detailsSnapshot cho giỏ hàng
        let cartModified = false;
        const newCart = Array.isArray(contract.gioHang) 
            ? contract.gioHang.map(it => typeof it.toObject === 'function' ? it.toObject() : { ...it }) 
            : [];
        for (let i = 0; i < newCart.length; i++) {
            const item = newCart[i];
            if (item.dichVu && !item.detailsSnapshot) {
                let dichVuDoc = dichVuCache.get(String(item.dichVu));
                if (!dichVuDoc && DICHVU) {
                    try {
                        dichVuDoc = await DICHVU.findById(item.dichVu);
                        if (dichVuDoc) dichVuCache.set(String(item.dichVu), dichVuDoc);
                    } catch (e) {}
                }
                if (dichVuDoc && dichVuDoc.details) {
                    item.detailsSnapshot = JSON.parse(JSON.stringify(dichVuDoc.details));
                    cartModified = true;
                    report.snapshotsBackfilled++;
                    issues.push(`Backfill detailsSnapshot cho mục giỏ hàng [${item.tenDichVuSnapshot || item.dichVu}]`);
                }
            }
        }
        if (cartModified) {
            isCorrupt = true;
            updateSet["gioHang"] = newCart;
        }

        // 8. Backfill packageSnapshot nếu thiếu
        if (!contract.packageSnapshot && newCart.length > 0) {
            isCorrupt = true;
            const primaryItem = newCart[0];
            const pkgSnapshot = {
                packageName: primaryItem.tenDichVuSnapshot || "",
                unitPrice: primaryItem.donGia || 0,
                deliverables: primaryItem.detailsSnapshot?.deliverables || [],
                photoSchedules: primaryItem.detailsSnapshot?.photoSchedules || [],
                makeupSessions: primaryItem.detailsSnapshot?.makeupSessions || [],
                wardrobe: primaryItem.detailsSnapshot?.wardrobe || [],
                snapshotAt: contract.ngayHopDong || contract.createdAt || new Date()
            };
            updateSet["packageSnapshot"] = pkgSnapshot;
            issues.push(`Backfill packageSnapshot từ giỏ hàng chính`);
        }

        if (isCorrupt) {
            report.discrepanciesFound++;
            report.details.push({
                maHopDong: contract.maHopDong,
                issues,
                expectedPricing: {
                    tongGiaTri: expected.tongGiaTri,
                    tongPhatSinh: expected.tongPhatSinh,
                    tongGiaTriSauGiam: expected.tongGiaTriSauGiam,
                    conLai: expected.conLai
                }
            });

            if (!dryRun) {
                await HOPDONG.updateOne({ _id: contract._id }, { $set: updateSet });
                report.repairedContracts++;
            }
        }
    }

    console.log(`🏁 [Migration M03 Hoàn tất] Quét: ${report.totalContractsScanned} | Sai lệch: ${report.discrepanciesFound} | Đã sửa: ${report.repairedContracts}`);
    return report;
}

module.exports = {
    calculateContractPricing,
    applyPricingToContract,
    snapshotContractPackage,
    reconcileContractPricing
};
