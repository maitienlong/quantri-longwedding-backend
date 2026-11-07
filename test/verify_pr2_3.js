/**
 * PR 2.3 Automated Verification Test Suite
 * Discount, Voucher & Price Calculation Alignment (M03, LW2-019, LW2-020)
 * 
 * Verifications:
 * 1. Pricing Engine: Cart items (with item discount) + Add-ons (phuLucPhatSinh) + % Contract Discount + Voucher.
 * 2. Pricing Engine: Fixed VND Contract Discount + Voucher + Clamp against negative totals.
 * 3. Contract List Alignment: ensurePaymentProgress accurately factors in phuLucPhatSinh and vouchers.
 * 4. Voucher Service Validation: Validates active dates, minOrderValue, maxDiscount cap, and inactive state.
 * 5. Package & Deliverables Snapshot Immutability: Mutating DichVu catalog does NOT alter contract snapshot.
 * 6. Migration M03: Dry-run detects discrepancies, Apply repairs and backfills snapshots, Verify is idempotent.
 */

const assert = require("assert");
const HOPDONG = require("../src/models/hopDong.model");
const DICHVU = require("../src/models/dichVu.model");
const Voucher = require("../src/models/voucher.model");
const hopDongService = require("../src/services/hopDong.service");
const voucherService = require("../src/services/voucher.service");
const {
    calculateContractPricing,
    applyPricingToContract,
    snapshotContractPackage,
    reconcileContractPricing
} = require("../src/services/contractPricing");

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
    console.log("=== STARTING PR 2.3 AUTOMATED VERIFICATION ===");
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

    const mockContracts = new Map();
    const mockServices = new Map();
    const mockVouchers = new Map();

    const origHopDongFind = HOPDONG.find;
    const origHopDongFindOne = HOPDONG.findOne;
    const origHopDongUpdateOne = HOPDONG.updateOne;
    const origDichVuFindById = DICHVU.findById;
    const origVoucherFind = Voucher.find;
    const origVoucherFindOne = Voucher.findOne;

    HOPDONG.find = async (query = {}) => {
        return Array.from(mockContracts.values());
    };

    HOPDONG.findOne = async (query = {}) => {
        if (query.maHopDong) {
            for (const c of mockContracts.values()) {
                if (c.maHopDong === query.maHopDong) return c;
            }
        }
        if (query._id) return mockContracts.get(query._id) || null;
        return null;
    };

    HOPDONG.updateOne = async (query, update) => {
        const contract = mockContracts.get(query._id);
        if (contract && update.$set) {
            for (const [key, val] of Object.entries(update.$set)) {
                if (key.startsWith("thanhToan.")) {
                    const subField = key.replace("thanhToan.", "");
                    if (!contract.thanhToan) contract.thanhToan = {};
                    contract.thanhToan[subField] = val;
                } else {
                    contract[key] = val;
                }
            }
        }
        return { modifiedCount: 1 };
    };

    DICHVU.findById = async (id) => {
        return mockServices.get(String(id)) || null;
    };

    Voucher.findOne = async (query = {}) => {
        if (query.$or) {
            for (const cond of query.$or) {
                if (cond.code && mockVouchers.has(cond.code.toUpperCase())) {
                    return mockVouchers.get(cond.code.toUpperCase());
                }
            }
        }
        if (query.code && mockVouchers.has(query.code.toUpperCase())) {
            return mockVouchers.get(query.code.toUpperCase());
        }
        return null;
    };

    try {
        // Test 1: Unified pricing calculation with % discount + voucher + addons
        await test("1. Pricing Engine: Cart items + Add-ons + % Discount + Voucher", () => {
            const contractData = {
                gioHang: [
                    { donGia: 10000000, soLuong: 1, giamGiaDichVu: 1000000 } // 9,000,000
                ],
                phuLucPhatSinh: [
                    { donGia: 2000000, soLuong: 1 } // 2,000,000
                ],
                thanhToan: {
                    giamGia: 10,        // 10%
                    loaiGiamGia: 1,     // %
                    voucherGiamGia: 500000,
                    cacLuotThanhToan: [
                        { amount: 3000000 }
                    ]
                }
            };

            const result = calculateContractPricing(contractData);
            // tongCart = 9,000,000
            // tongPhatSinh = 2,000,000
            // tongGiaTri = 11,000,000
            // soTienGiamHopDong = 11,000,000 * 10% = 1,100,000
            // voucherGiamGia = 500,000
            // tongGiamGia = 1,600,000
            // tongGiaTriSauGiam = 11,000,000 - 1,600,000 = 9,400,000
            // khachHangDaThanhToan = 3,000,000
            // conLai = 6,400,000
            // phanTramDaThanhToan = (3,000,000 / 9,400,000) * 100 = 31.9%
            assert.strictEqual(result.tongCart, 9000000);
            assert.strictEqual(result.tongPhatSinh, 2000000);
            assert.strictEqual(result.tongGiaTri, 11000000);
            assert.strictEqual(result.soTienGiamHopDong, 1100000);
            assert.strictEqual(result.tongGiamGia, 1600000);
            assert.strictEqual(result.tongGiaTriSauGiam, 9400000);
            assert.strictEqual(result.khachHangDaThanhToan, 3000000);
            assert.strictEqual(result.conLai, 6400000);
            assert.strictEqual(result.phanTramDaThanhToan, 31.9);
            assert.strictEqual(result.trangThaiThanhToan, "Đang thanh toán");
        });

        // Test 2: Fixed VND discount + Voucher + Negative clamp
        await test("2. Pricing Engine: Fixed VND Discount + Voucher + Zero/Negative Clamp", () => {
            const contractData = {
                gioHang: [
                    { donGia: 5000000, soLuong: 1, giamGiaDichVu: 0 }
                ],
                thanhToan: {
                    giamGia: 3000000,    // 3,000,000 VND
                    loaiGiamGia: 0,     // VND
                    voucherGiamGia: 4000000, // 4,000,000 VND -> total discount = 7,000,000 > 5,000,000
                    cacLuotThanhToan: []
                }
            };

            const result = calculateContractPricing(contractData);
            // tongGiaTri = 5,000,000
            // tongGiamGia = 7,000,000
            // tongGiaTriSauGiam must clamp to 0, NOT -2,000,000
            assert.strictEqual(result.tongGiaTri, 5000000);
            assert.strictEqual(result.tongGiaTriSauGiam, 0);
            assert.strictEqual(result.conLai, 0);
            assert.strictEqual(result.trangThaiThanhToan, "Đã thanh toán đủ");
        });

        // Test 3: ensurePaymentProgress accurately reflects phuLucPhatSinh
        await test("3. Contract List Alignment: ensurePaymentProgress reflects phuLucPhatSinh and vouchers", () => {
            const rawContract = {
                maHopDong: "HD-PR23-01",
                gioHang: [
                    { donGia: 10000000, soLuong: 1, giamGiaDichVu: 0 }
                ],
                phuLucPhatSinh: [
                    { tenDichVu: "Ảnh phóng thêm 60x90", donGia: 1500000, soLuong: 2 } // 3,000,000
                ],
                thanhToan: {
                    giamGia: 1000000,
                    loaiGiamGia: 0,
                    voucherGiamGia: 500000,
                    cacLuotThanhToan: [
                        { amount: 5000000 }
                    ]
                }
            };

            // Call hopDongService.ensurePaymentProgress
            const processed = hopDongService.ensurePaymentProgress(rawContract);
            // tongGiaTri = 10,000,000 + 3,000,000 = 13,000,000
            // tongPhatSinh = 3,000,000
            // tongGiaTriSauGiam = 13,000,000 - 1,500,000 = 11,500,000
            // paid = 5,000,000
            // conLai = 6,500,000
            assert.strictEqual(processed.thanhToan.tongGiaTri, 13000000);
            assert.strictEqual(processed.thanhToan.tongPhatSinh, 3000000);
            assert.strictEqual(processed.thanhToan.tongGiaTriSauGiam, 11500000);
            assert.strictEqual(processed.thanhToan.conLai, 6500000);
        });

        // Test 4: Voucher Validation Service
        await test("4. Voucher Service: Validates date, minOrderValue, maxDiscount cap, and inactive status", async () => {
            mockVouchers.clear();

            // 1. Inactive voucher
            mockVouchers.set("VOUCHER_INACTIVE", {
                code: "VOUCHER_INACTIVE",
                title: "Ưu đãi tạm dừng",
                isActive: false,
                discountType: 0,
                discountValue: 500000
            });

            // 2. Expired voucher
            mockVouchers.set("VOUCHER_EXPIRED", {
                code: "VOUCHER_EXPIRED",
                title: "Ưu đãi hết hạn",
                isActive: true,
                discountType: 0,
                discountValue: 500000,
                endDate: new Date(Date.now() - 86400000)
            });

            // 3. Percentage voucher with maxDiscount cap and minOrderValue
            mockVouchers.set("VOUCHER_PERCENT_CAP", {
                code: "VOUCHER_PERCENT_CAP",
                title: "Giảm 20% tối đa 1 triệu",
                isActive: true,
                discountType: 1, // %
                discountValue: 20, // 20%
                maxDiscount: 1000000, // max 1,000,000
                minOrderValue: 5000000 // min 5,000,000
            });

            // Check Inactive
            const reqInactive = { body: { code: "VOUCHER_INACTIVE", orderTotal: 10000000 } };
            const resInactive = createMockRes();
            await voucherService.validateVoucher(reqInactive, resInactive);
            assert.strictEqual(resInactive.statusCode, 400);
            assert(resInactive.data.message.includes("tạm ngừng"));

            // Check Expired
            const reqExpired = { body: { code: "VOUCHER_EXPIRED", orderTotal: 10000000 } };
            const resExpired = createMockRes();
            await voucherService.validateVoucher(reqExpired, resExpired);
            assert.strictEqual(resExpired.statusCode, 400);
            assert(resExpired.data.message.includes("hết hạn"));

            // Check Min Order Value Failure
            const reqMinOrderFail = { body: { code: "VOUCHER_PERCENT_CAP", orderTotal: 3000000 } };
            const resMinOrderFail = createMockRes();
            await voucherService.validateVoucher(reqMinOrderFail, resMinOrderFail);
            assert.strictEqual(resMinOrderFail.statusCode, 400);
            assert(resMinOrderFail.data.message.includes("tối thiểu"));

            // Check Valid with Cap: 20% of 10,000,000 is 2,000,000, but capped at 1,000,000
            const reqValid = { body: { code: "VOUCHER_PERCENT_CAP", orderTotal: 10000000 } };
            const resValid = createMockRes();
            await voucherService.validateVoucher(reqValid, resValid);
            assert.strictEqual(resValid.statusCode, 200);
            assert.strictEqual(resValid.data.data.discountAmount, 1000000);
            assert.strictEqual(resValid.data.data.finalTotal, 9000000);
        });

        // Test 5: Package & Deliverables Snapshot Immutability
        await test("5. Snapshot Immutability: Mutating DichVu catalog does NOT alter contract snapshot", () => {
            const dichVuCatalog = {
                _id: "service_vip_01",
                tenDichVu: "Gói VIP Kim Cương",
                giaTriDichVu: 25000000,
                details: {
                    deliverables: [
                        { kind: "photo_print", name: "Ảnh cổng 60x90", widthCm: 60, heightCm: 90, quantity: 1, material: "Tráng gương" },
                        { kind: "photo_table", name: "Ảnh bàn 20x30", widthCm: 20, heightCm: 30, quantity: 2, material: "Gỗ composite" },
                        { kind: "album", name: "Album 30x30", widthCm: 30, heightCm: 30, quantity: 1, material: "Da cao cấp" }
                    ]
                }
            };

            const cartItem = {
                dichVu: "service_vip_01",
                soLuong: 1
            };

            // Snapshot service into cart item
            snapshotContractPackage(cartItem, dichVuCatalog);

            assert.strictEqual(cartItem.tenDichVuSnapshot, "Gói VIP Kim Cương");
            assert.strictEqual(cartItem.donGia, 25000000);
            assert.strictEqual(cartItem.detailsSnapshot.deliverables.length, 3);
            assert.strictEqual(cartItem.detailsSnapshot.deliverables[0].name, "Ảnh cổng 60x90");

            // Later, studio changes the catalog (increases price to 30,000,000 and removes a deliverable)
            dichVuCatalog.giaTriDichVu = 30000000;
            dichVuCatalog.details.deliverables.pop();

            // The contract's cartItem MUST remain unchanged
            assert.strictEqual(cartItem.donGia, 25000000, "Contract unit price must remain unchanged");
            assert.strictEqual(cartItem.detailsSnapshot.deliverables.length, 3, "Contract deliverables count must remain 3");
            assert.strictEqual(dichVuCatalog.details.deliverables.length, 2, "Catalog was mutated to 2");
        });

        // Test 6: Migration M03 Dry-Run, Apply, and Idempotency
        await test("6. Migration M03: Detects pricing discrepancies, backfills snapshots, and verify is idempotent", async () => {
            mockContracts.clear();
            mockServices.clear();

            mockServices.set("srv_01", {
                _id: "srv_01",
                tenDichVu: "Gói Studio Standard",
                giaTriDichVu: 8000000,
                details: {
                    deliverables: [
                        { kind: "photo_print", widthCm: 60, heightCm: 90, quantity: 1 }
                    ]
                }
            });

            // Create a contract with out-of-sync totals and missing detailsSnapshot
            const c1 = {
                _id: "c_m03_1",
                maHopDong: "HD-M03-01",
                gioHang: [
                    {
                        dichVu: "srv_01",
                        tenDichVuSnapshot: "Gói Studio Standard",
                        donGia: 8000000,
                        soLuong: 1,
                        thanhTien: 8000000
                        // missing detailsSnapshot
                    }
                ],
                phuLucPhatSinh: [
                    { donGia: 1000000, soLuong: 1, thanhTien: 1000000 }
                ],
                thanhToan: {
                    tongGiaTri: 8000000,        // WRONG: missing 1,000,000 addon (should be 9,000,000)
                    tongPhatSinh: 0,            // WRONG: should be 1,000,000
                    giamGia: 500000,
                    loaiGiamGia: 0,
                    tongGiaTriSauGiam: 7500000,  // WRONG: should be 8,500,000
                    khachHangDaThanhToan: 2000000,
                    conLai: 5500000              // WRONG: should be 6,500,000
                }
            };
            mockContracts.set("c_m03_1", c1);

            // 1. Dry run: should detect discrepancies without writing
            const dryRunReport = await reconcileContractPricing({ dryRun: true });
            assert.strictEqual(dryRunReport.discrepanciesFound, 1, "Should find 1 contract with discrepancies");
            assert.strictEqual(dryRunReport.repairedContracts, 0, "Dry run must repair 0 contracts");

            // Verify contract not yet mutated
            assert.strictEqual(c1.thanhToan.tongGiaTri, 8000000);

            // 2. Apply: repairs pricing and backfills detailsSnapshot & packageSnapshot
            const applyReport = await reconcileContractPricing({ dryRun: false });
            assert.strictEqual(applyReport.repairedContracts, 1, "Apply must repair 1 contract");
            assert.strictEqual(applyReport.snapshotsBackfilled, 1, "Should backfill 1 cart item snapshot");

            // Verify contract values are fixed
            assert.strictEqual(c1.thanhToan.tongGiaTri, 9000000);
            assert.strictEqual(c1.thanhToan.tongPhatSinh, 1000000);
            assert.strictEqual(c1.thanhToan.tongGiaTriSauGiam, 8500000);
            assert.strictEqual(c1.thanhToan.conLai, 6500000);
            assert(c1.gioHang[0].detailsSnapshot !== null, "detailsSnapshot must be backfilled");
            assert(c1.packageSnapshot !== null, "packageSnapshot must be backfilled");

            // 3. Verify (Idempotency): subsequent run reports 0 discrepancies
            const verifyReport = await reconcileContractPricing({ dryRun: true });
            assert.strictEqual(verifyReport.discrepanciesFound, 0, "Subsequent run must find 0 discrepancies");
        });

    } finally {
        HOPDONG.find = origHopDongFind;
        HOPDONG.findOne = origHopDongFindOne;
        HOPDONG.updateOne = origHopDongUpdateOne;
        DICHVU.findById = origDichVuFindById;
        Voucher.find = origVoucherFind;
        Voucher.findOne = origVoucherFindOne;
    }

    console.log(`\nPR 2.3 SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();

