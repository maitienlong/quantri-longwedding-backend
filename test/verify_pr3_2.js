/**
 * PR 3.2 Automated Verification Test Suite
 * Booking, Resource Availability & Scheduling Conflicts (LW2-031, MOD-04)
 * 
 * Verifications:
 * 1. T-CAL01: Overlapping intervals for same resource reject confirmation (409 Conflict).
 * 2. T-CAL02: Boundary adjacent intervals (e.g. 10:00-11:00 and 11:00-12:00) valid without buffer (200 OK).
 * 3. Buffer Window: Configurable travel/setup buffer correctly flags buffer-zone collisions.
 * 4. Manager Override: Manager can confirm with mandatory reason and audit trail.
 * 5. Idempotent Confirmation & Cancellation: Re-confirming is safe; cancelling frees resources immediately.
 * 6. Availability Engine: getAvailability returns busy windows and resource schedules.
 * 7. Migration M05: Scans contracts, detects historical overlaps, and backfills Bookings idempotently.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const Booking = require("../src/models/booking.model");
const HopDong = require("../src/models/hopDong.model");
const bookingService = require("../src/services/booking.service");
const { runMigrationM05 } = require("../src/migrations/m05_calendar_booking_sync");

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
    console.log("=== STARTING PR 3.2 AUTOMATED VERIFICATION ===");
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

    const mockBookings = new Map();
    const mockContracts = new Map();

    // Mock Booking queries
    Booking.find = (query = {}) => {
        let list = Array.from(mockBookings.values());

        if (query._id && query._id.$ne) {
            list = list.filter(b => String(b._id) !== String(query._id.$ne));
        }

        if (query.status) {
            if (typeof query.status === 'string') {
                list = list.filter(b => b.status === query.status);
            } else if (query.status.$in) {
                list = list.filter(b => query.status.$in.includes(b.status));
            }
        }

        if (query["resources.resourceId"]) {
            const rCond = query["resources.resourceId"];
            if (rCond.$in) {
                list = list.filter(b => (b.resources || []).some(r => rCond.$in.includes(r.resourceId)));
            } else {
                list = list.filter(b => (b.resources || []).some(r => r.resourceId === rCond));
            }
        }

        if (query.startTime && query.endTime) {
            // Check interval overlap in query if specified
            if (query.startTime.$lt && query.endTime.$gt) {
                list = list.filter(b => b.startTime < query.startTime.$lt && b.endTime > query.endTime.$gt);
            }
        }

        // Return thenable query object with sort/skip/limit chain
        return {
            _list: [...list],
            sort(sortObj) {
                if (sortObj.startTime) {
                    this._list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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

    Booking.findOne = async (query = {}) => {
        if (query["legacyRef.scheduleId"]) {
            for (const b of mockBookings.values()) {
                if (b.legacyRef?.scheduleId === query["legacyRef.scheduleId"]) return b;
            }
        }
        return null;
    };

    Booking.findById = async (id) => {
        return mockBookings.get(String(id)) || null;
    };

    Booking.countDocuments = async () => mockBookings.size;

    Booking.prototype.save = async function() {
        if (!this._id) {
            this._id = new mongoose.Types.ObjectId().toString();
        }
        mockBookings.set(String(this._id), this);
        return this;
    };

    // Mock HopDong queries
    HopDong.find = async (query = {}) => {
        let list = Array.from(mockContracts.values());
        if (query.maHopDong) {
            list = list.filter(c => c.maHopDong === query.maHopDong);
        }
        return list;
    };

    HopDong.findOne = async (query = {}) => {
        if (query.maHopDong) {
            for (const c of mockContracts.values()) {
                if (c.maHopDong === query.maHopDong) return c;
            }
        }
        return null;
    };

    HopDong.prototype.save = async function() {
        if (!this._id) {
            this._id = new mongoose.Types.ObjectId().toString();
        }
        mockContracts.set(String(this._id), this);
        return this;
    };

    function createMockBooking(data) {
        const id = data._id || new mongoose.Types.ObjectId().toString();
        const doc = new Booking({
            _id: id,
            maBooking: data.maBooking || `BK-${Date.now().toString().slice(-6)}`,
            title: data.title || "Lịch chụp mẫu",
            bookingType: data.bookingType || "PHOTO",
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            bufferMinutesBefore: data.bufferMinutesBefore || 0,
            bufferMinutesAfter: data.bufferMinutesAfter || 0,
            status: data.status || "TENTATIVE",
            resources: data.resources || [],
            diaDiem: data.diaDiem || "Tại Studio",
            ghiChu: data.ghiChu || "",
            conflictOverride: data.conflictOverride || { isOverridden: false },
            auditLog: data.auditLog || [],
            legacyRef: data.legacyRef || undefined
        });
        mockBookings.set(String(id), doc);
        return doc;
    }

    try {
        // Test 1: T-CAL01 Overlapping Schedule Conflict
        await test("1. T-CAL01: Overlapping intervals with same resource cannot be confirmed simultaneously (409 Conflict)", async () => {
            mockBookings.clear();

            // Booking 1: 10:00 to 11:30 with Photographer "tho_chup_along" (CONFIRMED)
            const b1 = createMockBooking({
                maBooking: "BK-CONF-01",
                title: "Chụp concept 1",
                startTime: "2026-11-10T10:00:00.000Z",
                endTime: "2026-11-10T11:30:00.000Z",
                status: "CONFIRMED",
                resources: [
                    { resourceId: "tho_chup_along", resourceType: "STAFF_PHOTO", resourceName: "A Long" }
                ]
            });

            // Booking 2: 11:00 to 12:00 with same Photographer "tho_chup_along" (TENTATIVE)
            const b2 = createMockBooking({
                maBooking: "BK-TENT-02",
                title: "Chụp concept 2",
                startTime: "2026-11-10T11:00:00.000Z",
                endTime: "2026-11-10T12:00:00.000Z",
                status: "TENTATIVE",
                resources: [
                    { resourceId: "tho_chup_along", resourceType: "STAFF_PHOTO", resourceName: "A Long" }
                ]
            });

            // Attempt to confirm Booking 2 without override -> Must fail with 409 Conflict
            const req = {
                params: { id: String(b2._id) },
                body: {},
                user: { username: "staff1", fullname: "Nhân viên Sale" }
            };
            const res = createMockRes();
            await bookingService.confirmBooking(req, res);

            assert.strictEqual(res.statusCode, 409, "Must return 409 Conflict for overlapping confirmed schedules");
            assert.strictEqual(res.data.error.code, "SCHEDULING_CONFLICT");
            assert.strictEqual(res.data.error.conflicts.length, 1);
            assert.strictEqual(res.data.error.conflicts[0].resourceId, "tho_chup_along");
            assert.strictEqual(b2.status, "TENTATIVE", "Status must remain TENTATIVE when conflict detected");
        });

        // Test 2: T-CAL02 Boundary Adjacent Intervals
        await test("2. T-CAL02: Boundary adjacent intervals (10:00-11:00 & 11:00-12:00) valid without buffer (200 OK)", async () => {
            mockBookings.clear();

            // Booking 1: 10:00 to 11:00 (CONFIRMED)
            createMockBooking({
                maBooking: "BK-ADJ-01",
                title: "Ca sáng 1",
                startTime: "2026-11-10T10:00:00.000Z",
                endTime: "2026-11-10T11:00:00.000Z",
                status: "CONFIRMED",
                resources: [
                    { resourceId: "tho_make_hoa", resourceType: "STAFF_MAKEUP", resourceName: "Thợ Hoa" }
                ]
            });

            // Booking 2: Exactly 11:00 to 12:00 (TENTATIVE)
            const b2 = createMockBooking({
                maBooking: "BK-ADJ-02",
                title: "Ca sáng 2",
                startTime: "2026-11-10T11:00:00.000Z",
                endTime: "2026-11-10T12:00:00.000Z",
                status: "TENTATIVE",
                resources: [
                    { resourceId: "tho_make_hoa", resourceType: "STAFF_MAKEUP", resourceName: "Thợ Hoa" }
                ]
            });

            const req = {
                params: { id: String(b2._id) },
                user: { fullname: "Sale Admin" }
            };
            const res = createMockRes();
            await bookingService.confirmBooking(req, res);

            assert.strictEqual(res.statusCode, 200, "Boundary adjacent intervals must succeed with 200 OK");
            assert.strictEqual(b2.status, "CONFIRMED", "Booking 2 must be confirmed successfully");
            assert(b2.confirmedAt instanceof Date);
        });

        // Test 3: Buffer Window Conflict Detection
        await test("3. Buffer Window: Buffer travel/setup time (15 mins) detects collision in buffer zone", async () => {
            mockBookings.clear();

            // Booking 1: 10:00 to 11:00 with 15 mins bufferAfter (effective until 11:15)
            createMockBooking({
                maBooking: "BK-BUF-01",
                title: "Chụp ngoại cảnh Hồ Tây",
                startTime: "2026-11-10T10:00:00.000Z",
                endTime: "2026-11-10T11:00:00.000Z",
                bufferMinutesAfter: 15, // 15 mins travel time
                status: "CONFIRMED",
                resources: [
                    { resourceId: "tho_chup_huy", resourceType: "STAFF_PHOTO" }
                ]
            });

            // Booking 2: 11:10 to 12:00 (falls inside 11:00 - 11:15 buffer window)
            const b2 = createMockBooking({
                maBooking: "BK-BUF-02",
                title: "Chụp Studio",
                startTime: "2026-11-10T11:10:00.000Z",
                endTime: "2026-11-10T12:00:00.000Z",
                status: "TENTATIVE",
                resources: [
                    { resourceId: "tho_chup_huy", resourceType: "STAFF_PHOTO" }
                ]
            });

            const req = {
                params: { id: String(b2._id) },
                user: { fullname: "Điều phối" }
            };
            const res = createMockRes();
            await bookingService.confirmBooking(req, res);

            assert.strictEqual(res.statusCode, 409, "Must reject when new schedule falls in buffer window");
            assert.strictEqual(res.data.error.code, "SCHEDULING_CONFLICT");
        });

        // Test 4: Manager Override
        await test("4. Manager Override: Manager can confirm with mandatory reason and audit entry", async () => {
            mockBookings.clear();

            createMockBooking({
                maBooking: "BK-OVR-01",
                startTime: "2026-11-10T10:00:00.000Z",
                endTime: "2026-11-10T12:00:00.000Z",
                status: "CONFIRMED",
                resources: [{ resourceId: "tho_chup_nam" }]
            });

            const b2 = createMockBooking({
                maBooking: "BK-OVR-02",
                startTime: "2026-11-10T11:00:00.000Z",
                endTime: "2026-11-10T13:00:00.000Z",
                status: "TENTATIVE",
                resources: [{ resourceId: "tho_chup_nam" }]
            });

            // Confirm with override
            const req = {
                params: { id: String(b2._id) },
                body: {
                    conflictOverride: {
                        isOverridden: true,
                        reason: "Khách VIP yêu cầu chụp chung 2 cặp tại phim trường"
                    }
                },
                user: { fullname: "Tổng quản lý", role: "Manager" }
            };
            const res = createMockRes();
            await bookingService.confirmBooking(req, res);

            assert.strictEqual(res.statusCode, 200, "Manager override must succeed");
            assert.strictEqual(b2.status, "CONFIRMED");
            assert.strictEqual(b2.conflictOverride.isOverridden, true);
            assert.strictEqual(b2.conflictOverride.reason, "Khách VIP yêu cầu chụp chung 2 cặp tại phim trường");
        });

        // Test 5: Idempotency & Resource Release
        await test("5. Idempotent Confirm & Cancel: Re-confirming is safe; cancelling frees resource immediately", async () => {
            mockBookings.clear();

            const b = createMockBooking({
                maBooking: "BK-IDEMP-01",
                startTime: "2026-11-10T14:00:00.000Z",
                endTime: "2026-11-10T16:00:00.000Z",
                status: "CONFIRMED",
                resources: [{ resourceId: "set_studio_1", resourceType: "STUDIO_SET" }]
            });

            // Re-confirming already confirmed booking
            const reqConfirm = { params: { id: String(b._id) }, user: { fullname: "Admin" } };
            const resConfirm = createMockRes();
            await bookingService.confirmBooking(reqConfirm, resConfirm);
            assert.strictEqual(resConfirm.statusCode, 200);
            assert(resConfirm.data.message.includes("Idempotent"));

            // Cancel booking
            const reqCancel = { params: { id: String(b._id) }, body: { reason: "Khách dời ngày" }, user: { fullname: "Admin" } };
            const resCancel = createMockRes();
            await bookingService.cancelBooking(reqCancel, resCancel);
            assert.strictEqual(resCancel.statusCode, 200);
            assert.strictEqual(b.status, "CANCELLED");

            // Now another booking can occupy this slot without conflict
            const bNew = createMockBooking({
                maBooking: "BK-NEW-01",
                startTime: "2026-11-10T14:00:00.000Z",
                endTime: "2026-11-10T16:00:00.000Z",
                status: "TENTATIVE",
                resources: [{ resourceId: "set_studio_1", resourceType: "STUDIO_SET" }]
            });
            const resNewConfirm = createMockRes();
            await bookingService.confirmBooking({ params: { id: String(bNew._id) }, user: { fullname: "Admin" } }, resNewConfirm);
            assert.strictEqual(resNewConfirm.statusCode, 200, "Must confirm cleanly once cancelled booking freed resource");
        });

        // Test 6: Availability Engine Query
        await test("6. Availability API: getAvailability returns busy windows and resource schedules", async () => {
            mockBookings.clear();

            createMockBooking({
                maBooking: "BK-AV-01",
                title: "Lịch chụp sáng",
                startTime: "2026-11-12T08:00:00.000Z",
                endTime: "2026-11-12T11:00:00.000Z",
                status: "CONFIRMED",
                resources: [{ resourceId: "tho_photo_1", resourceName: "Thợ 1" }]
            });

            const req = {
                query: {
                    start: "2026-11-12T00:00:00.000Z",
                    end: "2026-11-12T23:59:59.000Z",
                    resourceIds: "tho_photo_1,tho_photo_2"
                }
            };
            const res = createMockRes();
            await bookingService.getAvailability(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert(res.data.data.resources.tho_photo_1);
            assert.strictEqual(res.data.data.resources.tho_photo_1.busyIntervals.length, 1);
            assert.strictEqual(res.data.data.resources.tho_photo_1.busyIntervals[0].maBooking, "BK-AV-01");
        });

        // Test 7: Migration M05 Calendar to Booking Sync
        await test("7. Migration M05: Dry-run non-destructive; Apply backfills Bookings idempotently", async () => {
            mockContracts.clear();
            mockBookings.clear();

            // Contract 1: With serviceSchedules
            const c1 = new HopDong({
                _id: new mongoose.Types.ObjectId().toString(),
                maHopDong: "HD-M05-01",
                serviceSchedules: [
                    { id: "sch_1", serviceType: "photo", serviceName: "Chụp cưới", ngayGio: "2026-12-01T08:00:00.000Z", nhanVien: "tho_chup_a" },
                    { id: "sch_2", serviceType: "makeup", serviceName: "Trang điểm", ngayGio: "2026-12-01T06:00:00.000Z", nhanVien: "tho_make_b" }
                ]
            });
            mockContracts.set(String(c1._id), c1);

            // 1. Dry Run
            const dryRunResult = await runMigrationM05({ dryRun: true });
            assert.strictEqual(dryRunResult.contractsScanned, 1);
            assert.strictEqual(dryRunResult.schedulesExtracted, 2);
            assert.strictEqual(dryRunResult.bookingsCreated, 0, "Dry run must not create bookings");
            assert.strictEqual(mockBookings.size, 0);

            // 2. Apply
            const applyResult = await runMigrationM05({ dryRun: false });
            assert.strictEqual(applyResult.bookingsCreated, 2, "Apply must create 2 booking documents");
            assert.strictEqual(mockBookings.size, 2);

            // 3. Verify Idempotency: Re-run Apply must update, not duplicate
            const rerunResult = await runMigrationM05({ dryRun: false });
            assert.strictEqual(rerunResult.bookingsCreated, 0, "Re-run must not create duplicate bookings");
            assert.strictEqual(rerunResult.bookingsUpdated, 2, "Re-run must update existing bookings");
            assert.strictEqual(mockBookings.size, 2, "Collection size must remain exactly 2");
        });

    } catch (err) {
        console.error("Test execution aborted:", err);
    }

    console.log(`\nPR 3.2 SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
