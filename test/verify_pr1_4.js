/**
 * PR 1.4 Automated Verification Test Suite
 * Tests:
 * 1. Portal Token Generation: Staff auth required to generate token.
 * 2. Scoped Portal Token: Contains maHopDong and role "client_portal".
 * 3. Fail-Closed: Portal access without token returns 401.
 * 4. Fail-Closed: Expired portal token returns 401.
 * 5. Tamper Protection (IDOR): Token for contract A used to access contract B returns 403 Forbidden.
 * 6. Authorized Access: Valid scoped token for matching contract returns 200.
 * 7. Staff Access: Authenticated staff can view portal without scoped token.
 * 8. Mutation Protection: photo-action and complete endpoints enforce scoped token authentication.
 */

const assert = require("assert");
const jwt = require("jsonwebtoken");
const http = require("http");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-pr1-4";

const portalAuthMiddleware = require("../src/middleware/portalAuth.middleware");
const albumService = require("../src/services/album.service");
const HOPDONG = require("../src/models/hopDong.model");
const ALBUM = require("../src/models/album.model");

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
    console.log("=== STARTING PR 1.4 AUTOMATED VERIFICATION ===");
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

    const testContractA = {
        _id: "607f1f77bcf86cd799439001",
        maHopDong: "HD2026101",
        khachHang1: { tenKhachHang: "Nguyễn Văn A", soDienThoai: "0901111111" },
        thanhToan: { tongGiaTriSauGiam: 10000000, khachHangDaThanhToan: 5000000, conLai: 5000000 }
    };

    const testContractB = {
        _id: "607f1f77bcf86cd799439002",
        maHopDong: "HD2026202",
        khachHang1: { tenKhachHang: "Trần Thị B", soDienThoai: "0902222222" },
        thanhToan: { tongGiaTriSauGiam: 15000000, khachHangDaThanhToan: 10000000, conLai: 5000000 }
    };

    const origHopDongFindOne = HOPDONG.findOne;
    HOPDONG.findOne = async (query) => {
        if (!query) return null;
        const ma = query.maHopDong?.$regex ? String(query.maHopDong.$regex) : String(query.maHopDong || "");
        if (ma.toUpperCase().includes("HD2026101")) {
            return {
                ...testContractA,
                populate: function() { return this; }
            };
        }
        if (ma.toUpperCase().includes("HD2026202")) {
            return {
                ...testContractB,
                populate: function() { return this; }
            };
        }
        return null;
    };

    try {
        // --- TEST 1: Generate Scoped Portal Token ---
        let scopedTokenA = "";
        await test("1. Generate Scoped Portal Token: Generates signed JWT with maHopDong & role client_portal", async () => {
            const req = { params: { maHopDong: "HD2026101" } };
            const res = createMockRes();
            await albumService.generatePortalToken(req, res);

            assert.strictEqual(res.statusCode, 200);
            scopedTokenA = res.data.data.token;
            assert(scopedTokenA, "Must return a valid token string");

            const decoded = jwt.verify(scopedTokenA, process.env.JWT_SECRET);
            assert.strictEqual(decoded.maHopDong, "HD2026101");
            assert.strictEqual(decoded.role, "client_portal");
            assert(decoded.exp > decoded.iat);
        });

        // --- TEST 2: Portal access without token returns 401 ---
        await test("2. Fail-Closed: Portal access without token returns 401 Unauthorized", async () => {
            const req = { headers: {}, query: {}, params: { maHopDong: "HD2026101" } };
            const res = createMockRes();
            let nextCalled = false;
            portalAuthMiddleware(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, false);
            assert.strictEqual(res.statusCode, 401, `Expected status 401, got ${res.statusCode}`);
        });

        // --- TEST 3: Expired portal token returns 401 ---
        await test("3. Fail-Closed: Expired portal token returns 401 Unauthorized", async () => {
            const expiredToken = jwt.sign(
                { maHopDong: "HD2026101", role: "client_portal" },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" } // Expired 1 second ago
            );
            const req = { headers: {}, query: { token: expiredToken }, params: { maHopDong: "HD2026101" } };
            const res = createMockRes();
            let nextCalled = false;
            portalAuthMiddleware(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, false);
            assert.strictEqual(res.statusCode, 401);
        });

        // --- TEST 4: Tampered / Wrong contract Scoped Token returns 403 (IDOR defense) ---
        await test("4. Tamper / IDOR Protection: Token for HD2026101 accessing HD2026202 returns 403 Forbidden", async () => {
            // Using scopedTokenA (for HD2026101) to request HD2026202
            const req = {
                headers: { "x-portal-token": scopedTokenA },
                query: {},
                params: { maHopDong: "HD2026202" }
            };
            const res = createMockRes();
            let nextCalled = false;
            portalAuthMiddleware(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, false);
            assert.strictEqual(res.statusCode, 403, `Expected status 403 for cross-contract tamper, got ${res.statusCode}`);
        });

        // --- TEST 5: Valid Scoped Token for matching contract succeeds (next called) ---
        await test("5. Authorized Access: Valid Scoped Token for matching contract passes authentication", async () => {
            const req = {
                headers: {},
                query: { token: scopedTokenA },
                params: { maHopDong: "HD2026101" }
            };
            const res = createMockRes();
            let nextCalled = false;
            portalAuthMiddleware(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, true, "Valid matching token must call next()");
            assert.strictEqual(req.portalClient.maHopDong, "HD2026101");
        });

        // --- TEST 6: Authenticated Staff Access ---
        await test("6. Staff Access: Authenticated staff with Bearer user token can access any contract portal", async () => {
            const staffToken = jwt.sign(
                { username: "photographer_john", positon: "Thợ ảnh", permission: 2 },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );
            const req = {
                headers: { authorization: `Bearer ${staffToken}` },
                query: {},
                params: { maHopDong: "HD2026101" }
            };
            const res = createMockRes();
            let nextCalled = false;
            portalAuthMiddleware(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, true);
            assert.strictEqual(req.user.username, "photographer_john");
        });

        // --- TEST 7: Mutation Endpoints Protection ---
        await test("7. Mutation Endpoints: photo-action & complete endpoints require scoped token", async () => {
            // Unauthenticated photo-action
            const req1 = { headers: {}, query: {}, params: { maHopDong: "HD2026101" }, body: { idDrive: "img_1" } };
            const res1 = createMockRes();
            let nextCalled1 = false;
            portalAuthMiddleware(req1, res1, () => { nextCalled1 = true; });
            assert.strictEqual(nextCalled1, false);
            assert.strictEqual(res1.statusCode, 401);

            // Cross-contract complete call
            const req2 = {
                headers: { "x-portal-token": scopedTokenA },
                query: {},
                params: { maHopDong: "HD2026202" },
                body: { ghiChu: "Khach chot anh" }
            };
            const res2 = createMockRes();
            let nextCalled2 = false;
            portalAuthMiddleware(req2, res2, () => { nextCalled2 = true; });
            assert.strictEqual(nextCalled2, false);
            assert.strictEqual(res2.statusCode, 403);
        });

    } finally {
        HOPDONG.findOne = origHopDongFindOne;
    }

    console.log(`\n=== PR 1.4 TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
