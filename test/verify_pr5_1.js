/**
 * PR 5.1 Automated Verification Test Suite
 * Print Deliverables, Factory Tracking & QC Acceptance Gate (LW2-050, MOD-07, T-PRINT01)
 * 
 * Verifications:
 * 1. T-PRINT01: Transitioning to Stage 4 (or closing contract) when mandatory print deliverables
 *    have not passed QC inspection is BLOCKED (valid: false).
 * 2. Manager Override (T-PRINT01): Manager can override the QC Gate with a mandatory reason.
 * 3. Complete Deliverable Lifecycle: Flow from CHUA_GUI_IN -> DA_GUI_XUONG -> XUONG_DA_GIAO -> QC_PASSED -> DA_BAN_GIAO.
 * 4. QC Defect & Reprint: Inspecting QC with FAILED logs defect notes and enqueues Outbox alert.
 * 5. Clean Stage 4 Transition: When all required deliverables pass QC, contract transitions smoothly to Stage 4.
 * 6. Contract Sync Idempotency: Auto-syncing deliverables from contract package snapshot does not duplicate items.
 * 7. Migration M08: Backfills legacy contract deliverables and updates completed contracts idempotently.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const HOPDONG = require("../src/models/hopDong.model");
const PrintDeliverable = require("../src/models/printDeliverable.model");
const NotificationOutbox = require("../src/models/notificationOutbox.model");
const printDeliverableService = require("../src/services/printDeliverable.service");
const { validateTransition } = require("../src/services/contractStateMachine");
const { runMigrationM08 } = require("../src/migrations/m08_print_deliverable_sync");

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
    console.log("=== STARTING PR 5.1 AUTOMATED VERIFICATION ===");
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
    const mockDeliverables = new Map();
    const mockContracts = new Map();
    const mockOutbox = new Map();

    // Helper to mock Deliverable document
    function createMockDeliverableDoc(data) {
        const doc = {
            _id: data._id || new mongoose.Types.ObjectId().toString(),
            code: data.code || `PRN-${data.maHopDong}-01`,
            hopDongId: data.hopDongId,
            maHopDong: data.maHopDong,
            khachHangId: data.khachHangId,
            tenKhachHang: data.tenKhachHang || "Khách Hàng Test",
            soDienThoai: data.soDienThoai || "0988776655",
            tenSanPham: data.tenSanPham || "Ảnh phóng cổng tráng gương",
            phanLoai: data.phanLoai || "ANH_PHONG_CONG",
            kichThuoc: data.kichThuoc || "60x90",
            widthCm: data.widthCm || 60,
            heightCm: data.heightCm || 90,
            chatLieu: data.chatLieu || "Tráng gương mica",
            soLuong: data.soLuong || 1,
            isRequired: data.isRequired !== undefined ? data.isRequired : true,
            trangThai: data.trangThai || "CHUA_GUI_IN",
            thongTinXuongIn: {
                tenXuongIn: data.thongTinXuongIn?.tenXuongIn || "",
                soDienThoai: data.thongTinXuongIn?.soDienThoai || "",
                diaChi: data.thongTinXuongIn?.diaChi || "",
                ngayGuiIn: data.thongTinXuongIn?.ngayGuiIn || null,
                ngayHenTra: data.thongTinXuongIn?.ngayHenTra || null,
                ngayNhanThucTe: data.thongTinXuongIn?.ngayNhanThucTe || null,
                chiPhiIn: data.thongTinXuongIn?.chiPhiIn || 0,
                maVanDon: data.thongTinXuongIn?.maVanDon || "",
                ghiChuXuong: data.thongTinXuongIn?.ghiChuXuong || ""
            },
            kiemTraQC: {
                nguoiKiemTra: data.kiemTraQC?.nguoiKiemTra || "",
                thoiGianKiemTra: data.kiemTraQC?.thoiGianKiemTra || null,
                ketQua: data.kiemTraQC?.ketQua || "PENDING",
                tieuChi: data.kiemTraQC?.tieuChi || { dungKichThuoc: true, dungMauSac: true, khongTrayXuocRach: true, dungSoLuongTrang: true },
                ghiChuLoi: data.kiemTraQC?.ghiChuLoi || "",
                hinhAnhLoi: data.kiemTraQC?.hinhAnhLoi || [],
                yeuCauInLai: Boolean(data.kiemTraQC?.yeuCauInLai),
                soLanInLai: data.kiemTraQC?.soLanInLai || 0
            },
            banGiaoKhach: {
                ngayBanGiao: data.banGiaoKhach?.ngayBanGiao || null,
                nguoiBanGiao: data.banGiaoKhach?.nguoiBanGiao || "",
                nguoiNhan: data.banGiaoKhach?.nguoiNhan || "",
                ghiChu: data.banGiaoKhach?.ghiChu || ""
            },
            qcOverride: {
                isOverridden: Boolean(data.qcOverride?.isOverridden),
                overrideReason: data.qcOverride?.overrideReason || "",
                approvedBy: data.qcOverride?.approvedBy || "",
                approvedAt: data.qcOverride?.approvedAt || null
            },
            auditLog: (data.auditLog || []).map(a => ({ ...a })),
            save: async function() {
                mockDeliverables.set(this._id.toString(), this);
                mockDeliverables.set(this.code, this);
                return this;
            }
        };
        mockDeliverables.set(doc._id.toString(), doc);
        mockDeliverables.set(doc.code, doc);
        return doc;
    }

    // Mock PrintDeliverable.prototype.save
    PrintDeliverable.prototype.save = async function() {
        mockDeliverables.set(this._id.toString(), this);
        mockDeliverables.set(this.code, this);
        return this;
    };

    // Mock PrintDeliverable.find & findById & findOne & countDocuments
    PrintDeliverable.find = function(query = {}) {
        let results = Array.from(new Set(mockDeliverables.values()));
        if (query.maHopDong) {
            results = results.filter(i => i.maHopDong === query.maHopDong);
        }
        if (query.trangThai && query.trangThai.$ne) {
            results = results.filter(i => i.trangThai !== query.trangThai.$ne);
        }
        const thenable = {
            sort: () => thenable,
            skip: () => thenable,
            limit: () => thenable,
            then: (resolve) => Promise.resolve(results).then(resolve)
        };
        return thenable;
    };

    PrintDeliverable.findById = function(id) {
        return Promise.resolve(mockDeliverables.get(id?.toString()) || null);
    };

    PrintDeliverable.findOne = function(query) {
        if (!query) return Promise.resolve(null);
        if (query.$or) {
            for (const q of query.$or) {
                if (q._id && mockDeliverables.has(q._id.toString())) {
                    return Promise.resolve(mockDeliverables.get(q._id.toString()));
                }
                if (q.code && mockDeliverables.has(q.code)) {
                    return Promise.resolve(mockDeliverables.get(q.code));
                }
            }
        }
        return Promise.resolve(null);
    };

    PrintDeliverable.countDocuments = function(query = {}) {
        let count = 0;
        for (const item of new Set(mockDeliverables.values())) {
            if (!query.maHopDong || item.maHopDong === query.maHopDong) count++;
        }
        return Promise.resolve(count);
    };

    // Mock HOPDONG.findOne & updateOne & find
    HOPDONG.findOne = function(query) {
        if (!query) return Promise.resolve(null);
        if (query.$or) {
            for (const q of query.$or) {
                if (q.maHopDong) {
                    if (typeof q.maHopDong === 'string' && mockContracts.has(q.maHopDong)) {
                        return Promise.resolve(mockContracts.get(q.maHopDong));
                    }
                    if (q.maHopDong.$regex) {
                        for (const [key, doc] of mockContracts.entries()) {
                            if (q.maHopDong.$regex.test(key)) return Promise.resolve(doc);
                        }
                    }
                }
                if (q._id && mockContracts.has(q._id.toString())) {
                    return Promise.resolve(mockContracts.get(q._id.toString()));
                }
            }
        }
        if (query.maHopDong) {
            if (typeof query.maHopDong === 'string') {
                return Promise.resolve(mockContracts.get(query.maHopDong) || null);
            }
            if (query.maHopDong.$regex) {
                for (const [key, doc] of mockContracts.entries()) {
                    if (query.maHopDong.$regex.test(key)) return Promise.resolve(doc);
                }
            }
        }
        return Promise.resolve(null);
    };

    HOPDONG.find = function() {
        return Promise.resolve(Array.from(new Set(mockContracts.values())));
    };

    HOPDONG.updateOne = function(filter, update) {
        let contract = null;
        if (filter.maHopDong) contract = mockContracts.get(filter.maHopDong);
        if (filter._id) contract = mockContracts.get(filter._id.toString());
        if (contract && update.$set) {
            Object.assign(contract, update.$set);
        }
        return Promise.resolve({ modifiedCount: contract ? 1 : 0 });
    };

    // Mock NotificationOutbox
    NotificationOutbox.create = function(data) {
        if (data.idempotencyKey && mockOutbox.has(data.idempotencyKey)) {
            const err = new Error("Duplicate idempotencyKey");
            err.code = 11000;
            return Promise.reject(err);
        }
        const record = { _id: new mongoose.Types.ObjectId(), ...data, status: 'PENDING', createdAt: new Date() };
        if (data.idempotencyKey) {
            mockOutbox.set(data.idempotencyKey, record);
        }
        return Promise.resolve(record);
    };

    // ==========================================
    // TEST 1: T-PRINT01 Transition to Stage 4 blocked without QC Acceptance
    // ==========================================
    await test("T-PRINT01: Transition to Stage 4 blocked when mandatory print deliverables are NOT QC inspected", async () => {
        mockDeliverables.clear();
        mockContracts.clear();

        const maHopDong = "HD-PRINT-01";
        const contract = {
            _id: new mongoose.Types.ObjectId(),
            maHopDong,
            giaiDoan: 3,
            subGiaiDoan: "dang_thuc_hien",
            thanhToan: { conLai: 0, trangThaiThanhToan: "Đã thanh toán đủ" }
        };
        mockContracts.set(maHopDong, contract);

        // Tạo 1 sản phẩm in ấn bắt buộc nhưng chưa nghiệm thu QC (đang ở CHUA_GUI_IN)
        createMockDeliverableDoc({
            code: "PRN-HD-PRINT-01-01",
            maHopDong,
            tenSanPham: "Ảnh cổng tráng gương 60x90",
            isRequired: true,
            trangThai: "CHUA_GUI_IN"
        });

        // Nhân viên thông thường cố gắng chuyển hợp đồng sang Giai đoạn 4
        const regularStaff = { username: "staff_chup", positon: "Nhân viên" };
        const result = await validateTransition({
            contract,
            nextStage: 4,
            nextSubStage: "hoan_thanh",
            user: regularStaff
        });

        assert.strictEqual(result.valid, false, "INVARIANT T-PRINT01: Must block transition to Stage 4 if deliverables are not QC_PASSED");
        assert.ok(result.error.includes("chưa được nghiệm thu QC"), "Error message must state deliverables pending QC");
    });

    // ==========================================
    // TEST 2: Manager Override on QC Gate (T-PRINT01)
    // ==========================================
    await test("T-PRINT01 Override: Manager can approve Stage 4 transition with mandatory override reason", async () => {
        const maHopDong = "HD-PRINT-01";
        const contract = mockContracts.get(maHopDong);

        const managerUser = { username: "manager_long", positon: "Quản lý", role: "manager" };

        // 1. Manager thử override nhưng không nhập lý do -> Bị chặn
        const resultNoReason = await validateTransition({
            contract,
            nextStage: 4,
            nextSubStage: "hoan_thanh",
            user: managerUser,
            data: { managerOverride: true, qcOverrideReason: "" }
        });
        assert.strictEqual(resultNoReason.valid, false, "Manager without override reason must still be blocked");

        // 2. Manager cung cấp lý do override hợp lệ -> Được phê duyệt
        const resultWithReason = await validateTransition({
            contract,
            nextStage: 4,
            nextSubStage: "hoan_thanh",
            user: managerUser,
            data: {
                managerOverride: true,
                qcOverrideReason: "Khách lấy gấp trước ngày cưới, studio bàn giao ảnh xem tạm"
            }
        });
        assert.strictEqual(resultWithReason.valid, true, "Manager with valid override reason must pass QC Gate");
    });

    // ==========================================
    // TEST 3: Complete Deliverable Lifecycle
    // ==========================================
    await test("Test 3: Deliverable transitions cleanly through all factory tracking & QC phases", async () => {
        const maHopDong = "HD-LIFECYCLE";
        const deliverable = createMockDeliverableDoc({
            _id: new mongoose.Types.ObjectId().toString(),
            code: "PRN-HD-LIFECYCLE-01",
            maHopDong,
            tenSanPham: "Photobook Da 30x30",
            trangThai: "CHUA_GUI_IN"
        });

        // 1. Gửi xưởng in
        const sendReq = {
            params: { id: deliverable._id },
            body: {
                tenXuongIn: "Xưởng in Thắng",
                soDienThoai: "0901234567",
                ngayGuiIn: new Date(),
                ngayHenTra: new Date(Date.now() + 86400000 * 3),
                chiPhiIn: 450000,
                maVanDon: "VNPOST-998822"
            },
            user: { fullname: "Trần Hậu Kỳ" }
        };
        const sendRes = createMockRes();
        await printDeliverableService.sendToFactory(sendReq, sendRes);

        assert.strictEqual(sendRes.statusCode, 200);
        assert.strictEqual(deliverable.trangThai, "DA_GUI_XUONG");
        assert.strictEqual(deliverable.thongTinXuongIn.tenXuongIn, "Xưởng in Thắng");
        assert.strictEqual(deliverable.thongTinXuongIn.chiPhiIn, 450000);

        // 2. Tiếp nhận hàng từ xưởng in về studio
        const recvReq = {
            params: { id: deliverable._id },
            body: { ngayNhanThucTe: new Date(), ghiChu: "Hàng nguyên vẹn kiện gỗ" },
            user: { fullname: "Trần Hậu Kỳ" }
        };
        const recvRes = createMockRes();
        await printDeliverableService.receiveFromFactory(recvReq, recvRes);

        assert.strictEqual(recvRes.statusCode, 200);
        assert.strictEqual(deliverable.trangThai, "XUONG_DA_GIAO");

        // 3. Nghiệm thu QC đạt chuẩn (PASSED)
        const qcReq = {
            params: { id: deliverable._id },
            body: {
                ketQua: "PASSED",
                tieuChi: { dungKichThuoc: true, dungMauSac: true, khongTrayXuocRach: true, dungSoLuongTrang: true }
            },
            user: { fullname: "Lê QC" }
        };
        const qcRes = createMockRes();
        await printDeliverableService.inspectQC(qcReq, qcRes);

        assert.strictEqual(qcRes.statusCode, 200);
        assert.strictEqual(deliverable.trangThai, "QC_PASSED");
        assert.strictEqual(deliverable.kiemTraQC.ketQua, "PASSED");

        // 4. Bàn giao cho khách hàng
        const delivReq = {
            params: { id: deliverable._id },
            body: { nguoiNhan: "Cô dâu Mai", ghiChu: "Khách khen màu in rất tươi" },
            user: { fullname: "Lễ Tân" }
        };
        const delivRes = createMockRes();
        await printDeliverableService.handoverToClient(delivReq, delivRes);

        assert.strictEqual(delivRes.statusCode, 200);
        assert.strictEqual(deliverable.trangThai, "DA_BAN_GIAO");
        assert.strictEqual(deliverable.banGiaoKhach.nguoiNhan, "Cô dâu Mai");
    });

    // ==========================================
    // TEST 4: QC Defect & Reprint Flow
    // ==========================================
    await test("Test 4: QC FAILED logs defect details, increments reprint counter and triggers Outbox notification", async () => {
        const maHopDong = "HD-DEFECT";
        const deliverable = createMockDeliverableDoc({
            _id: new mongoose.Types.ObjectId().toString(),
            code: "PRN-HD-DEFECT-01",
            maHopDong,
            tenSanPham: "Khung ảnh cưới pha lê 50x75",
            trangThai: "XUONG_DA_GIAO"
        });

        const req = {
            params: { id: deliverable._id },
            body: {
                ketQua: "FAILED",
                tieuChi: { dungKichThuoc: true, dungMauSac: false, khongTrayXuocRach: false, dungSoLuongTrang: true },
                ghiChuLoi: "Góc kính pha lê bị nứt 2cm và màu da bị ám xanh",
                yeuCauInLai: true
            },
            user: { fullname: "Lê QC" }
        };
        const res = createMockRes();
        await printDeliverableService.inspectQC(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(deliverable.trangThai, "QC_FAILED");
        assert.strictEqual(deliverable.kiemTraQC.ketQua, "FAILED");
        assert.strictEqual(deliverable.kiemTraQC.soLanInLai, 1);
        assert.ok(deliverable.kiemTraQC.ghiChuLoi.includes("bị nứt"));

        // Check Outbox Notification
        const outboxKey = `QC_FAILED_PRN-HD-DEFECT-01_run1`;
        const outboxItem = mockOutbox.get(outboxKey);
        assert.ok(outboxItem, "NotificationOutbox task must be created for failed QC with reprint request");
        assert.strictEqual(outboxItem.eventType, "DELIVERABLE_QC_FAILED");
    });

    // ==========================================
    // TEST 5: Clean Stage 4 Transition When All Deliverables Passed QC
    // ==========================================
    await test("Test 5: Contract transitions smoothly to Stage 4 when all required deliverables have passed QC", async () => {
        const maHopDong = "HD-ALL-PASSED";
        const contract = {
            _id: new mongoose.Types.ObjectId(),
            maHopDong,
            giaiDoan: 3,
            subGiaiDoan: "dang_thuc_hien",
            thanhToan: { conLai: 0, trangThaiThanhToan: "Đã thanh toán đủ" }
        };
        mockContracts.set(maHopDong, contract);

        // Tạo 2 sản phẩm: 1 đã QC_PASSED, 1 đã DA_BAN_GIAO
        createMockDeliverableDoc({
            code: "PRN-HD-ALL-PASSED-01",
            maHopDong,
            tenSanPham: "Ảnh cổng 60x90",
            isRequired: true,
            trangThai: "QC_PASSED"
        });
        createMockDeliverableDoc({
            code: "PRN-HD-ALL-PASSED-02",
            maHopDong,
            tenSanPham: "Album 30x30",
            isRequired: true,
            trangThai: "DA_BAN_GIAO"
        });

        const regularStaff = { username: "staff_thuong", positon: "Nhân viên" };
        const result = await validateTransition({
            contract,
            nextStage: 4,
            nextSubStage: "hoan_thanh",
            user: regularStaff
        });

        assert.strictEqual(result.valid, true, "Contract must be allowed to close when all deliverables passed QC");
    });

    // ==========================================
    // TEST 6: Sync Deliverables From Contract (Idempotency)
    // ==========================================
    await test("Test 6: syncDeliverablesFromContract extracts deliverables and re-syncing is strictly idempotent", async () => {
        const maHopDong = "HD-SYNC-TEST";
        const contract = {
            _id: new mongoose.Types.ObjectId(),
            maHopDong,
            giaiDoan: 3,
            hauKy: {
                thongTinInAn: { tenXuongIn: "Xưởng Thắng", chiPhiIn: 500000 }
            },
            packageSnapshot: {
                details: {
                    deliverables: [
                        { name: "Ảnh cổng tráng gương", widthCm: 60, heightCm: 90, quantity: 1, kind: "ANH_PHONG_CONG" },
                        { name: "Photobook Mini", widthCm: 15, heightCm: 21, quantity: 2, kind: "ANH_BAN" }
                    ]
                }
            }
        };
        mockContracts.set(maHopDong, contract);

        // 1. Đồng bộ lần 1
        const req1 = { params: { contractId: maHopDong }, user: { fullname: "Admin" } };
        const res1 = createMockRes();
        await printDeliverableService.syncDeliverablesFromContract(req1, res1);

        assert.strictEqual(res1.statusCode, 200);
        const countFirstRun = Array.from(new Set(mockDeliverables.values())).filter(i => i.maHopDong === maHopDong).length;
        assert.strictEqual(countFirstRun, 2, "Should extract exactly 2 deliverables from package snapshot");

        // 2. Đồng bộ lần 2 (Idempotency Guard)
        const req2 = { params: { contractId: maHopDong }, user: { fullname: "Admin" } };
        const res2 = createMockRes();
        await printDeliverableService.syncDeliverablesFromContract(req2, res2);

        assert.strictEqual(res2.statusCode, 200);
        const countSecondRun = Array.from(new Set(mockDeliverables.values())).filter(i => i.maHopDong === maHopDong).length;
        assert.strictEqual(countSecondRun, countFirstRun, "Re-running sync must NOT create duplicate deliverable records");
    });

    // ==========================================
    // TEST 7: Migration M08 Sync & Historical Backfill
    // ==========================================
    await test("Test 7: Migration M08 backfills legacy print deliverables and updates completed contracts idempotently", async () => {
        // Tạo hợp đồng cũ Giai đoạn 4 có xưởng in nhưng chưa có PrintDeliverable độc lập
        const legacyCompletedContract = {
            _id: new mongoose.Types.ObjectId(),
            maHopDong: "HD-LEGACY-M08",
            giaiDoan: 4,
            subGiaiDoan: "hoan_thanh",
            hauKy: {
                thongTinInAn: { tenXuongIn: "Xưởng Cũ Năm 2025" }
            }
        };
        mockContracts.set("HD-LEGACY-M08", legacyCompletedContract);

        // Chạy Migration M08 lần 1
        const summary1 = await runMigrationM08({ dryRun: false });
        assert.ok(summary1.contractsScanned >= 1, "M08 must scan contracts");
        assert.ok(summary1.deliverablesCreated >= 1, "M08 must create missing deliverables");

        const legacyItems = Array.from(new Set(mockDeliverables.values())).filter(i => i.maHopDong === "HD-LEGACY-M08");
        assert.ok(legacyItems.length >= 1, "Deliverables must exist for legacy completed contract");
        assert.strictEqual(legacyItems[0].trangThai, "QC_PASSED", "Deliverable for completed contract must be marked QC_PASSED");

        // Chạy Migration M08 lần 2 (Idempotency)
        const summary2 = await runMigrationM08({ dryRun: false });
        assert.strictEqual(summary2.deliverablesCreated, 0, "Idempotent M08 run must create 0 new deliverables");
    });

    console.log(`\n========================================`);
    console.log(`PR 5.1 VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests().catch(err => {
        console.error("Fatal test runner error:", err);
        process.exit(1);
    });
}

module.exports = { runTests };
