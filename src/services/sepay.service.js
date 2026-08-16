const crypto = require("crypto");
const SepayConfig = require("../models/sepayConfig.model");
const HopDong = require("../models/hopDong.model");
const Payment = require("../models/payment.model");
const { success, error } = require("../utils/response");

// Helper to get or create SepayConfig
async function getOrCreateConfig() {
    let config = await SepayConfig.findOne();
    if (!config) {
        config = await SepayConfig.create({
            bankName: process.env.SEPAY_BANK_NAME || "MBBank",
            accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || "9990187764519",
            accountName: process.env.SEPAY_ACCOUNT_NAME || "LONG WEDDING",
            secretKey: process.env.SEPAY_WEBHOOK_SECRET || "whsec_kY4YMHH5aqMUcrHSEeqj4wQpov6Vhx0N",
            defaultPrefix: "HD"
        });
    }
    return config;
}

// HMAC-SHA256 Signature Verification
function verifyHmacSignature(rawBody, signatureHeader, timestampHeader, secretKey) {
    if (!signatureHeader || !timestampHeader || !secretKey) return false;
    try {
        const expectedSigPart = signatureHeader.startsWith("sha256=") ? signatureHeader.substring(7) : signatureHeader;
        const payloadToSign = `${timestampHeader}.${rawBody.toString('utf8')}`;
        const computedSig = crypto.createHmac("sha256", secretKey).update(payloadToSign).digest("hex");
        return crypto.timingSafeEqual(Buffer.from(computedSig), Buffer.from(expectedSigPart));
    } catch (err) {
        console.error("HMAC verification error:", err.message);
        return false;
    }
}

// 1. Handle Webhook from SePay
async function handleWebhook(req, res) {
    try {
        console.log("=== SEPAY WEBHOOK RECEIVED ===", req.body);
        const config = await getOrCreateConfig();

        // Security check: HMAC-SHA256 signature or API key authorization
        const signatureHeader = req.headers["x-sepay-signature"];
        const timestampHeader = req.headers["x-sepay-timestamp"];
        const authHeader = req.headers["authorization"];

        const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET || config.secretKey || "whsec_kY4YMHH5aqMUcrHSEeqj4wQpov6Vhx0N";
        let isValidSig = false;

        if (signatureHeader && timestampHeader && req.rawBody) {
            isValidSig = verifyHmacSignature(req.rawBody, signatureHeader, timestampHeader, webhookSecret);
        }

        let isValidKey = false;
        if (config.apiKey) {
            const expectedAuth = `Bearer ${config.apiKey}`;
            if (authHeader && authHeader === expectedAuth) {
                isValidKey = true;
            }
        }

        // If secret key / API key configured but fails verification
        if (webhookSecret && !isValidSig && config.apiKey && !isValidKey) {
            console.warn("⚠️ Webhook verification failed. Unauthorized payload.");
            return res.status(401).json({ success: false, message: "Unauthorized Webhook payload" });
        }

        const {
            id,
            gateway,
            transactionDate,
            accountNumber,
            code,
            content,
            transferType,
            transferAmount,
            accumulated,
            subAccount,
            referenceCode,
            description
        } = req.body;

        // Process only incoming transfers ("in")
        if (transferType && transferType !== "in") {
            return res.status(200).json({ success: true, message: "Ignored non-incoming transaction" });
        }

        const transactionContent = content || description || "";
        const amount = Number(transferAmount) || 0;

        if (!transactionContent || amount <= 0) {
            return res.status(200).json({ success: true, message: "No contract code or valid amount found" });
        }

        // Extract contract code HD-XXXX-XXX or HDXXXXXX
        const prefix = config.defaultPrefix || "HD";
        const cleanContent = transactionContent.replace(/\s+/g, " ").trim();
        
        // Match patterns: HD-2026-360, HD 2026 360, HD2026360, HD-360, etc.
        const matchPatterns = [
            new RegExp(`${prefix}[-\\s]?\\d{4}[-\\s]?\\d+`, "i"),
            new RegExp(`${prefix}[-\\s]?\\d+`, "i"),
            new RegExp(`${prefix}[-\\s]?[A-Z0-9-]+`, "i")
        ];

        let targetMaHopDong = null;
        for (const p of matchPatterns) {
            const m = cleanContent.match(p);
            if (m) {
                targetMaHopDong = m[0].replace(/\s+/g, "").toUpperCase();
                break;
            }
        }

        let contract = null;
        if (targetMaHopDong) {
            // Try exact match
            contract = await HopDong.findOne({ maHopDong: targetMaHopDong });

            // Try with hyphen if missing (e.g., HD2026360 -> HD-2026-360)
            if (!contract) {
                const withHyphen = targetMaHopDong.replace(/^HD(?=\d)/i, "HD-");
                contract = await HopDong.findOne({ maHopDong: withHyphen });
            }

            // Try regex case-insensitive search
            if (!contract) {
                contract = await HopDong.findOne({ maHopDong: new RegExp(targetMaHopDong.replace('-', '[-]?'), 'i') });
            }
        }

        // Fallback for SePay test webhooks without explicit contract code
        if (!contract && (cleanContent.toLowerCase().includes("test") || cleanContent.toLowerCase().includes("sepay"))) {
            contract = await HopDong.findOne().sort({ createdAt: -1 });
            if (contract) {
                console.log(`[SePay Test Webhook] Matched latest contract: ${contract.maHopDong}`);
            }
        }

        if (!contract) {
            console.log("Contract not found for content:", transactionContent);
            return res.status(200).json({ success: true, message: `No matching contract found for '${transactionContent}'` });
        }

        // Avoid duplicate transaction processing
        const transactionId = `SEPAY_${id || referenceCode || Date.now()}`;
        const cacLuotThanhToan = contract.thanhToan?.cacLuotThanhToan || [];
        const isDuplicate = cacLuotThanhToan.some(p => p.id === transactionId || p.noiDung?.includes(`SEPAY_${id}`));

        if (isDuplicate) {
            console.log("Transaction already processed:", transactionId);
            return res.status(200).json({ success: true, message: "Transaction already recorded" });
        }

        // Add new payment entry
        const newPaymentObj = {
            id: transactionId,
            khachHang: contract.khachHang1?.tenKhachHang || "Khách hàng",
            amount: amount,
            date: transactionDate || new Date().toISOString(),
            method: "Chuyển khoản (VietQR SePay)",
            noiDung: `Thanh toán SePay (${gateway || 'Bank'} - STK: ${accountNumber || ''}) [${transactionId}]`
        };

        cacLuotThanhToan.push(newPaymentObj);

        // Recalculate contract totals
        const gioHang = contract.gioHang || [];
        const tongGiaTriRaw = gioHang.reduce((sum, item) => {
            const price = parseFloat(item.donGia?.toString().replace(/[^0-9.-]+/g, "") || 0);
            return sum + (price * (item.soLuong || 0));
        }, 0);

        const giamGia = Number(contract.thanhToan?.giamGia) || 0;
        const loaiGiamGia = contract.thanhToan?.loaiGiamGia || 0;
        let tongGiaTriSauGiam = tongGiaTriRaw;
        if (loaiGiamGia === 1) {
            tongGiaTriSauGiam = Math.max(0, tongGiaTriRaw - (tongGiaTriRaw * giamGia / 100));
        } else {
            tongGiaTriSauGiam = Math.max(0, tongGiaTriRaw - giamGia);
        }

        const khachHangDaThanhToan = cacLuotThanhToan.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const conLai = Math.max(0, tongGiaTriSauGiam - khachHangDaThanhToan);

        contract.thanhToan = {
            ...contract.thanhToan,
            tongGiaTri: tongGiaTriRaw,
            tongGiaTriSauGiam: tongGiaTriSauGiam,
            khachHangDaThanhToan: khachHangDaThanhToan,
            conLai: conLai,
            cacLuotThanhToan: cacLuotThanhToan
        };

        await contract.save();

        // Also save to Payment collection
        try {
            await Payment.create({
                contractId: contract._id,
                amount: amount,
                paymentMethod: "Bank Transfer (SePay)",
                paymentDate: new Date(transactionDate || Date.now()),
                note: `Webhook SePay Giao dịch ${id || ''}`
            });
        } catch (payErr) {
            console.error("Warning: Could not save Payment model:", payErr.message);
        }

        console.log(`✅ Gạch nợ thành công hợp đồng ${contract.maHopDong}: Đã thanh toán ${khachHangDaThanhToan} đ | Còn lại ${conLai} đ`);

        return res.status(200).json({
            success: true,
            message: "Gạch nợ hợp đồng thành công",
            data: {
                maHopDong: contract.maHopDong,
                amountPaid: amount,
                khachHangDaThanhToan: khachHangDaThanhToan,
                conLai: conLai
            }
        });
    } catch (err) {
        console.error("Lỗi xử lý SePay Webhook:", err);
        return res.status(200).json({ success: false, message: err.message });
    }
}

// 2. Get Sepay Config
async function getConfig(req, res) {
    try {
        const config = await getOrCreateConfig();
        return success(res, "Lấy cấu hình SePay thành công", config);
    } catch (err) {
        return error(res, err.message);
    }
}

// 3. Update Sepay Config
async function updateConfig(req, res) {
    try {
        const { bankName, accountNumber, accountName, apiKey, secretKey, defaultPrefix } = req.body;
        let config = await getOrCreateConfig();

        if (bankName !== undefined) config.bankName = bankName;
        if (accountNumber !== undefined) config.accountNumber = accountNumber;
        if (accountName !== undefined) config.accountName = accountName;
        if (apiKey !== undefined) config.apiKey = apiKey;
        if (secretKey !== undefined) config.secretKey = secretKey;
        if (defaultPrefix !== undefined) config.defaultPrefix = defaultPrefix;

        await config.save();
        return success(res, "Cập nhật cấu hình SePay thành công", config);
    } catch (err) {
        return error(res, err.message);
    }
}

// 4. Get Dynamic QR Code Info
async function getQrInfo(req, res) {
    try {
        const { maHopDong } = req.params;
        const amountQuery = req.query.amount;

        const contract = await HopDong.findOne({ maHopDong });
        if (!contract) {
            return error(res, "Không tìm thấy hợp đồng");
        }

        const config = await getOrCreateConfig();
        const khachHangDaTT = contract.thanhToan?.khachHangDaThanhToan || 0;
        const tongGiaTri = contract.thanhToan?.tongGiaTriSauGiam || contract.thanhToan?.tongGiaTri || 0;
        const conLai = Math.max(0, tongGiaTri - khachHangDaTT);

        const amountToPay = amountQuery ? Number(amountQuery) : conLai;
        const cleanMaHopDong = contract.maHopDong.replace(/\s+/g, "");
        const transferContent = cleanMaHopDong;

        const vietQrUrl = `https://img.vietqr.io/image/${config.bankName || 'MBBank'}-${config.accountNumber || '9990187764519'}-compact2.png?amount=${amountToPay}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(config.accountName || 'LONG WEDDING')}`;
        const sepayQrUrl = `https://qr.sepay.vn/img?acc=${config.accountNumber || '9990187764519'}&bank=${config.bankName || 'MBBank'}&amount=${amountToPay}&des=${encodeURIComponent(transferContent)}`;

        return success(res, "Lấy thông tin VietQR SePay thành công", {
            maHopDong: contract.maHopDong,
            bankName: config.bankName,
            accountNumber: config.accountNumber,
            accountName: config.accountName,
            amount: amountToPay,
            conLai: conLai,
            transferContent: transferContent,
            vietQrUrl: vietQrUrl,
            sepayQrUrl: sepayQrUrl
        });
    } catch (err) {
        return error(res, err.message);
    }
}

// 5. Check Contract Payment Status (Polling)
async function checkStatus(req, res) {
    try {
        const { maHopDong } = req.params;
        const contract = await HopDong.findOne({ maHopDong });
        if (!contract) {
            return error(res, "Không tìm thấy hợp đồng");
        }

        const cacLuotThanhToan = contract.thanhToan?.cacLuotThanhToan || [];
        const latestPayment = cacLuotThanhToan.length > 0 ? cacLuotThanhToan[cacLuotThanhToan.length - 1] : null;

        return success(res, "Kiểm tra trạng thái thành công", {
            maHopDong: contract.maHopDong,
            khachHangDaThanhToan: contract.thanhToan?.khachHangDaThanhToan || 0,
            conLai: contract.thanhToan?.conLai || 0,
            paymentCount: cacLuotThanhToan.length,
            latestPayment: latestPayment
        });
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    handleWebhook,
    getConfig,
    updateConfig,
    getQrInfo,
    checkStatus
};
