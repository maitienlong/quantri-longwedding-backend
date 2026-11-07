/**
 * PR 2.2 Automated Verification Test Suite - Contract Lifecycle State Machine
 * 
 * Verifications:
 * 1. Invalid Stage Range: Stages outside 1..4 return 400.
 * 2. Forward Stage Skipping: Jumping > 1 stage (e.g., 1 -> 3, 1 -> 4) without manager permission is blocked with 400.
 * 3. Stage 3 (In ảnh) Photo Approval Gate: Blocked if client has not approved photos and no print list exists.
 * 4. Stage 4 (Hoàn thành) Debt Gate: Blocked if remaining balance > 0 (debt not cleared).
 * 5. Cancellation Gate: Only managers can cancel; must supply a cancellation reason.
 * 6. Audit Trail: Every transition records to lichSuGiaiDoan, auditLog, and updates thoiGianChuyenGiaiDoan.
 * 7. Migration M02 Idempotency: Scans, fixes corrupt stage data, and subsequent run produces 0 discrepancies.
 */

const assert = require("assert");
const HOPDONG = require("../src/models/hopDong.model");
const Album = require("../src/models/album.model");
const hopDongService = require("../src/services/hopDong.service");
const { validateTransition, normalizeSubStage, reconcileContractStages } = require("../src/services/contractStateMachine");

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
    console.log("=== STARTING PR 2.2 AUTOMATED VERIFICATION ===");
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
    const mockAlbums = new Map();

    const origHopDongFind = HOPDONG.find;
    const origHopDongFindOne = HOPDONG.findOne;
    const origHopDongUpdateOne = HOPDONG.updateOne;
    const origAlbumFindOne = Album.findOne;

    HOPDONG.find = async (query = {}) => {
        let list = Array.from(mockContracts.values());
        if (query.maHopDong) {
            list = list.filter(c => c.maHopDong === query.maHopDong);
        }
        return list;
    };

    HOPDONG.findOne = async (query = {}) => {
        if (query.maHopDong) {
            for (const c of mockContracts.values()) {
                if (c.maHopDong === query.maHopDong) return c;
            }
        }
        if (query._id) {
            return mockContracts.get(query._id) || null;
        }
        return null;
    };

    HOPDONG.updateOne = async (query, update) => {
        const contract = mockContracts.get(query._id);
        if (contract && update.$set) {
            Object.assign(contract, update.$set);
        }
        return { modifiedCount: 1 };
    };

    Album.findOne = async (query = {}) => {
        if (query.maHopDong) {
            return mockAlbums.get(query.maHopDong) || null;
        }
        return null;
    };

    function createMockContract(data) {
        const doc = {
            _id: data._id || `id_${Date.now()}_${Math.random()}`,
            maHopDong: data.maHopDong || "HD-TEST-01",
            giaiDoan: data.giaiDoan !== undefined ? data.giaiDoan : 1,
            subGiaiDoan: data.subGiaiDoan || "dang_thuc_hien",
            thanhToan: data.thanhToan || {
                tongGiaTri: 10000000,
                khachHangDaThanhToan: 3000000,
                conLai: 7000000,
                trangThaiThanhToan: "Chưa thanh toán đủ"
            },
            khachHangXacNhanAnh: data.khachHangXacNhanAnh || { daXacNhan: false },
            danhSachAnhIn: data.danhSachAnhIn || [],
            lichSuGiaiDoan: data.lichSuGiaiDoan || [],
            auditLog: data.auditLog || [],
            async save() {
                mockContracts.set(this._id, this);
                return this;
            }
        };
        mockContracts.set(doc._id, doc);
        return doc;
    }

    try {
        // Test 1: Invalid Stage Range
        await test("1. Stage Validation: Reject invalid stage numbers (< 1 or > 4)", async () => {
            const contract = createMockContract({ maHopDong: "HD-STAGE-01", giaiDoan: 1 });
            const req = {
                body: { maHopDong: "HD-STAGE-01", giaiDoan: 5 },
                user: { username: "staff1", chucVu: "Nhân viên", permission: 0 }
            };
            const res = createMockRes();
            await hopDongService.updateProgress(req, res);

            assert.strictEqual(res.statusCode, 400, "Should return 400 for stage 5");
            assert(res.data.message.includes("không hợp lệ"), "Error message should mention invalid stage");
        });

        // Test 2: Skip-Stage Prevention
        await test("2. Stage Skipping: Staff cannot skip from Stage 1 directly to Stage 3 or 4", async () => {
            const contract = createMockContract({ maHopDong: "HD-STAGE-02", giaiDoan: 1 });
            const req = {
                body: { maHopDong: "HD-STAGE-02", giaiDoan: 3 },
                user: { username: "staff1", chucVu: "Nhân viên", permission: 0 }
            };
            const res = createMockRes();
            await hopDongService.updateProgress(req, res);

            assert.strictEqual(res.statusCode, 400, "Should block skip from stage 1 to 3");
            assert(res.data.message.includes("nhảy cóc"), "Should warn about stage skipping");

            // But a Manager can skip or override
            const reqMgr = {
                body: { maHopDong: "HD-STAGE-02", giaiDoan: 3, forceOverride: true },
                user: { username: "manager1", positon: "Quản lý", permission: 1 }
            };
            const resMgr = createMockRes();
            await hopDongService.updateProgress(reqMgr, resMgr);
            assert.strictEqual(resMgr.statusCode, 200, "Manager override should succeed");
            assert.strictEqual(contract.giaiDoan, 3, "Contract should advance to stage 3");
        });

        // Test 3: Stage 3 Photo Approval Gate
        await test("3. Stage 3 Gate: Block transition to Stage 3 if client has not approved photos", async () => {
            const contract = createMockContract({
                maHopDong: "HD-STAGE-03",
                giaiDoan: 2,
                subGiaiDoan: "dang_chinh",
                khachHangXacNhanAnh: { daXacNhan: false },
                danhSachAnhIn: []
            });

            // Staff tries to move to Stage 3 without approval
            const req = {
                body: { maHopDong: "HD-STAGE-03", giaiDoan: 3 },
                user: { username: "staff1", chucVu: "Nhân viên", permission: 0 }
            };
            const res = createMockRes();
            await hopDongService.updateProgress(req, res);

            assert.strictEqual(res.statusCode, 400, "Should return 400 without client approval");
            assert(res.data.message.includes("chưa duyệt"), "Should state photos not approved");

            // Now client approves photos
            contract.khachHangXacNhanAnh.daXacNhan = true;
            const res2 = createMockRes();
            await hopDongService.updateProgress(req, res2);
            assert.strictEqual(res2.statusCode, 200, "Should succeed once photos are approved");
            assert.strictEqual(contract.giaiDoan, 3, "Contract should now be in stage 3");
        });

        // Test 4: Stage 4 Debt Clearance Gate
        await test("4. Stage 4 Gate: Block completion if unpaid balance remains", async () => {
            const contract = createMockContract({
                maHopDong: "HD-STAGE-04",
                giaiDoan: 3,
                subGiaiDoan: "dang_thuc_hien",
                thanhToan: {
                    tongGiaTri: 15000000,
                    khachHangDaThanhToan: 10000000,
                    conLai: 5000000,
                    trangThaiThanhToan: "Chưa thanh toán đủ"
                }
            });

            // Staff tries to complete contract with 5,000,000 debt
            const req = {
                body: { maHopDong: "HD-STAGE-04", giaiDoan: 4, subGiaiDoan: "hoan_thanh" },
                user: { username: "staff1", chucVu: "Nhân viên", permission: 0 }
            };
            const res = createMockRes();
            await hopDongService.updateProgress(req, res);

            assert.strictEqual(res.statusCode, 400, "Should reject completion when balance remains");
            assert(res.data.message.includes("chưa thanh toán đủ"), "Should state unpaid balance");

            // After customer pays off debt (conLai = 0)
            contract.thanhToan.khachHangDaThanhToan = 15000000;
            contract.thanhToan.conLai = 0;
            contract.thanhToan.trangThaiThanhToan = "Đã thanh toán đủ";

            const res2 = createMockRes();
            await hopDongService.updateProgress(req, res2);
            assert.strictEqual(res2.statusCode, 200, "Should succeed once debt is 0");
            assert.strictEqual(contract.giaiDoan, 4);
            assert.strictEqual(contract.subGiaiDoan, "hoan_thanh");
        });

        // Test 5: Cancellation Access Control & Mandatory Reason
        await test("5. Cancellation Gate: Staff cannot cancel contract; Manager requires reason", async () => {
            const contract = createMockContract({ maHopDong: "HD-STAGE-05", giaiDoan: 2 });

            // Staff tries to cancel
            const reqStaff = {
                body: { maHopDong: "HD-STAGE-05", giaiDoan: 2, subGiaiDoan: "huy", data: { ghiChu: "Khách đổi ý" } },
                user: { username: "staff1", chucVu: "Nhân viên", permission: 0 }
            };
            const resStaff = createMockRes();
            await hopDongService.updateProgress(reqStaff, resStaff);
            assert.strictEqual(resStaff.statusCode, 400, "Staff must not be permitted to cancel contract");

            // Manager tries to cancel without reason
            const reqMgrNoReason = {
                body: { maHopDong: "HD-STAGE-05", giaiDoan: 2, subGiaiDoan: "huy", data: { ghiChu: "" } },
                user: { username: "admin", positon: "Admin", permission: 1 }
            };
            const resMgrNoReason = createMockRes();
            await hopDongService.updateProgress(reqMgrNoReason, resMgrNoReason);
            assert.strictEqual(resMgrNoReason.statusCode, 400, "Must require cancellation reason");

            // Manager cancels with proper reason
            const reqMgrOk = {
                body: { maHopDong: "HD-STAGE-05", giaiDoan: 2, subGiaiDoan: "huy", data: { ghiChu: "Khách chuyển địa điểm ra nước ngoài" } },
                user: { username: "admin", positon: "Admin", permission: 1 }
            };
            const resMgrOk = createMockRes();
            await hopDongService.updateProgress(reqMgrOk, resMgrOk);
            assert.strictEqual(resMgrOk.statusCode, 200, "Manager with reason should cancel successfully");
            assert.strictEqual(contract.subGiaiDoan, "huy");
        });

        // Test 6: Audit Trail Integrity
        await test("6. Audit Trail: Verify lichSuGiaiDoan, auditLog, and thoiGianChuyenGiaiDoan", async () => {
            const contract = createMockContract({
                maHopDong: "HD-STAGE-06",
                giaiDoan: 1,
                subGiaiDoan: "dang_thuc_hien"
            });

            const req = {
                body: {
                    maHopDong: "HD-STAGE-06",
                    giaiDoan: 2,
                    subGiaiDoan: "cho_chinh",
                    data: { ghiChu: "Chụp xong đã giao file gốc" }
                },
                user: { username: "photographer", tenNhanVien: "Nguyễn Văn A", chucVu: "Thợ chụp", permission: 0 }
            };
            const res = createMockRes();
            await hopDongService.updateProgress(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(contract.giaiDoan, 2);
            assert.strictEqual(contract.subGiaiDoan, "cho_chinh");

            // Check audit trail
            assert(contract.lichSuGiaiDoan.length > 0, "lichSuGiaiDoan should have recorded entry");
            const history = contract.lichSuGiaiDoan[contract.lichSuGiaiDoan.length - 1];
            assert.strictEqual(history.giaiDoan, 2);
            assert.strictEqual(history.subGiaiDoan, "cho_chinh");
            assert.strictEqual(history.nguoiThucHien, "Nguyễn Văn A");

            assert(contract.auditLog.length > 0, "auditLog should have recorded entry");
            const audit = contract.auditLog[contract.auditLog.length - 1];
            assert.strictEqual(audit.action, "Chuyển tiến trình");
            assert.strictEqual(audit.newValue.giaiDoan, 2);
            assert(contract.thoiGianChuyenGiaiDoan instanceof Date, "thoiGianChuyenGiaiDoan must be set");
        });

        // Test 7: M02 Migration Dry-Run & Apply
        await test("7. Migration M02: Detect and normalize invalid/unaligned stages idempotently", async () => {
            mockContracts.clear();

            // Contract with invalid giaiDoan: 0
            createMockContract({
                _id: "m02_c1",
                maHopDong: "HD-M02-01",
                giaiDoan: 0,
                subGiaiDoan: "random_sub"
            });

            // Contract in stage 1 with out-of-sync subGiaiDoan: "dang_chinh" -> should be "dang_thuc_hien"
            createMockContract({
                _id: "m02_c2",
                maHopDong: "HD-M02-02",
                giaiDoan: 1,
                subGiaiDoan: "dang_chinh"
            });

            // Contract in stage 4 with old subStage: "khach_duyet_anh" -> should be "hoan_thanh"
            createMockContract({
                _id: "m02_c3",
                maHopDong: "HD-M02-03",
                giaiDoan: 4,
                subGiaiDoan: "khach_duyet_anh"
            });

            // 1. Dry run: should detect 3 discrepancies without writing
            const dryRunReport = await reconcileContractStages({ dryRun: true });
            assert.strictEqual(dryRunReport.discrepanciesFound, 3, "Dry run should detect all 3 unnormalized contracts");
            assert.strictEqual(dryRunReport.repairedContracts, 0, "Dry run should repair 0 contracts");

            // Verify contracts were not modified
            assert.strictEqual(mockContracts.get("m02_c1").giaiDoan, 0);

            // 2. Apply: should fix all 3 contracts
            const applyReport = await reconcileContractStages({ dryRun: false });
            assert.strictEqual(applyReport.repairedContracts, 3, "Apply should repair 3 contracts");

            // Verify fixed values
            assert.strictEqual(mockContracts.get("m02_c1").giaiDoan, 1);
            assert.strictEqual(mockContracts.get("m02_c1").subGiaiDoan, "dang_thuc_hien");
            assert.strictEqual(mockContracts.get("m02_c2").subGiaiDoan, "dang_thuc_hien");
            assert.strictEqual(mockContracts.get("m02_c3").subGiaiDoan, "hoan_thanh");

            // 3. Re-run (Idempotency): should find 0 discrepancies
            const verifyReport = await reconcileContractStages({ dryRun: true });
            assert.strictEqual(verifyReport.discrepanciesFound, 0, "Re-run after migration should find 0 discrepancies");
        });

    } finally {
        HOPDONG.find = origHopDongFind;
        HOPDONG.findOne = origHopDongFindOne;
        HOPDONG.updateOne = origHopDongUpdateOne;
        Album.findOne = origAlbumFindOne;
    }

    console.log(`\nPR 2.2 SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
