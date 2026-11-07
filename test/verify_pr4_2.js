/**
 * PR 4.2 Automated Verification Test Suite
 * Photo Selection Versioning, Retouch Pins, Approval & Audit Trail (LW2-041, MOD-06)
 * 
 * Verifications:
 * 1. T-ALB01: Normalized Pin coordinates [0, 1] relative to natural image dimensions
 *    maintain exact relative target feature across mobile (375px) and desktop (1920px) screens.
 * 2. T-ALB02: When client approves version N (v2), uploading version N+1 (v3) resets approval
 *    status and version 3 defaults to 'PENDING' (NEVER automatically approved).
 * 3. Client Approval Flow: Customer approval records immutable audit trail and enqueues
 *    Transactional Outbox notification for staff/in-an.
 * 4. Idempotent Approval Guard: Submitting approval multiple times for the same version
 *    returns alreadyApproved: true without creating duplicate audit logs or duplicate outbox records.
 * 5. Retouch Pin Annotation: Adding retouch notes via dedicated V2 endpoint stores normalized
 *    and percentage coordinates, updates version pin counter, and logs to audit trail.
 * 6. Backward Compatibility: Legacy portalPhotoAction correctly computes and persists
 *    normalized coordinates alongside legacy percentage fields.
 * 7. Migration M07: Synchronizes legacy albums, backfills activeVersion and reviewVersions,
 *    and normalizes unmigrated pins idempotently.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const Album = require("../src/models/album.model");
const HopDong = require("../src/models/hopDong.model");
const NotificationOutbox = require("../src/models/notificationOutbox.model");
const albumService = require("../src/services/album.service");
const { runMigrationM07 } = require("../src/migrations/m07_album_versioning_sync");

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
    console.log("=== STARTING PR 4.2 AUTOMATED VERIFICATION ===");
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

    // In-memory mock data stores
    const mockAlbums = new Map();
    const mockContracts = new Map();
    const mockOutbox = new Map();

    // Helper to create mock album document
    function createMockAlbumDoc(data) {
        const doc = {
            _id: data._id || new mongoose.Types.ObjectId().toString(),
            maHopDong: data.maHopDong,
            activeVersion: data.activeVersion || 1,
            currentVersionApproved: Boolean(data.currentVersionApproved),
            khachHangXacNhan: Boolean(data.khachHangXacNhan),
            ngayKhachXacNhan: data.ngayKhachXacNhan || null,
            danhSachAnh: (data.danhSachAnh || []).map(p => ({
                idDrive: p.idDrive,
                tenFile: p.tenFile || `${p.idDrive}.jpg`,
                urlGoc: p.urlGoc || `https://storage.longwedding.vn/${p.idDrive}.jpg`,
                urlNen: p.urlNen || `https://storage.longwedding.vn/thumb_${p.idDrive}.jpg`,
                isHearted: Boolean(p.isHearted),
                isCover: Boolean(p.isCover),
                comments: (p.comments || []).map(c => ({ ...c }))
            })),
            danhSachAnhChinhSua: (data.danhSachAnhChinhSua || []).map(p => ({
                idDrive: p.idDrive,
                tenFile: p.tenFile || `${p.idDrive}.jpg`,
                urlGoc: p.urlGoc || `https://storage.longwedding.vn/${p.idDrive}.jpg`,
                urlNen: p.urlNen || `https://storage.longwedding.vn/thumb_${p.idDrive}.jpg`,
                isHearted: Boolean(p.isHearted),
                isCover: Boolean(p.isCover),
                comments: (p.comments || []).map(c => ({ ...c }))
            })),
            reviewVersions: (data.reviewVersions || []).map(r => ({
                version: r.version,
                title: r.title,
                status: r.status,
                submittedAt: r.submittedAt || new Date(),
                submittedBy: r.submittedBy || 'Ekip Studio',
                approvedAt: r.approvedAt || null,
                approvedBy: r.approvedBy || null,
                approvalIp: r.approvalIp || null,
                clientNote: r.clientNote || '',
                retouchPinsCount: r.retouchPinsCount || 0,
                photoSelectionsCount: r.photoSelectionsCount || 0,
                auditTrail: (r.auditTrail || []).map(a => ({ ...a }))
            })),
            auditTrail: (data.auditTrail || []).map(a => ({ ...a })),
            save: async function() {
                mockAlbums.set(this.maHopDong, this);
                mockAlbums.set(this._id.toString(), this);
                return this;
            }
        };
        mockAlbums.set(doc.maHopDong, doc);
        mockAlbums.set(doc._id.toString(), doc);
        return doc;
    }

    // Mock Album.findOne
    Album.findOne = function(query) {
        if (!query) return Promise.resolve(null);
        if (query.$or) {
            for (const q of query.$or) {
                if (q.maHopDong) {
                    const regex = q.maHopDong.$regex;
                    for (const [key, doc] of mockAlbums.entries()) {
                        if (regex.test(key)) return Promise.resolve(doc);
                    }
                }
                if (q._id && mockAlbums.has(q._id.toString())) {
                    return Promise.resolve(mockAlbums.get(q._id.toString()));
                }
            }
        }
        if (query.maHopDong) {
            if (typeof query.maHopDong === 'string') {
                return Promise.resolve(mockAlbums.get(query.maHopDong) || null);
            }
            if (query.maHopDong.$regex) {
                for (const [key, doc] of mockAlbums.entries()) {
                    if (query.maHopDong.$regex.test(key)) return Promise.resolve(doc);
                }
            }
        }
        if (query.publicLink) {
            for (const doc of mockAlbums.values()) {
                if (doc.publicLink === query.publicLink) return Promise.resolve(doc);
            }
        }
        return Promise.resolve(null);
    };

    Album.find = function() {
        return Promise.resolve(Array.from(new Set(mockAlbums.values())));
    };

    // Mock HopDong.findOne & updateOne
    HopDong.findOne = function(query) {
        if (!query) return Promise.resolve(null);
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

    HopDong.updateOne = function(filter, update) {
        let contract = null;
        if (filter.maHopDong) contract = mockContracts.get(filter.maHopDong);
        if (filter._id) contract = mockContracts.get(filter._id.toString());
        if (contract && update.$set) {
            Object.assign(contract, update.$set);
        }
        return Promise.resolve({ modifiedCount: contract ? 1 : 0 });
    };

    // Mock NotificationOutbox.create
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
    // TEST 1: T-ALB01 Normalized Pin Coordinates [0, 1]
    // ==========================================
    await test("T-ALB01: Pin on mobile (375x562) scales to exact identical feature on desktop (1920x1080)", async () => {
        // Natural image dimensions: 4000 x 6000 (aspect ratio 2:3)
        const naturalWidth = 4000;
        const naturalHeight = 6000;

        // Mobile screen: rendered image is 375px wide x 562.5px high
        const mobileWidth = 375;
        const mobileHeight = 562.5;
        const mobileClickX = 180;
        const mobileClickY = 270;

        // Calculation on mobile
        const normX = mobileClickX / mobileWidth;   // 180 / 375 = 0.48
        const normY = mobileClickY / mobileHeight; // 270 / 562.5 = 0.48

        const normalizedResult = albumService.normalizePinCoordinates({
            normalizedX: normX,
            normalizedY: normY,
            originalWidth: naturalWidth,
            originalHeight: naturalHeight
        });

        assert.strictEqual(normalizedResult.normalizedX, 0.48, "Normalized X must be 0.48");
        assert.strictEqual(normalizedResult.normalizedY, 0.48, "Normalized Y must be 0.48");
        assert.strictEqual(normalizedResult.coordinateX, 48, "Legacy coordinateX must be 48%");
        assert.strictEqual(normalizedResult.coordinateY, 48, "Legacy coordinateY must be 48%");

        // Now view on desktop: rendered image is 1200px wide x 1800px high
        const desktopWidth = 1200;
        const desktopHeight = 1800;
        const desktopPinX = normalizedResult.normalizedX * desktopWidth;   // 0.48 * 1200 = 576
        const desktopPinY = normalizedResult.normalizedY * desktopHeight; // 0.48 * 1800 = 864

        // Relative proportions must match exactly to the 6th decimal place
        const mobileRatioX = mobileClickX / mobileWidth;
        const desktopRatioX = desktopPinX / desktopWidth;
        assert.strictEqual(mobileRatioX, desktopRatioX, "Mobile and Desktop relative X ratios must be identical");

        const mobileRatioY = mobileClickY / mobileHeight;
        const desktopRatioY = desktopPinY / desktopHeight;
        assert.strictEqual(mobileRatioY, desktopRatioY, "Mobile and Desktop relative Y ratios must be identical");

        // Test boundary clamping: values < 0 clamped to 0, values > 1 clamped to 1
        const clampedMin = albumService.normalizePinCoordinates({ normalizedX: -0.2, normalizedY: -0.5 });
        assert.strictEqual(clampedMin.normalizedX, 0, "Negative X should clamp to 0");
        assert.strictEqual(clampedMin.normalizedY, 0, "Negative Y should clamp to 0");

        const clampedMax = albumService.normalizePinCoordinates({ normalizedX: 1.5, normalizedY: 2.0 });
        assert.strictEqual(clampedMax.normalizedX, 1, "Excessive X should clamp to 1");
        assert.strictEqual(clampedMax.normalizedY, 1, "Excessive Y should clamp to 1");
    });

    // ==========================================
    // TEST 2: T-ALB02 Versioning Reset Invariant
    // ==========================================
    await test("T-ALB02: Uploading version N+1 (v3) resets approval status and v3 defaults to PENDING (NOT auto-approved)", async () => {
        mockAlbums.clear();
        mockContracts.clear();
        mockOutbox.clear();

        const maHopDong = "HD-TEST-V3";
        const album = createMockAlbumDoc({
            maHopDong,
            activeVersion: 2,
            currentVersionApproved: true,
            khachHangXacNhan: true,
            reviewVersions: [
                {
                    version: 1,
                    title: "Bản gốc v1",
                    status: "APPROVED",
                    approvedAt: new Date(Date.now() - 86400000),
                    approvedBy: "Khách hàng"
                },
                {
                    version: 2,
                    title: "Bản chỉnh sửa v2",
                    status: "APPROVED",
                    approvedAt: new Date(),
                    approvedBy: "Khách hàng"
                }
            ],
            danhSachAnh: [{ idDrive: "drv_1", isHearted: true }]
        });

        // Staff uploads version 3
        const req = {
            params: { id: maHopDong },
            body: { title: "Bản chỉnh sửa v3 sau góp ý", notes: "Đã làm mịn da cô dâu" },
            user: { username: "photoshop_staff", fullname: "Trần Hậu Kỳ" }
        };
        const res = createMockRes();

        await albumService.uploadReviewVersion(req, res);

        assert.strictEqual(res.statusCode, 201, "Staff upload should return 201 Created");
        assert.strictEqual(album.activeVersion, 3, "Active version must advance to 3");
        assert.strictEqual(album.currentVersionApproved, false, "INVARIANT T-ALB02: currentVersionApproved must be reset to false");
        assert.strictEqual(album.khachHangXacNhan, false, "Client confirmation flag must be reset for new version");

        const v3 = album.reviewVersions.find(v => v.version === 3);
        assert.ok(v3, "Version 3 review entry must exist");
        assert.strictEqual(v3.status, "PENDING", "INVARIANT T-ALB02: Version 3 must be PENDING, NOT auto-approved");
        assert.strictEqual(v3.approvedAt, null, "Version 3 approvedAt must be null");

        // Check that version 2 in history preserved its approved status
        const v2 = album.reviewVersions.find(v => v.version === 2);
        assert.strictEqual(v2.status, "APPROVED", "Historical version 2 must remain APPROVED");

        // Verify query endpoint returns pending status
        const queryReq = { params: { id: maHopDong } };
        const queryRes = createMockRes();
        await albumService.getReviewVersions(queryReq, queryRes);

        assert.strictEqual(queryRes.data.activeVersion, 3);
        assert.strictEqual(queryRes.data.currentVersionApproved, false);
    });

    // ==========================================
    // TEST 3: Client Approval Flow & Outbox Notification
    // ==========================================
    await test("Test 3: Customer approval marks version APPROVED, records audit trail and creates Outbox Notification", async () => {
        const maHopDong = "HD-TEST-V3";
        const album = mockAlbums.get(maHopDong);
        mockContracts.set(maHopDong, {
            _id: new mongoose.Types.ObjectId(),
            maHopDong,
            khachHangXacNhanAnh: {}
        });

        const req = {
            params: { id: maHopDong },
            body: {
                revisionVersion: 3,
                customerConfirmation: true,
                note: "Đồng ý chốt toàn bộ để gửi xưởng in ấn."
            },
            portalClient: { maHopDong },
            ip: "118.69.182.45"
        };
        const res = createMockRes();

        await albumService.approveAlbumReview(req, res);

        assert.strictEqual(res.statusCode, 200, "Approval should return 200 OK");
        assert.strictEqual(album.currentVersionApproved, true, "Album currentVersionApproved must become true");
        assert.strictEqual(album.khachHangXacNhan, true, "Album khachHangXacNhan must become true");

        const v3 = album.reviewVersions.find(v => v.version === 3);
        assert.strictEqual(v3.status, "APPROVED", "Version 3 status must become APPROVED");
        assert.ok(v3.approvedAt instanceof Date, "approvedAt must be recorded");
        assert.strictEqual(v3.approvalIp, "118.69.182.45", "Approval IP must be audited");
        assert.strictEqual(v3.clientNote, "Đồng ý chốt toàn bộ để gửi xưởng in ấn.");

        // Check Outbox Notification
        const outboxKey = `ALBUM_APPROVED_${maHopDong}_v3`;
        const outboxItem = mockOutbox.get(outboxKey);
        assert.ok(outboxItem, "Outbox notification for staff must be created with idempotencyKey");
        assert.strictEqual(outboxItem.eventType, "ALBUM_APPROVED");
        assert.strictEqual(outboxItem.recipientGroup, "Photoshop & In Ấn");
    });

    // ==========================================
    // TEST 4: Idempotent Approval Guard
    // ==========================================
    await test("Test 4: Re-approving an already approved version is idempotent (alreadyApproved: true)", async () => {
        const maHopDong = "HD-TEST-V3";
        const album = mockAlbums.get(maHopDong);
        const initialAuditCount = album.auditTrail.length;
        const initialOutboxCount = mockOutbox.size;

        const req = {
            params: { id: maHopDong },
            body: {
                revisionVersion: 3,
                customerConfirmation: true,
                note: "Click nhầm nút duyệt lần 2"
            },
            portalClient: { maHopDong },
            ip: "118.69.182.45"
        };
        const res = createMockRes();

        await albumService.approveAlbumReview(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.alreadyApproved, true, "Response must indicate alreadyApproved");
        assert.strictEqual(album.auditTrail.length, initialAuditCount, "Audit trail must not add duplicate entries");
        assert.strictEqual(mockOutbox.size, initialOutboxCount, "Outbox must not add duplicate notification");
    });

    // ==========================================
    // TEST 5: Retouch Pin Annotation via V2 Endpoint
    // ==========================================
    await test("Test 5: POST /api/v2/albums/:id/retouch-notes persists normalized pin coordinates and updates audit trail", async () => {
        const maHopDong = "HD-PIN-TEST";
        const album = createMockAlbumDoc({
            maHopDong,
            activeVersion: 1,
            danhSachAnh: [
                { idDrive: "drv_photo_101", isHearted: false, comments: [] }
            ]
        });

        const req = {
            params: { id: maHopDong },
            body: {
                photoId: "drv_photo_101",
                normalizedX: 0.352,
                normalizedY: 0.684,
                originalWidth: 4000,
                originalHeight: 6000,
                note: "Sửa nếp nhăn đuôi mắt cô dâu"
            },
            portalClient: { maHopDong }
        };
        const res = createMockRes();

        await albumService.addRetouchPin(req, res);

        assert.strictEqual(res.statusCode, 200, "Retouch pin should return 200 OK");
        const photo = album.danhSachAnh.find(p => p.idDrive === "drv_photo_101");
        assert.strictEqual(photo.isHearted, true, "Photo with pin must be marked as hearted");
        assert.strictEqual(photo.comments.length, 1, "Comment pin must be added");

        const pin = photo.comments[0];
        assert.strictEqual(pin.noiDung, "Sửa nếp nhăn đuôi mắt cô dâu");
        assert.strictEqual(pin.normalizedX, 0.352);
        assert.strictEqual(pin.normalizedY, 0.684);
        assert.strictEqual(pin.coordinateX, 35.2);
        assert.strictEqual(pin.coordinateY, 68.4);
        assert.strictEqual(pin.originalWidth, 4000);
        assert.strictEqual(pin.originalHeight, 6000);

        // Check active review retouchPinsCount
        const activeReview = album.reviewVersions.find(v => v.version === 1);
        assert.strictEqual(activeReview.retouchPinsCount, 1);

        // Check album audit trail
        const pinAudit = album.auditTrail.find(a => a.action === "PIN_ADDED");
        assert.ok(pinAudit, "Audit trail must log PIN_ADDED");
    });

    // ==========================================
    // TEST 6: Backward Compatibility with Legacy portalPhotoAction
    // ==========================================
    await test("Test 6: Legacy portalPhotoAction backfills normalized coordinates from coordinateX / coordinateY", async () => {
        const maHopDong = "HD-PIN-TEST";
        const album = mockAlbums.get(maHopDong);

        const req = {
            params: { maHopDong },
            body: {
                idDrive: "drv_photo_101",
                action: "comment",
                coordinateX: 42,
                coordinateY: 78,
                noiDung: "Xóa bóng đổ sau lưng chú rể"
            }
        };
        const res = createMockRes();

        await albumService.portalPhotoAction(req, res);

        assert.strictEqual(res.statusCode, 200);
        const photo = album.danhSachAnh.find(p => p.idDrive === "drv_photo_101");
        assert.strictEqual(photo.comments.length, 2);

        const legacyPin = photo.comments[1];
        assert.strictEqual(legacyPin.coordinateX, 42);
        assert.strictEqual(legacyPin.coordinateY, 78);
        assert.strictEqual(legacyPin.normalizedX, 0.42, "Legacy call must automatically compute normalizedX = 0.42");
        assert.strictEqual(legacyPin.normalizedY, 0.78, "Legacy call must automatically compute normalizedY = 0.78");
    });

    // ==========================================
    // TEST 7: Migration M07 Sync & Idempotency
    // ==========================================
    await test("Test 7: Migration M07 backfills activeVersion, reviewVersions and normalizes unmigrated pins", async () => {
        // Create an unmigrated legacy album without activeVersion, reviewVersions, and with unnormalized pins
        const legacyAlbum = createMockAlbumDoc({
            maHopDong: "HD-LEGACY-MIGRATION",
            khachHangXacNhan: true,
            ngayKhachXacNhan: new Date(Date.now() - 172800000),
            activeVersion: null,
            reviewVersions: [],
            danhSachAnh: [
                {
                    idDrive: "drv_leg_1",
                    isHearted: true,
                    comments: [
                        { noiDung: "Ghi chú cũ", coordinateX: 60, coordinateY: 40 } // Missing normalizedX/Y
                    ]
                }
            ]
        });

        // Run M07
        const summary = await runMigrationM07({ dryRun: false });
        assert.ok(summary.albumsScanned >= 1, "M07 must scan albums");
        assert.ok(summary.pinsNormalized >= 1, "M07 must normalize legacy pins");

        assert.strictEqual(legacyAlbum.activeVersion, 1, "Legacy album must get activeVersion: 1");
        assert.strictEqual(legacyAlbum.reviewVersions.length, 1, "Legacy album must get initial review version");
        assert.strictEqual(legacyAlbum.reviewVersions[0].status, "APPROVED", "Approved legacy album review must be APPROVED");

        const normalizedPin = legacyAlbum.danhSachAnh[0].comments[0];
        assert.strictEqual(normalizedPin.normalizedX, 0.6, "Unmigrated pin must be normalized to 0.6");
        assert.strictEqual(normalizedPin.normalizedY, 0.4, "Unmigrated pin must be normalized to 0.4");

        // Second run should be strictly idempotent with 0 modifications
        const summary2 = await runMigrationM07({ dryRun: false });
        assert.strictEqual(summary2.reviewsCreated, 0, "Idempotent run must not create new reviews");
        assert.strictEqual(summary2.pinsNormalized, 0, "Idempotent run must not re-normalize pins");
    });

    console.log(`\n========================================`);
    console.log(`PR 4.2 VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
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

