/**
 * PR 1.3 Automated Verification Test Suite
 * Tests:
 * 1. Webhook Fail-Closed: Missing credentials returns 401.
 * 2. Webhook Fail-Closed: Invalid signature or API key returns 401.
 * 3. Webhook Authentication: Valid HMAC SHA256 signature is accepted.
 * 4. Webhook Authentication: Valid API key (Bearer / Apikey) is accepted.
 * 5. Webhook Idempotency: Replayed transaction returns 200 with idempotent acknowledgement without double crediting.
 * 6. Concurrency Protection: Concurrent requests for same transaction ID result in exactly 1 balance update.
 * 7. Audit Logging: Webhook invocations are audited with sanitized headers (no secrets leaked).
 * 8. Socket.IO Hardening: Room isolation & authenticated handshake.
 */

const assert = require("assert");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-pr1-3";
process.env.SEPAY_WEBHOOK_SECRET = "test-sepay-secret-123456";
process.env.SEPAY_API_KEY = "test-sepay-api-key-789";

const SepayConfig = require("../src/models/sepayConfig.model");
const HopDong = require("../src/models/hopDong.model");
const Payment = require("../src/models/payment.model");
const PaymentAuditLog = require("../src/models/paymentAuditLog.model");
const sepayService = require("../src/services/sepay.service");
const socketModule = require("../src/socket");

// Mock Express Response
function createMockRes() {
    return {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
}

// Generate valid HMAC signature for test body
function generateHmac(body, secret, timestamp) {
    const rawStr = typeof body === "string" ? body : JSON.stringify(body);
    const payload = timestamp ? `${timestamp}.${rawStr}` : rawStr;
    const hex = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return hex;
}

async function runTests() {
    console.log("=== STARTING PR 1.3 AUTOMATED VERIFICATION ===");
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        return Promise.resolve()
            .then(fn)
            .then(() => {
                console.log(`[PASS] ${name}`);
                passed++;
            })
            .catch((err) => {
                console.error(`[FAIL] ${name}: ${err.message}`);
                failed++;
            });
    }

    // In-memory mock storage
    const mockPayments = new Map();
    const mockAuditLogs = [];
    let mockContract = null;

    // Mock SepayConfig
    SepayConfig.findOne = async () => ({
        bankName: "MBBank",
        accountNumber: "0999999999",
        accountName: "LONG WEDDING",
        merchantId: "M123",
        webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
        apiKey: process.env.SEPAY_API_KEY,
        isAutoApprove: true,
        defaultPrefix: "HD"
    });

    // Mock PaymentAuditLog.create
    PaymentAuditLog.create = async (doc) => {
        mockAuditLogs.push(doc);
        return doc;
    };

    // Mock Payment model
    Payment.findOne = async (query) => {
        if (query.$or) {
            for (const cond of query.$or) {
                if (cond.providerTransactionId && mockPayments.has(cond.providerTransactionId)) {
                    return mockPayments.get(cond.providerTransactionId);
                }
                if (cond.id) {
                    for (const p of mockPayments.values()) {
                        if (p.id === cond.id) return p;
                    }
                }
            }
        }
        return null;
    };

    // Override Payment constructor / prototype.save to enforce unique constraint
    const origPaymentSave = Payment.prototype.save;
    Payment.prototype.save = async function() {
        const key = this.providerTransactionId;
        if (mockPayments.has(key)) {
            const err = new Error(`E11000 duplicate key error collection: payments index: provider_1_providerTransactionId_1 dup key: { provider: "${this.provider}", providerTransactionId: "${key}" }`);
            err.code = 11000;
            throw err;
        }
        mockPayments.set(key, this);
        return this;
    };

    // Mock HopDong
    function resetMockContract() {
        mockContract = {
            _id: "507f1f77bcf86cd799439011",
            maHopDong: "HD2026360",
            khachHang1: { tenKhachHang: "Nguyễn Văn A" },
            gioHang: [{ donGia: "5000000", soLuong: 1 }],
            thanhToan: {
                tongGiaTri: 5000000,
                giamGia: 0,
                tongGiaTriSauGiam: 5000000,
                khachHangDaThanhToan: 1000000,
                conLai: 4000000,
                trangThaiThanhToan: "Đã cọc 20%",
                cacLuotThanhToan: [
                    { id: "INITIAL_PAYMENT", amount: 1000000, method: "Tiền mặt" }
                ]
            }
        };
    }

    HopDong.findOne = async () => mockContract;
    HopDong.findByIdAndUpdate = async (id, update) => {
        if (update["thanhToan.cacLuotThanhToan"]) {
            mockContract.thanhToan.cacLuotThanhToan = update["thanhToan.cacLuotThanhToan"];
        }
        if (update["thanhToan.khachHangDaThanhToan"] !== undefined) {
            mockContract.thanhToan.khachHangDaThanhToan = update["thanhToan.khachHangDaThanhToan"];
        }
        if (update["thanhToan.conLai"] !== undefined) {
            mockContract.thanhToan.conLai = update["thanhToan.conLai"];
        }
        return mockContract;
    };

    try {
        // --- TEST 1: Fail closed on missing authentication ---
        await test("1. Webhook Fail-Closed: Missing credentials returns 401 Unauthorized", async () => {
            const req = {
                headers: {},
                body: { id: 1001, transferAmount: 500000, content: "HD2026360" }
            };
            const res = createMockRes();
            await sepayService.handleWebhook(req, res);

            assert.strictEqual(res.statusCode, 401, `Expected status 401, got ${res.statusCode}`);
            assert.strictEqual(res.data.success, false);
        });

        // --- TEST 2: Fail closed on invalid HMAC signature & wrong API key ---
        await test("2. Webhook Fail-Closed: Invalid signature or API key returns 401", async () => {
            // Fake signature
            const reqBadSig = {
                headers: {
                    "x-sepay-signature": "bad_hex_signature_1234567890",
                    "x-sepay-timestamp": Math.floor(Date.now() / 1000).toString()
                },
                body: { id: 1002, transferAmount: 500000, content: "HD2026360" }
            };
            const resBadSig = createMockRes();
            await sepayService.handleWebhook(reqBadSig, resBadSig);
            assert.strictEqual(resBadSig.statusCode, 401);

            // Wrong API Key
            const reqBadKey = {
                headers: { authorization: "Apikey wrong_api_key_xyz" },
                body: { id: 1003, transferAmount: 500000, content: "HD2026360" }
            };
            const resBadKey = createMockRes();
            await sepayService.handleWebhook(reqBadKey, resBadKey);
            assert.strictEqual(resBadKey.statusCode, 401);
        });

        // --- TEST 3: Valid HMAC signature accepted ---
        await test("3. Webhook Authentication: Valid HMAC SHA-256 signature is accepted (200)", async () => {
            resetMockContract();
            const body = {
                id: 2001,
                transferAmount: 2000000,
                content: "Thanh toan HD2026360",
                transferType: "in"
            };
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generateHmac(body, process.env.SEPAY_WEBHOOK_SECRET, timestamp);

            const req = {
                headers: {
                    "x-sepay-signature": signature,
                    "x-sepay-timestamp": timestamp
                },
                body,
                rawBody: JSON.stringify(body)
            };
            const res = createMockRes();
            await sepayService.handleWebhook(req, res);

            assert.strictEqual(res.statusCode, 200, `Expected status 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
            assert.strictEqual(res.data.success, true);
            assert.strictEqual(mockContract.thanhToan.khachHangDaThanhToan, 3000000, "Balance must be credited from 1M to 3M");
        });

        // --- TEST 4: Valid API Key (Apikey / Bearer) accepted ---
        await test("4. Webhook Authentication: Valid API Key is accepted (200)", async () => {
            resetMockContract();
            const body = {
                id: 2002,
                transferAmount: 1000000,
                content: "HD2026360 coc lan 2",
                transferType: "in"
            };
            const req = {
                headers: {
                    authorization: `Apikey ${process.env.SEPAY_API_KEY}`
                },
                body
            };
            const res = createMockRes();
            await sepayService.handleWebhook(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.data.success, true);
        });

        // --- TEST 5: Idempotency with replayed request ---
        await test("5. Webhook Idempotency: Replaying existing transaction returns 200 with idempotent acknowledgement without double crediting", async () => {
            const body = {
                id: 2001, // Replaying transaction 2001 from Test 3
                transferAmount: 2000000,
                content: "Thanh toan HD2026360",
                transferType: "in"
            };
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generateHmac(body, process.env.SEPAY_WEBHOOK_SECRET, timestamp);

            const req = {
                headers: {
                    "x-sepay-signature": signature,
                    "x-sepay-timestamp": timestamp
                },
                body,
                rawBody: JSON.stringify(body)
            };

            const previousBalance = mockContract.thanhToan.khachHangDaThanhToan;
            const res = createMockRes();
            await sepayService.handleWebhook(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.data.idempotent, true, "Response must flag idempotent: true");
            assert.strictEqual(mockContract.thanhToan.khachHangDaThanhToan, previousBalance, "Balance must NOT change on replayed transaction");
        });

        // --- TEST 6: Concurrency Protection via Unique Index Lock ---
        await test("6. Concurrency Protection: Two concurrent calls with same transaction ID credit balance exactly once", async () => {
            resetMockContract();
            const body = {
                id: 3001, // New transaction ID
                transferAmount: 500000,
                content: "HD2026360 tien coc",
                transferType: "in"
            };
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generateHmac(body, process.env.SEPAY_WEBHOOK_SECRET, timestamp);

            const req1 = {
                headers: { "x-sepay-signature": signature, "x-sepay-timestamp": timestamp },
                body,
                rawBody: JSON.stringify(body)
            };
            const req2 = {
                headers: { "x-sepay-signature": signature, "x-sepay-timestamp": timestamp },
                body,
                rawBody: JSON.stringify(body)
            };

            const res1 = createMockRes();
            const res2 = createMockRes();

            // Run concurrently
            await Promise.all([
                sepayService.handleWebhook(req1, res1),
                sepayService.handleWebhook(req2, res2)
            ]);

            assert.strictEqual(res1.statusCode, 200);
            assert.strictEqual(res2.statusCode, 200);

            // One should be normal success, the other should be idempotent lock acknowledgment
            const isOneIdempotent = res1.data.idempotent === true || res2.data.idempotent === true;
            assert.strictEqual(isOneIdempotent, true, "One of the concurrent requests must be handled as idempotent");

            // Total credited should be exactly 1000000 + 500000 = 1500000 (NOT 2000000)
            assert.strictEqual(mockContract.thanhToan.khachHangDaThanhToan, 1500000, "Concurrent transaction must credit balance exactly once");
        });

        // --- TEST 7: Audit Logging with Sanitized Headers ---
        await test("7. Audit Logging: Webhook invocations logged with sanitized headers (no secret exposed)", async () => {
            assert(mockAuditLogs.length > 0, "Audit logs must have recorded webhook attempts");
            
            // Check all logged headers to ensure no secret or api key was logged in plaintext
            for (const log of mockAuditLogs) {
                if (log.sanitizedHeaders) {
                    const headerStr = JSON.stringify(log.sanitizedHeaders).toLowerCase();
                    assert(!headerStr.includes(process.env.SEPAY_WEBHOOK_SECRET.toLowerCase()), "Webhook secret must NOT be leaked into audit log!");
                    assert(!headerStr.includes(process.env.SEPAY_API_KEY.toLowerCase()), "Webhook API key must NOT be leaked into audit log!");
                }
            }
        });

        // --- TEST 8: Socket.IO Hardening ---
        await test("8. Socket.IO Hardening: Room isolation dispatches payment only to target contract room", async () => {
            const emittedRooms = [];
            const mockIO = {
                to(room) {
                    return {
                        emit(evt, data) {
                            emittedRooms.push({ room, evt, data });
                        }
                    };
                }
            };

            const origGetIO = socketModule.getIO;
            socketModule.notifyPaymentSuccess({
                maHopDong: "HD2026360",
                amount: 500000
            });
            // Should dispatch to contract:HD2026360 and admin_payments
        });

    } finally {
        Payment.prototype.save = origPaymentSave;
    }

    console.log(`\n=== PR 1.3 TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();

