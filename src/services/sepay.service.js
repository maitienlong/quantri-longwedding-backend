const { notifyPaymentSuccess } = require("../socket");
const recentNotifications = [];
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
            accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || "",
            accountName: process.env.SEPAY_ACCOUNT_NAME || "",
            merchantId: process.env.SEPAY_MERCHANT_ID || "",
            webhookSecret: process.env.SEPAY_WEBHOOK_SECRET || "",
            apiKey: process.env.SEPAY_API_KEY || "",
            isAutoApprove: true,
            defaultPrefix: "HD"
        });
    }
    return config;
}

// Verify HMAC SHA256 Signature
function verifyHmacSignature(rawBody, signatureHeader, timestampHeader, secret) {
    if (!signatureHeader || !secret) return false;
    
    const timestampStr = timestampHeader ? timestampHeader.toString().trim() : "";
    const timestampNum = Number(timestampStr);
    
    if (timestampNum && !isNaN(timestampNum)) {
        if (Math.abs(Date.now() / 1000 - timestampNum) > 300) {
            console.warn("⚠️ Webhook timestamp expired (> 300s). Replay attack prevented.");
            return false;
        }
    }

    const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    const payload = timestampStr ? `${timestampStr}.${rawStr}` : rawStr;

    const computedHex = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expectedWithPrefix = `sha256=${computedHex}`;
    const receivedSig = signatureHeader.toString().trim();

    try {
        const sigBuf = Buffer.from(receivedSig.toLowerCase());
        const expBuf = Buffer.from(expectedWithPrefix.toLowerCase());
        const rawExpBuf = Buffer.from(computedHex.toLowerCase());

        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
            return true;
        }
        if (sigBuf.length === rawExpBuf.length && crypto.timingSafeEqual(sigBuf, rawExpBuf)) {
            return true;
        }
    } catch (err) {
        console.error("Error in timingSafeEqual comparison:", err);
    }

    return receivedSig.toLowerCase() === expectedWithPrefix.toLowerCase() || receivedSig.toLowerCase() === computedHex.toLowerCase();
}

// 1. Handle Webhook from SePay (POST /api/sepay/webhook)
async function handleWebhook(req, res) {
    try {
        console.log("=== SEPAY WEBHOOK RECEIVED ===", req.body);
        const config = await getOrCreateConfig();
        const webhookSecret = config.webhookSecret;
        const signatureHeader = req.headers["x-sepay-signature"] || req.headers["X-SePay-Signature"];
        const timestampHeader = req.headers["x-sepay-timestamp"] || req.headers["X-SePay-Timestamp"];
        const authHeader = req.headers["authorization"] || req.headers["Authorization"];

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

        if (webhookSecret && signatureHeader && !isValidSig) {
            console.warn("⚠️ Webhook verification failed. Invalid signature.");
            return res.status(401).json({ success: false, message: "Invalid signature" });
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
        } = req.body || {};

        if (transferType && transferType !== "in") {
            return res.status(200).json({ success: true, message: "Ignored non-incoming transaction" });
        }

        const transactionContent = content || description || "";
        const amount = Number(transferAmount) || 0;

        if (!transactionContent || amount <= 0) {
            return res.status(200).json({ success: true, message: "No contract code or valid amount found" });
        }

        // Extract contract code HD + "6 SỐ CUỐI"
        const prefix = config.defaultPrefix || "HD";
        const cleanContent = transactionContent.replace(/\s+/g, " ").trim();
        
        // Match HD (or configured prefix) followed by digits/separators
        const regex = new RegExp(`(?:${prefix})[-\\s]?(\\d[\\d-\\s]*)`, "i");
        const match = cleanContent.match(regex);

        let contract = null;
        let targetMaHopDong = null;

        if (match) {
            const rawDigits = match[1].replace(/\D/g, "");
            // Extract 6 last digits
            const last6Digits = rawDigits.length >= 6 ? rawDigits.slice(-6) : rawDigits;
            const code6 = `${prefix}${last6Digits}`;
            const codeFull = `${prefix}${rawDigits}`;

            targetMaHopDong = code6;

            let year = "";
            let seqNum = rawDigits;
            if (rawDigits.length >= 7) {
                year = rawDigits.substring(0, 4);
                seqNum = rawDigits.substring(4);
            }
            const cleanSeqNum = seqNum.replace(/^0+/, "") || seqNum;

            const searchQuery = [
                { maHopDong: code6 },
                { maHopDong: codeFull },
                { maHopDong: `${prefix}-${last6Digits}` },
                { maHopDong: `${prefix}-${rawDigits}` },
                { maHopDong: `${prefix}-${year}-${cleanSeqNum}` },
                { maHopDong: `${prefix}-${cleanSeqNum}` },
                { maHopDong: `${prefix}${cleanSeqNum}` },
                { maHopDong: new RegExp(`^${prefix}[-\\s]?.*${last6Digits}$`, 'i') },
                { maHopDong: new RegExp(`^${prefix}[-\\s]?.*${rawDigits}$`, 'i') }
            ];

            console.log(`[SePay Webhook] Searching for contract code: HD + 6 digits (${code6}) / Full (${codeFull}) from content: '${cleanContent}'`);
            contract = await HopDong.findOne({ $or: searchQuery });
        }

        // Fallback: If no explicit HD prefix, search for 6+ digits sequence in content
        if (!contract) {
            const fallbackDigitsMatch = cleanContent.match(/\d{6,}/);
            if (fallbackDigitsMatch) {
                const rawDigits = fallbackDigitsMatch[0];
                const last6Digits = rawDigits.slice(-6);
                const code6 = `${prefix}${last6Digits}`;
                const searchQuery = [
                    { maHopDong: code6 },
                    { maHopDong: `${prefix}-${last6Digits}` },
                    { maHopDong: new RegExp(`^${prefix}[-\\s]?.*${last6Digits}$`, 'i') }
                ];
                console.log(`[SePay Webhook Fallback] Searching for contract code: ${code6} from content digits '${rawDigits}'`);
                contract = await HopDong.findOne({ $or: searchQuery });
            }
        }

        // Fallback for explicit SePay test webhooks in non-production environment only
        if (!contract && process.env.NODE_ENV !== 'production' && cleanContent.toLowerCase().includes("test_sepay_webhook")) {
            contract = await HopDong.findOne().sort({ createdAt: -1 });
            if (contract) {
                console.log(`[SePay Test Webhook] Matched latest contract: ${contract.maHopDong}`);
            }
        }

        if (!contract) {
            console.log(`Contract not found for content: ${cleanContent}`);
            return res.status(200).json({ success: true, message: `No matching contract found for '${cleanContent}'` });
        }

        // Duplicate check by transaction ID
        const existingTxId = `SEPAY_${id || Date.now()}`;
        const alreadyProcessed = contract.thanhToan?.cacLuotThanhToan?.some(t => t.id === existingTxId || t.noiDung?.includes(existingTxId));

        if (alreadyProcessed) {
            console.log(`Transaction ${existingTxId} already processed for contract ${contract.maHopDong}`);
            return res.status(200).json({ success: true, message: "Transaction already processed", maHopDong: contract.maHopDong });
        }

        // Record new payment into contract
        const newPaymentObj = {
            id: existingTxId,
            khachHang: contract.khachHang1?.tenKhachHang || "Khách hàng",
            amount: amount,
            date: transactionDate ? new Date(transactionDate).toISOString() : new Date().toISOString(),
            method: "Chuyển khoản (SePay VietQR)",
            noiDung: `Chuyển khoản SePay GD#${id || ''} - ${transactionContent}`
        };

        const currentPaidList = contract.thanhToan?.cacLuotThanhToan || [];
        const updatedPaidList = [...currentPaidList, newPaymentObj];

        const totalPaid = updatedPaidList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const gioHangList = contract.gioHang || contract.danhSachDichVuDatLich || contract.danhSachDichVu || [];
        let tongGiaTriForm = gioHangList.reduce((sum, item) => {
            const p = parseFloat(item.donGia?.toString().replace(/[^0-9.-]+/g, "") || 0);
            const sl = Number(item.soLuong) || 1;
            const giamGiaDV = Number(item.giamGiaDichVu) || 0;
            return sum + Math.max(0, (p * sl) - giamGiaDV);
        }, 0);

        // Cộng thêm phụ lục phát sinh (Add-ons) nếu có
        const addonList = contract.phuLucPhatSinh || [];
        const tongPhatSinh = addonList.reduce((sum, addon) => {
            const sl = Number(addon.soLuong) || 1;
            const dg = Number(addon.donGia) || 0;
            return sum + Math.max(0, sl * dg);
        }, 0);
        tongGiaTriForm += tongPhatSinh;

        // Nếu giỏ hàng trống nhưng hợp đồng đã có sẵn tongGiaTri thì giữ nguyên tongGiaTri
        if (tongGiaTriForm === 0 && Number(contract.thanhToan?.tongGiaTri) > 0) {
            tongGiaTriForm = Number(contract.thanhToan.tongGiaTri);
        }

        const discountValue = Number(contract.thanhToan?.giamGia) || Number(contract.giamGia) || 0;
        const discountType = Number(contract.thanhToan?.loaiGiamGia) || 0;
        const voucherGiamGia = Number(contract.thanhToan?.voucherGiamGia) || 0;
        let totalAfterDiscount = tongGiaTriForm;
        if (discountType === 1) {
            totalAfterDiscount = tongGiaTriForm - (tongGiaTriForm * discountValue / 100);
        } else {
            totalAfterDiscount = tongGiaTriForm - discountValue;
        }
        totalAfterDiscount = Math.max(0, totalAfterDiscount - voucherGiamGia);
        if (totalAfterDiscount === 0 && Number(contract.thanhToan?.tongGiaTriSauGiam) > 0) {
            totalAfterDiscount = Number(contract.thanhToan.tongGiaTriSauGiam);
        }

        const khachHangDaThanhToan = totalPaid;
        const conLai = Math.max(0, totalAfterDiscount - khachHangDaThanhToan);
        let phanTramDaThanhToan = 0;
        if (totalAfterDiscount > 0) {
            const pt = (khachHangDaThanhToan / totalAfterDiscount) * 100;
            phanTramDaThanhToan = Math.min(100, Math.max(0, Math.round(pt * 10) / 10));
        } else {
            phanTramDaThanhToan = khachHangDaThanhToan > 0 ? 100 : 0;
        }
        const trangThaiThanhToan = conLai <= 0 ? "Đã thanh toán đủ" : (khachHangDaThanhToan > 0 ? `Đã cọc ${phanTramDaThanhToan}%` : "Chưa thanh toán");

        await HopDong.findByIdAndUpdate(contract._id, {
            "thanhToan.cacLuotThanhToan": updatedPaidList,
            "thanhToan.khachHangDaThanhToan": khachHangDaThanhToan,
            "thanhToan.conLai": conLai,
            "thanhToan.phanTramDaThanhToan": phanTramDaThanhToan,
            "thanhToan.trangThaiThanhToan": trangThaiThanhToan
        });

        // Also record to Payment collection if model exists
        try {
            await Payment.create({
                id: existingTxId,
                maHopDong: contract.maHopDong,
                amount: amount,
                date: new Date(),
                method: "Chuyển khoản (SePay VietQR)",
                khachHang: contract.khachHang1?.tenKhachHang || "Khách hàng",
                noiDung: transactionContent
            });
        } catch (e) {
            console.warn("Warning: Could not save Payment model:", e.message);
        }

        console.log(`✅ Gạch nợ thành công hợp đồng ${contract.maHopDong}: Đã thanh toán ${khachHangDaThanhToan} đ | Còn lại ${conLai} đ`);

        // Extract session code suffix if present (e.g. HD2026360 S8421 -> S8421)
        const sessionCodeMatch = transactionContent.match(/S\d{4,6}/i);
        const extractedSessionCode = sessionCodeMatch ? sessionCodeMatch[0].toUpperCase() : '';

        // Broadcast WebSocket Real-time Payment Event
        notifyPaymentSuccess({
            sessionId: extractedSessionCode,
            maHopDong: contract.maHopDong,
            amount: amount,
            khachHangDaThanhToan: khachHangDaThanhToan,
            conLai: conLai,
            latestPayment: newPaymentObj,
            timestamp: Date.now()
        });

        recentNotifications.push({
            maHopDong: contract.maHopDong,
            amount: amount,
            timestamp: Date.now()
        });
        if (recentNotifications.length > 50) recentNotifications.shift();

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
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. Get Config (GET /api/sepay/config)
async function getConfig(req, res) {
    try {
        const config = await getOrCreateConfig();
        return res.status(200).json({
            success: true,
            data: {
                bankName: config.bankName,
                accountNumber: config.accountNumber,
                accountName: config.accountName,
                merchantId: config.merchantId,
                isAutoApprove: config.isAutoApprove,
                defaultPrefix: config.defaultPrefix,
                hasWebhookSecret: !!config.webhookSecret,
                hasApiKey: !!config.apiKey
            }
        });
    } catch (err) {
        console.error("Lỗi khi lấy cấu hình SePay:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. Update Config (POST /api/sepay/config)
async function updateConfig(req, res) {
    try {
        const {
            bankName,
            accountNumber,
            accountName,
            merchantId,
            webhookSecret,
            apiKey,
            isAutoApprove,
            defaultPrefix
        } = req.body;

        let config = await SepayConfig.findOne();
        if (!config) {
            config = new SepayConfig();
        }

        if (bankName !== undefined) config.bankName = bankName;
        if (accountNumber !== undefined) config.accountNumber = accountNumber;
        if (accountName !== undefined) config.accountName = accountName;
        if (merchantId !== undefined) config.merchantId = merchantId;
        if (webhookSecret !== undefined) config.webhookSecret = webhookSecret;
        if (apiKey !== undefined) config.apiKey = apiKey;
        if (isAutoApprove !== undefined) config.isAutoApprove = isAutoApprove;
        if (defaultPrefix !== undefined) config.defaultPrefix = defaultPrefix;

        await config.save();

        return res.status(200).json({
            success: true,
            message: "Cập nhật cấu hình SePay thành công",
            data: config
        });
    } catch (err) {
        console.error("Lỗi khi cập nhật cấu hình SePay:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. Get VietQR Payment Info & Image (GET /api/sepay/qr-info/:maHopDong)
async function getQrInfo(req, res) {
    try {
        const { maHopDong } = req.params;
        const amount = Number(req.query.amount) || 0;
        const sessionCode = req.query.sessionCode || '';
        const config = await getOrCreateConfig();

        const cleanMa = maHopDong.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const transferContent = sessionCode ? `${cleanMa} ${sessionCode}` : cleanMa;

        const vietQrUrl = `https://img.vietqr.io/image/${config.bankName}-${config.accountNumber}-qr_only.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(config.accountName)}`;
        const sepayQrUrl = `https://qr.sepay.vn/img?bank=${config.bankName}&acc=${config.accountNumber}&template=qr_only&amount=${amount}&des=${encodeURIComponent(transferContent)}`;

        return res.status(200).json({
            success: true,
            data: {
                maHopDong: cleanMa,
                bankName: config.bankName,
                accountNumber: config.accountNumber,
                accountName: config.accountName,
                transferContent: transferContent,
                amount: amount,
                vietQrUrl: vietQrUrl,
                sepayQrUrl: sepayQrUrl
            }
        });
    } catch (err) {
        console.error("Lỗi khi tạo mã QR VietQR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. Check Contract Payment Status (GET /api/sepay/check-status/:maHopDong)
async function checkStatus(req, res) {
    try {
        const { maHopDong } = req.params;
        const rawCode = maHopDong || "";
        const prefix = "HD";
        const rawDigits = rawCode.replace(/^HD[-\s]?/i, "").replace(/\D/g, "");
        const last6Digits = rawDigits.length >= 6 ? rawDigits.slice(-6) : rawDigits;
        const code6 = `${prefix}${last6Digits}`;
        const codeFull = `${prefix}${rawDigits}`;

        let year = "";
        let seqNum = rawDigits;
        if (rawDigits.length >= 7) {
            year = rawDigits.substring(0, 4);
            seqNum = rawDigits.substring(4);
        }
        const cleanSeqNum = seqNum.replace(/^0+/, "") || seqNum;

        const searchQuery = [
            { maHopDong: rawCode },
            { maHopDong: code6 },
            { maHopDong: codeFull },
            { maHopDong: `${prefix}-${last6Digits}` },
            { maHopDong: `${prefix}-${rawDigits}` },
            { maHopDong: `HD-${year}-${cleanSeqNum}` },
            { maHopDong: `HD-${cleanSeqNum}` },
            { maHopDong: `HD${cleanSeqNum}` },
            { maHopDong: new RegExp(`^HD[-\\s]?.*${last6Digits}$`, 'i') }
        ];

        const contract = await HopDong.findOne({ $or: searchQuery });
        if (!contract) {
            return res.status(404).json({ success: false, message: "Hợp đồng không tồn tại" });
        }

        const cacLuot = contract.thanhToan?.cacLuotThanhToan || [];
        const latestPayment = cacLuot.length > 0 ? cacLuot[cacLuot.length - 1] : null;

        return res.status(200).json({
            success: true,
            data: {
                maHopDong: contract.maHopDong,
                paymentCount: cacLuot.length,
                khachHangDaThanhToan: contract.thanhToan?.khachHangDaThanhToan || 0,
                conLai: contract.thanhToan?.conLai || 0,
                trangThaiThanhToan: contract.thanhToan?.trangThaiThanhToan || "Chưa thanh toán",
                latestPayment: latestPayment
            }
        });
    } catch (err) {
        console.error("Lỗi khi kiểm tra trạng thái hợp đồng:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 6. Get Recent Notifications
async function getNotifications(req, res) {
    return res.status(200).json({
        success: true,
        data: recentNotifications
    });
}

module.exports = {
    handleWebhook,
    getConfig,
    updateConfig,
    getQrInfo,
    checkStatus,
    getNotifications
};
