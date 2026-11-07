/**
 * PR 3.3 Automated Verification Test Suite
 * Wardrobe Reservation, Maintenance Scheduling & Check-in/out Records (LW2-032, MOD-05)
 * 
 * Verifications:
 * 1. T-WAR01: Overlapping reservations for the same garment reject confirmation (409 Conflict).
 * 2. Buffer Window: Cleaning buffer (24h default) properly flags laundry collisions.
 * 3. Manager Override: Manager can override conflict with reason and audit log.
 * 4. Check-out & Check-in: Handover sets IN_USE; return records condition, increments usage, sets laundry status.
 * 5. Cancelled Immunity: Cancelled reservations and cancelled contracts do NOT hold garments.
 * 6. Maintenance Tracking: Garment maintenance history records laundry/repair and completes back to SAN_SANG.
 * 7. Migration M06: Flags unverified garments as NEEDS_INVENTORY and backfills reservations idempotently.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const WardrobeReservation = require("../src/models/wardrobeReservation.model");
const TrangPhuc = require("../src/models/trangPhuc.model");
const HopDong = require("../src/models/hopDong.model");
const wardrobeService = require("../src/services/wardrobe.service");
const { runMigrationM06 } = require("../src/migrations/m06_wardrobe_reservation_sync");

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
    console.log("=== STARTING PR 3.3 AUTOMATED VERIFICATION ===");
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

    const mockReservations = new Map();
    const mockGarments = new Map();
    const mockContracts = new Map();

    // Mock WardrobeReservation
    WardrobeReservation.find = (query = {}) => {
        let list = Array.from(mockReservations.values());

        if (query._id && query._id.$ne) {
            list = list.filter(r => String(r._id) !== String(query._id.$ne));
        }
        if (query.maTrangPhuc) {
            list = list.filter(r => r.maTrangPhuc === query.maTrangPhuc);
        }
        if (query.status) {
            if (typeof query.status === 'string') {
                list = list.filter(r => r.status === query.status);
            } else if (query.status.$in) {
                list = list.filter(r => query.status.$in.includes(r.status));
            }
        }
        if (query.maHopDong && query.maHopDong.$ne) {
            list = list.filter(r => r.maHopDong !== query.maHopDong.$ne);
        }

        return {
            _list: [...list],
            sort(sortObj) {
                if (sortObj.startDate) {
                    this._list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                }
                return this;
            },
            skip(n) {
                this._list = this._list.slice(n);
                return this;
            },
            limit(n) {
                this._list = this._list.slice(0, n);
                return this;
            },
            then(resolve, reject) {
                return Promise.resolve(this._list).then(resolve, reject);
            }
        };
    };

    WardrobeReservation.findById = async (id) => mockReservations.get(String(id)) || null;

    WardrobeReservation.findOne = async (query = {}) => {
        if (query["legacyRef.scheduleId"]) {
            for (const r of mockReservations.values()) {
                if (r.legacyRef?.scheduleId === query["legacyRef.scheduleId"]) return r;
            }
        }
        return null;
    };

    WardrobeReservation.countDocuments = async (query = {}) => {
        let list = Array.from(mockReservations.values());
        if (query.maTrangPhuc) list = list.filter(r => r.maTrangPhuc === query.maTrangPhuc);
        if (query.status && query.status.$in) list = list.filter(r => query.status.$in.includes(r.status));
        return list.length;
    };

    WardrobeReservation.prototype.save = async function() {
        if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
        mockReservations.set(String(this._id), this);
        return this;
    };

    // Mock TrangPhuc
    TrangPhuc.find = async () => Array.from(mockGarments.values());
    TrangPhuc.findById = async (id) => mockGarments.get(String(id)) || null;
    TrangPhuc.findOne = async (query = {}) => {
        if (query.maTrangPhuc) {
            for (const g of mockGarments.values()) {
                if (g.maTrangPhuc === query.maTrangPhuc) return g;
            }
        }
        return null;
    };
    TrangPhuc.findByIdAndUpdate = async (id, update) => {
        const item = mockGarments.get(String(id));
        if (item) {
            if (update.$set) Object.assign(item, update.$set);
            if (update.$inc && update.$inc.soLanSuDung) item.soLanSuDung = (item.soLanSuDung || 0) + update.$inc.soLanSuDung;
            if (update.tinhTrang) item.tinhTrang = update.tinhTrang;
        }
        return item;
    };
    TrangPhuc.updateOne = async (query, update) => {
        let item = null;
        if (query.maTrangPhuc) {
            for (const g of mockGarments.values()) {
                if (g.maTrangPhuc === query.maTrangPhuc) {
                    item = g;
                    break;
                }
            }
        }
        if (item) {
            if (update.$set) Object.assign(item, update.$set);
            if (update.tinhTrang) item.tinhTrang = update.tinhTrang;
        }
        return { modifiedCount: 1 };
    };
    TrangPhuc.prototype.save = async function() {
        if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
        mockGarments.set(String(this._id), this);
        return this;
    };

    // Mock HopDong
    HopDong.find = (query = {}) => {
        let list = Array.from(mockContracts.values());
        if (query.subGiaiDoan && query.subGiaiDoan.$ne) {
            list = list.filter(c => c.subGiaiDoan !== query.subGiaiDoan.$ne);
        }
        if (query["trangPhucGiu.0"]) {
            list = list.filter(c => Array.isArray(c.trangPhucGiu) && c.trangPhucGiu.length > 0);
        }
        if (query["trangPhucGiu.maTrangPhuc"]) {
            list = list.filter(c => (c.trangPhucGiu || []).some(t => t.maTrangPhuc === query["trangPhucGiu.maTrangPhuc"]));
        }

        return {
            populate() {
                return this;
            },
            then(resolve, reject) {
                return Promise.resolve(list).then(resolve, reject);
            }
        };
    };

    function createMockGarment(data) {
        const id = data._id || new mongoose.Types.ObjectId().toString();
        const doc = new TrangPhuc({
            _id: id,
            maTrangPhuc: data.maTrangPhuc,
            tenTrangPhuc: data.tenTrangPhuc || "Váy cưới mẫu",
            phanLoai: data.phanLoai || "Váy Luxury",
            tinhTrang: data.tinhTrang || "SAN_SANG",
            soLanSuDung: data.soLanSuDung || 0,
            cleaningBufferHours: data.cleaningBufferHours || 24,
            maintenanceHistory: data.maintenanceHistory || []
        });
        mockGarments.set(String(id), doc);
        return doc;
    }

    function createMockReservation(data) {
        const id = data._id || new mongoose.Types.ObjectId().toString();
        const doc = new WardrobeReservation({
            _id: id,
            maPhieu: data.maPhieu || `WR-${Date.now().toString().slice(-6)}`,
            maHopDong: data.maHopDong || "HD2026-TEST",
            trangPhucId: data.trangPhucId || undefined,
            maTrangPhuc: data.maTrangPhuc.toUpperCase().trim(),
            tenTrangPhuc: data.tenTrangPhuc || "Váy cưới",
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            cleaningBufferHours: data.cleaningBufferHours || 24,
            status: data.status || "RESERVED",
            auditLog: []
        });
        mockReservations.set(String(id), doc);
        return doc;
    }

    try {
        // Test 1: T-WAR01 Conflict Detection
        await test("1. T-WAR01: Overlapping reservations for same garment reject with 409 Conflict", async () => {
            mockReservations.clear();
            mockGarments.clear();

            createMockGarment({ maTrangPhuc: "VAY-LUX-01", tinhTrang: "SAN_SANG" });

            // Reservation 1: From 2026-11-20 to 2026-11-22 (RESERVED)
            createMockReservation({
                maPhieu: "WR-RES-01",
                maTrangPhuc: "VAY-LUX-01",
                startDate: "2026-11-20T08:00:00.000Z",
                endDate: "2026-11-22T18:00:00.000Z",
                status: "RESERVED"
            });

            // Reservation 2: Attempts to book from 2026-11-21 to 2026-11-23 (Overlapping dates)
            const req = {
                body: {
                    maTrangPhuc: "VAY-LUX-01",
                    startDate: "2026-11-21T08:00:00.000Z",
                    endDate: "2026-11-23T18:00:00.000Z",
                    tenKhachHang: "Khách hàng B"
                },
                user: { fullname: "Sale 1" }
            };
            const res = createMockRes();
            await wardrobeService.createReservation(req, res);

            assert.strictEqual(res.statusCode, 409, "Must return 409 Conflict for overlapping garment booking");
            assert.strictEqual(res.data.error.code, "WARDROBE_CONFLICT");
            assert.strictEqual(res.data.error.conflicts.length, 1);
            assert.strictEqual(mockReservations.size, 1, "Must not create conflicting reservation document");
        });

        // Test 2: Cleaning Buffer Detection
        await test("2. Cleaning Buffer Window: 24h laundry buffer prevents same-day/next-day turnaround collisions", async () => {
            mockReservations.clear();

            createMockGarment({ maTrangPhuc: "VAY-LUX-02" });

            // Reservation 1 ends on 2026-11-20 at 18:00 (with 24h buffer, occupied until 2026-11-21 at 18:00)
            createMockReservation({
                maPhieu: "WR-BUF-01",
                maTrangPhuc: "VAY-LUX-02",
                startDate: "2026-11-18T08:00:00.000Z",
                endDate: "2026-11-20T18:00:00.000Z",
                cleaningBufferHours: 24,
                status: "RESERVED"
            });

            // Reservation 2 attempts to borrow on 2026-11-21 at 09:00 (less than 24h after previous return)
            const req = {
                body: {
                    maTrangPhuc: "VAY-LUX-02",
                    startDate: "2026-11-21T09:00:00.000Z",
                    endDate: "2026-11-23T18:00:00.000Z"
                },
                user: { fullname: "Sale 2" }
            };
            const res = createMockRes();
            await wardrobeService.createReservation(req, res);

            assert.strictEqual(res.statusCode, 409, "Must reject booking falling within 24h laundry buffer");
            assert.strictEqual(res.data.error.code, "WARDROBE_CONFLICT");
        });

        // Test 3: Manager Override
        await test("3. Manager Override: Manager can override conflict with reason and audit log", async () => {
            mockReservations.clear();

            createMockGarment({ maTrangPhuc: "VEST-VIP-01" });

            createMockReservation({
                maPhieu: "WR-VIP-01",
                maTrangPhuc: "VEST-VIP-01",
                startDate: "2026-11-25T08:00:00.000Z",
                endDate: "2026-11-26T18:00:00.000Z",
                status: "RESERVED"
            });

            const req = {
                body: {
                    maTrangPhuc: "VEST-VIP-01",
                    startDate: "2026-11-26T10:00:00.000Z",
                    endDate: "2026-11-27T18:00:00.000Z",
                    conflictOverride: {
                        isOverridden: true,
                        reason: "Khách dùng chung tại studio vào buổi tối, tiệm giặt sấy cấp tốc trong 1 giờ"
                    }
                },
                user: { fullname: "Giám đốc Studio", role: "Manager" }
            };
            const res = createMockRes();
            await wardrobeService.createReservation(req, res);

            assert.strictEqual(res.statusCode, 200, "Override by Manager must succeed (200)");
            assert.strictEqual(res.data.data.conflictOverride.isOverridden, true);
            assert.strictEqual(mockReservations.size, 2);
        });

        // Test 4: Lifecycle: Check-out and Check-in
        await test("4. Check-out & Check-in: Handover sets IN_USE; return records condition, increments usage, sets laundry status", async () => {
            mockReservations.clear();
            mockGarments.clear();

            const garment = createMockGarment({
                maTrangPhuc: "VAY-PRINCESS-01",
                tinhTrang: "SAN_SANG",
                soLanSuDung: 5
            });

            const resDoc = createMockReservation({
                maPhieu: "WR-LIFE-01",
                maTrangPhuc: "VAY-PRINCESS-01",
                trangPhucId: garment._id,
                startDate: "2026-11-20T08:00:00.000Z",
                endDate: "2026-11-22T18:00:00.000Z",
                status: "RESERVED"
            });

            // 1. Check-out
            const reqOut = {
                params: { id: String(resDoc._id) },
                body: { conditionNotes: "Váy mới nguyên vẹn, kèm lúp và vương miện", photos: ["photo1.jpg"] },
                user: { fullname: "Nhân viên Bàn giao" }
            };
            const resOut = createMockRes();
            await wardrobeService.checkOut(reqOut, resOut);

            assert.strictEqual(resOut.statusCode, 200);
            assert.strictEqual(resDoc.status, "IN_USE");
            assert.strictEqual(garment.tinhTrang, "DANG_CHO_THUE");

            // 2. Check-in (Client returns)
            const reqIn = {
                params: { id: String(resDoc._id) },
                body: { conditionNotes: "Khách trả đủ phụ kiện, dính chút rượu vang ở đuôi váy", damageFee: 150000, sendToLaundry: true },
                user: { fullname: "Nhân viên Kho" }
            };
            const resIn = createMockRes();
            await wardrobeService.checkIn(reqIn, resIn);

            assert.strictEqual(resIn.statusCode, 200);
            assert.strictEqual(resDoc.status, "RETURNED");
            assert.strictEqual(resDoc.checkIn.damageFee, 150000);
            assert.strictEqual(garment.soLanSuDung, 6, "Usage count must increment from 5 to 6");
            assert.strictEqual(garment.tinhTrang, "DANG_GIAT_HAP", "Garment must transition to laundry status");
        });

        // Test 5: Cancelled Immunity
        await test("5. Cancelled Immunity: Cancelled reservations and cancelled contracts do NOT hold garments", async () => {
            mockReservations.clear();
            mockContracts.clear();

            createMockGarment({ maTrangPhuc: "VAY-FREE-01" });

            // 1. A cancelled reservation
            createMockReservation({
                maPhieu: "WR-CANCEL-01",
                maTrangPhuc: "VAY-FREE-01",
                startDate: "2026-11-28T08:00:00.000Z",
                endDate: "2026-11-30T18:00:00.000Z",
                status: "CANCELLED"
            });

            // 2. A cancelled contract with dress hold
            const cancelledContract = new HopDong({
                maHopDong: "HD-CANCELLED",
                subGiaiDoan: "huy",
                trangPhucGiu: [{
                    maTrangPhuc: "VAY-FREE-01",
                    ngayHenLay: "2026-11-28T08:00:00.000Z",
                    ngayHenTra: "2026-11-30T18:00:00.000Z",
                    trangThai: "GIU_CHO"
                }]
            });
            mockContracts.set("HD-CANCELLED", cancelledContract);

            // Now a new reservation requests the same dates -> Must succeed without conflict
            const req = {
                body: {
                    maTrangPhuc: "VAY-FREE-01",
                    startDate: "2026-11-28T08:00:00.000Z",
                    endDate: "2026-11-30T18:00:00.000Z"
                },
                user: { fullname: "Sale 3" }
            };
            const res = createMockRes();
            await wardrobeService.createReservation(req, res);

            assert.strictEqual(res.statusCode, 200, "Cancelled records must not block new reservation");
        });

        // Test 6: Maintenance Tracking
        await test("6. Maintenance: Records laundry/repair history and returns garment to SAN_SANG", async () => {
            mockGarments.clear();

            const garment = createMockGarment({
                maTrangPhuc: "VAY-MAINT-01",
                tinhTrang: "DANG_GIAT_HAP"
            });

            // Send to repair
            const reqRepair = {
                params: { itemId: String(garment._id) },
                body: { action: "SUA_CHUA", notes: "Đính lại hạt pha lê ở eo", cost: 200000 },
                user: { fullname: "Thợ may" }
            };
            const resRepair = createMockRes();
            await wardrobeService.recordMaintenance(reqRepair, resRepair);

            assert.strictEqual(resRepair.statusCode, 200);
            assert.strictEqual(garment.tinhTrang, "DANG_SUA_CHUA");
            assert.strictEqual(garment.maintenanceHistory.length, 1);

            // Complete maintenance -> Returns to SAN_SANG
            const reqDone = {
                params: { itemId: String(garment._id) },
                body: { complete: true, notes: "Đã hoàn thành sửa chữa và là ủi" },
                user: { fullname: "Quản lý kho" }
            };
            const resDone = createMockRes();
            await wardrobeService.recordMaintenance(reqDone, resDone);

            assert.strictEqual(resDone.statusCode, 200);
            assert.strictEqual(garment.tinhTrang, "SAN_SANG", "Completed maintenance must restore status to SAN_SANG");
        });

        // Test 7: Migration M06
        await test("7. Migration M06: Flags unverified garments as NEEDS_INVENTORY and backfills reservations idempotently", async () => {
            mockGarments.clear();
            mockReservations.clear();
            mockContracts.clear();

            // 1. Stale garment untouched for 100 days
            const staleGarment = new TrangPhuc({
                _id: new mongoose.Types.ObjectId().toString(),
                maTrangPhuc: "VAY-OLD-01",
                tinhTrang: "SAN_SANG",
                updatedAt: new Date(Date.now() - 100 * 24 * 3600 * 1000)
            });
            mockGarments.set(String(staleGarment._id), staleGarment);

            // 2. Active contract with dress hold
            const hd = new HopDong({
                _id: new mongoose.Types.ObjectId().toString(),
                maHopDong: "HD-M06-01",
                trangPhucGiu: [{
                    maTrangPhuc: "VAY-M06-01",
                    tenTrangPhuc: "Váy đuôi cá M06",
                    ngayHenLay: "2026-12-10T08:00:00.000Z",
                    ngayHenTra: "2026-12-12T18:00:00.000Z",
                    trangThai: "GIU_CHO"
                }]
            });
            mockContracts.set(String(hd._id), hd);

            // Dry-run
            const dryRunResult = await runMigrationM06({ dryRun: true, markInventoryDays: 60 });
            assert.strictEqual(dryRunResult.garmentsMarkedNeedsInventory, 1);
            assert.strictEqual(dryRunResult.reservationsScanned, 1);
            assert.strictEqual(dryRunResult.reservationsCreated, 0, "Dry run must not create records");
            assert.strictEqual(staleGarment.tinhTrang, "SAN_SANG", "Dry run must not mutate garment");

            // Apply
            const applyResult = await runMigrationM06({ dryRun: false, markInventoryDays: 60 });
            assert.strictEqual(applyResult.reservationsCreated, 1);
            assert.strictEqual(staleGarment.tinhTrang, "NEEDS_INVENTORY", "Apply must flag unverified garment as NEEDS_INVENTORY");
            assert.strictEqual(mockReservations.size, 1);

            // Re-run verify idempotency
            const rerunResult = await runMigrationM06({ dryRun: false, markInventoryDays: 60 });
            assert.strictEqual(rerunResult.reservationsCreated, 0, "Re-run must not duplicate reservations");
            assert.strictEqual(rerunResult.reservationsUpdated, 1);
            assert.strictEqual(mockReservations.size, 1);
        });

    } catch (err) {
        console.error("Test execution aborted:", err);
    }

    console.log(`\nPR 3.3 SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
