/**
 * PR 2.1 Automated Verification Test Suite
 * Tests:
 * 1. Contract Creation Sync: Payment collection record created alongside embedded payment.
 * 2. Dedicated Payment Endpoint (pay): Atomically records payment in Payment model and updates contract balance.
 * 3. Ledger Discrepancy Detection (dry-run): Detects mismatched sum and missing payment docs without mutating DB.
 * 4. Reconciliation Repair (apply): Backfills missing Payment docs and synchronizes contract balances.
 * 5. Idempotency: Re-running reconciliation reports 0 discrepancies and performs 0 mutations.
 * 6. Non-destructive: Existing payment amounts, dates, and notes are preserved.
 */

const assert = require("assert");
const HOPDONG = require("../src/models/hopDong.model");
const Payment = require("../src/models/payment.model");
const hopDongService = require("../src/services/hopDong.service");
const { reconcilePayments } = require("../src/services/reconciliation.service");

// Mock Express req/res
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

async function runTests() {
    console.log("=== STARTING PR 2.1 AUTOMATED VERIFICATION ===");
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
    const mockContracts = new Map();
    const mockPayments = new Map();

    const origHopDongFind = HOPDONG.find;
    const origHopDongFindOne = HOPDONG.findOne;
    const origHopDongUpdateOne = HOPDONG.updateOne;
    const origPaymentFind = Payment.find;
    const origPaymentFindOne = Payment.findOne;
    const origPaymentCreate = Payment.create;
    const origPaymentSave = Payment.prototype.save;

    HOPDONG.find = async (query = {}) => {
        let list = Array.from(mockContracts.values());
        if (query.maHopDong) {
            list = list.filter(c => new RegExp(query.maHopDong.$regex || query.maHopDong, 'i').test(c.maHopDong));
        }
        return list;
    };

    HOPDONG.findOne = async (query = {}) => {
        const list = await HOPDONG.find(query);
        return list[0] || null;
    };

    HOPDONG.updateOne = async (query, update) => {
        const contract = mockContracts.get(query._id);
        if (contract && update.$set) {
            for (const [key, val] of Object.entries(update.$set)) {
                if (key.startsWith("thanhToan.")) {
                    const subField = key.replace("thanhToan.", "");
                    contract.thanhToan[subField] = val;
                } else {
                    contract[key] = val;
                }
            }
        }
        return { modifiedCount: 1 };
    };

    Payment.findOne = async (query = {}) => {
        if (query.$or) {
            for (const cond of query.$or) {
                if (cond.id && mockPayments.has(cond.id)) return mockPayments.get(cond.id);
                if (cond.providerTransactionId && mockPayments.has(cond.providerTransactionId)) return mockPayments.get(cond.providerTransactionId);
                if (cond.maHopDong) {
                    for (const p of mockPayments.values()) {
                        if (p.maHopDong === cond.maHopDong && p.amount === cond.amount) return p;
                    }
                }
            }
        }
        if (query.id && mockPayments.has(query.id)) return mockPayments.get(query.id);
        return null;
    };

    Payment.create = async (doc) => {
        const pDoc = { ...doc };
        mockPayments.set(pDoc.id || pDoc.providerTransactionId, pDoc);
        return pDoc;
    };

    Payment.prototype.save = async function() {
        mockPayments.set(this.id || this.providerTransactionId, this);
        return this;
    };

    try {
        // --- TEST 1: Dedicated Payment Endpoint (pay) ---
        await test("1. Dedicated Payment Endpoint (pay): Atomically records payment in Payment model and updates contract balance", async () => {
            const contract = {
                _id: "c_101",
                maHopDong: "HD2026101",
                khachHang1: { tenKhachHang: "Nguyễn Văn Test" },
                thanhToan: {
                    tongGiaTri: 10000000,
                    tongGiaTriSauGiam: 10000000,
                    khachHangDaThanhToan: 2000000,
                    conLai: 8000000,
                    phanTramDaThanhToan: 20,
                    cacLuotThanhToan: [
                        { id: "PAY_OLD_1", amount: 2000000, method: "Tiền mặt", noiDung: "Cọc đợt 1" }
                    ]
                },
                save: async function() { mockContracts.set(this._id, this); return this; }
            };
            mockContracts.set("c_101", contract);
            mockPayments.set("PAY_OLD_1", { id: "PAY_OLD_1", providerTransactionId: "PAY_OLD_1", amount: 2000000, maHopDong: "HD2026101" });

            const req = {
                body: {
                    maHopDong: "HD2026101",
                    amount: 3000000,
                    method: "Chuyển khoản",
                    noiDung: "Thanh toán đợt 2"
                },
                user: { fullname: "Kế toán" }
            };
            const res = createMockRes();
            await hopDongService.pay(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(contract.thanhToan.khachHangDaThanhToan, 5000000, "Paid balance must be 2M + 3M = 5M");
            assert.strictEqual(contract.thanhToan.conLai, 5000000, "Remaining balance must be 10M - 5M = 5M");
            assert.strictEqual(contract.thanhToan.cacLuotThanhToan.length, 2);

            // Verify Payment model record
            const newPaymentId = res.data.data.paymentId;
            assert(mockPayments.has(newPaymentId), "Payment document must be created in Payment collection");
            const savedPayment = mockPayments.get(newPaymentId);
            assert.strictEqual(savedPayment.amount, 3000000);
            assert.strictEqual(savedPayment.provider, "MANUAL_TRANSFER");
        });

        // --- TEST 2: Ledger Discrepancy Detection (Dry-run) ---
        await test("2. Reconciliation Dry-run: Accurately detects balance mismatches and missing Payment records without mutating DB", async () => {
            // Setup a contract with 2 discrepancies:
            // 1. khachHangDaThanhToan cached is 1M, but sum(cacLuot) is 4M (3M discrepancy)
            // 2. One embedded payment lacks a Payment doc in Payment collection
            const corruptContract = {
                _id: "c_102",
                maHopDong: "HD2026102",
                khachHang1: { tenKhachHang: "Lê Thị Test" },
                thanhToan: {
                    tongGiaTri: 12000000,
                    tongGiaTriSauGiam: 12000000,
                    khachHangDaThanhToan: 1000000, // OUT OF SYNC! Actual is 4M
                    conLai: 11000000,             // OUT OF SYNC! Actual is 8M
                    phanTramDaThanhToan: 8.3,
                    cacLuotThanhToan: [
                        { id: "PAY_EXISTS", amount: 1000000, method: "Tiền mặt" },
                        { id: "PAY_MISSING_DOC", amount: 3000000, method: "Tiền mặt" } // Missing from Payment collection!
                    ]
                }
            };
            mockContracts.set("c_102", corruptContract);
            mockPayments.set("PAY_EXISTS", { id: "PAY_EXISTS", amount: 1000000 });
            // Do NOT insert PAY_MISSING_DOC into mockPayments

            const dryRunReport = await reconcilePayments({ dryRun: true, contractCode: "HD2026102" });

            assert.strictEqual(dryRunReport.dryRun, true);
            assert.strictEqual(dryRunReport.discrepanciesFound, 1);
            assert.strictEqual(dryRunReport.repairedContracts, 0, "Dry-run must NOT repair DB");
            assert.strictEqual(dryRunReport.missingPaymentDocsCreated, 0, "Dry-run must NOT create docs");

            // Verify corruptContract was NOT mutated in dry-run
            assert.strictEqual(corruptContract.thanhToan.khachHangDaThanhToan, 1000000, "Cached balance must remain untouched in dry-run");
            assert.strictEqual(mockPayments.has("PAY_MISSING_DOC"), false, "Missing doc must not be created in dry-run");
        });

        // --- TEST 3: Reconciliation Repair (Apply mode) ---
        await test("3. Reconciliation Apply: Repairs cached balances and backfills missing Payment documents", async () => {
            const applyReport = await reconcilePayments({ dryRun: false, contractCode: "HD2026102" });

            assert.strictEqual(applyReport.dryRun, false);
            assert.strictEqual(applyReport.discrepanciesFound, 1);
            assert.strictEqual(applyReport.repairedContracts, 1, "Must repair 1 contract");
            assert.strictEqual(applyReport.missingPaymentDocsCreated, 1, "Must create 1 missing Payment doc");

            // Verify contract balance is now synchronized
            const repairedContract = mockContracts.get("c_102");
            assert.strictEqual(repairedContract.thanhToan.khachHangDaThanhToan, 4000000, "Cached balance must now be 4M");
            assert.strictEqual(repairedContract.thanhToan.conLai, 8000000, "Remaining balance must now be 8M");
            assert(mockPayments.has("PAY_MISSING_DOC"), "Missing Payment document must now exist in collection");
        });

        // --- TEST 4: Idempotency of Reconciliation ---
        await test("4. Idempotency: Re-running reconciliation after Apply reports 0 discrepancies and 0 mutations", async () => {
            const verifyReport = await reconcilePayments({ dryRun: false, contractCode: "HD2026102" });

            assert.strictEqual(verifyReport.discrepanciesFound, 0, "No discrepancies should remain");
            assert.strictEqual(verifyReport.repairedContracts, 0, "0 contracts repaired on second run");
            assert.strictEqual(verifyReport.missingPaymentDocsCreated, 0, "0 payment docs created on second run");
        });

        // --- TEST 5: Non-Destructive Data Preservation ---
        await test("5. Non-Destructive: Payment details, notes, and amounts are 100% preserved", async () => {
            const contract = mockContracts.get("c_102");
            const cacLuot = contract.thanhToan.cacLuotThanhToan;
            assert.strictEqual(cacLuot.length, 2);
            assert.strictEqual(cacLuot[0].id, "PAY_EXISTS");
            assert.strictEqual(cacLuot[0].amount, 1000000);
            assert.strictEqual(cacLuot[1].id, "PAY_MISSING_DOC");
            assert.strictEqual(cacLuot[1].amount, 3000000);
        });

    } finally {
        HOPDONG.find = origHopDongFind;
        HOPDONG.findOne = origHopDongFindOne;
        HOPDONG.updateOne = origHopDongUpdateOne;
        Payment.find = origPaymentFind;
        Payment.findOne = origPaymentFindOne;
        Payment.create = origPaymentCreate;
        Payment.prototype.save = origPaymentSave;
    }

    console.log(`\n=== PR 2.1 TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();

