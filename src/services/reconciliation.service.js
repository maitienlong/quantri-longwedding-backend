const HOPDONG = require("../models/hopDong.model");
const Payment = require("../models/payment.model");
const { createLog } = require("../utils/logger");

/**
 * Hàm kiểm tra và đối soát tính toàn vẹn sổ cái thanh toán (Payment Ledger Reconciliation)
 * 
 * Kiểm tra 3 điều kiện toàn vẹn tài chính:
 * 1. Tổng tiền thanh toán cached: khachHangDaThanhToan === sum(cacLuotThanhToan.amount)
 * 2. Số tiền còn lại: conLai === max(0, tongGiaTriSauGiam - khachHangDaThanhToan)
 * 3. Đồng bộ 1-1 giữa danh sách thanh toán nhúng (embedded array) và collection Payment độc lập
 * 
 * @param {Object} options
 * @param {boolean} options.dryRun - Nếu true, chỉ kiểm tra và báo cáo không ghi đè CSDL
 * @param {string} [options.contractCode] - Tùy chọn kiểm tra riêng một hợp đồng cụ thể
 * @param {Object} [options.req] - Express request (để ghi audit log)
 * @returns {Promise<Object>} Báo cáo đối soát chi tiết
 */
async function reconcilePayments({ dryRun = true, contractCode = null, req = null } = {}) {
    console.log(`🔍 [Reconciliation] Bắt đầu đối soát sổ cái thanh toán (dryRun = ${dryRun}, contract = ${contractCode || 'ALL'})...`);

    const query = {};
    if (contractCode) {
        query.maHopDong = { $regex: new RegExp(`^${contractCode.trim()}$`, "i") };
    }

    const contracts = await HOPDONG.find(query);
    const report = {
        dryRun,
        timestamp: new Date().toISOString(),
        totalContractsScanned: contracts.length,
        discrepanciesFound: 0,
        repairedContracts: 0,
        missingPaymentDocsCreated: 0,
        details: []
    };

    for (const contract of contracts) {
        const maHopDong = contract.maHopDong;
        const thanhToan = contract.thanhToan || {};
        const cacLuot = Array.isArray(thanhToan.cacLuotThanhToan) ? [...thanhToan.cacLuotThanhToan] : [];

        // 1. Tính tổng số tiền thực tế từ từng lượt thanh toán
        const actualPaidSum = cacLuot.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const storedPaid = Number(thanhToan.khachHangDaThanhToan) || 0;

        // 2. Tính số tiền còn lại thực tế
        const tongGiaTri = Number(thanhToan.tongGiaTriSauGiam) || Number(thanhToan.tongGiaTri) || 0;
        const expectedConLai = Math.max(0, tongGiaTri - actualPaidSum);
        const storedConLai = Number(thanhToan.conLai) || 0;

        let hasDiscrepancy = false;
        const issues = [];

        if (actualPaidSum !== storedPaid) {
            hasDiscrepancy = true;
            issues.push(`Lệch tổng đã thanh toán: Cached=${storedPaid.toLocaleString('vi-VN')} đ, Thực tế=${actualPaidSum.toLocaleString('vi-VN')} đ`);
        }

        if (expectedConLai !== storedConLai) {
            hasDiscrepancy = true;
            issues.push(`Lệch số tiền còn lại: Stored=${storedConLai.toLocaleString('vi-VN')} đ, Thực tế=${expectedConLai.toLocaleString('vi-VN')} đ`);
        }

        // 3. Kiểm tra tính hiện diện của bản ghi trong collection Payment
        const missingPaymentDocs = [];
        let cacLuotModified = false;

        for (let i = 0; i < cacLuot.length; i++) {
            const item = cacLuot[i];
            let pId = item.id;

            if (!pId) {
                pId = `PAY_${maHopDong}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                cacLuot[i].id = pId;
                cacLuotModified = true;
                hasDiscrepancy = true;
                issues.push(`Lượt thanh toán index ${i} (${item.amount} đ) thiếu ID, đã sinh ID mới: ${pId}`);
            }

            // Tìm trong collection Payment
            const existingPayment = await Payment.findOne({
                $or: [
                    { id: pId },
                    { providerTransactionId: pId },
                    { maHopDong, amount: Number(item.amount) || 0, date: item.date ? new Date(item.date) : { $exists: true } }
                ]
            });

            if (!existingPayment) {
                missingPaymentDocs.push({
                    id: pId,
                    amount: Number(item.amount) || 0,
                    method: item.method || "Tiền mặt",
                    date: item.date ? new Date(item.date) : new Date(),
                    noiDung: item.noiDung || `Thanh toán hợp đồng ${maHopDong}`
                });
                hasDiscrepancy = true;
                issues.push(`Thiếu bản ghi Payment collection cho giao dịch ${pId} (${item.amount} đ)`);
            }
        }

        if (hasDiscrepancy) {
            report.discrepanciesFound++;
            report.details.push({
                maHopDong,
                issues,
                actualPaidSum,
                storedPaid,
                missingPaymentDocsCount: missingPaymentDocs.length
            });

            // 4. Nếu không phải dryRun -> Thực hiện sửa chữa và đồng bộ an toàn (Apply Mode)
            if (!dryRun) {
                // Tạo các bản ghi Payment còn thiếu
                for (const missing of missingPaymentDocs) {
                    try {
                        const pMethod = missing.method || "Tiền mặt";
                        await Payment.create({
                            id: missing.id,
                            provider: missing.id.startsWith("SEPAY") ? "SEPAY" : (pMethod.includes("Chuyển khoản") ? "MANUAL_TRANSFER" : "MANUAL_CASH"),
                            providerTransactionId: missing.id,
                            maHopDong,
                            hopDongId: contract._id,
                            khachHangId: contract.khachHang1,
                            khachHang: contract.khachHang1?.tenKhachHang || "Khách hàng",
                            amount: missing.amount,
                            date: missing.date,
                            method: pMethod,
                            noiDung: missing.noiDung,
                            status: "SUCCESS"
                        });
                        report.missingPaymentDocsCreated++;
                    } catch (e) {
                        if (e.code !== 11000) {
                            console.warn(`Lỗi tạo Payment doc cho ${missing.id}:`, e.message);
                        }
                    }
                }

                // Cập nhật lại số dư hợp đồng chuẩn xác
                let phanTramDaThanhToan = 0;
                if (tongGiaTri > 0) {
                    phanTramDaThanhToan = Math.min(100, Math.max(0, Math.round((actualPaidSum / tongGiaTri) * 100 * 10) / 10));
                } else {
                    phanTramDaThanhToan = actualPaidSum > 0 ? 100 : 0;
                }
                const trangThaiThanhToan = expectedConLai <= 0 && (actualPaidSum > 0 || tongGiaTri === 0) 
                    ? "Đã thanh toán đủ" 
                    : (actualPaidSum > 0 ? `Đã cọc ${phanTramDaThanhToan}%` : "Chưa thanh toán");

                await HOPDONG.updateOne({ _id: contract._id }, {
                    $set: {
                        "thanhToan.cacLuotThanhToan": cacLuot,
                        "thanhToan.khachHangDaThanhToan": actualPaidSum,
                        "thanhToan.conLai": expectedConLai,
                        "thanhToan.phanTramDaThanhToan": phanTramDaThanhToan,
                        "thanhToan.trangThaiThanhToan": trangThaiThanhToan
                    }
                });

                report.repairedContracts++;
            }
        }
    }

    console.log(`🏁 [Reconciliation Hoàn tất] Quét: ${report.totalContractsScanned} | Lệch: ${report.discrepanciesFound} | Đã sửa: ${report.repairedContracts} | Tạo mới Payment: ${report.missingPaymentDocsCreated}`);

    if (req) {
        createLog({
            action: dryRun ? "Kiểm tra đối soát sổ cái (Dry-run)" : "Thực thi đối soát và đồng bộ sổ cái (Apply)",
            user: req.user?.fullname || "Quản lý",
            req,
            details: {
                dryRun,
                totalScanned: report.totalContractsScanned,
                discrepancies: report.discrepanciesFound,
                repaired: report.repairedContracts,
                missingDocsCreated: report.missingPaymentDocsCreated
            }
        });
    }

    return report;
}

module.exports = {
    reconcilePayments
};

