/**
 * PR 1.2 Verification Test Suite
 * Tests:
 * 1. Access token expiration is strictly bounded (24h for remember, 2h for session, NEVER 36500d).
 * 2. Rotating Refresh Token creation, hashing, and storage.
 * 3. Token Versioning: Incrementing tokenVersion invalidates existing access tokens (revocation).
 * 4. Refresh token rotation: Old refresh token is invalidated upon rotation.
 * 5. Legacy refreshToken fallback: Supports v1 client payload { token } gracefully.
 * 6. Logout: Invalidation of tokens on logout.
 * 7. Admin bypass removal: User "along" or "dev" without "Quản lý" role receives 403.
 */

const assert = require("assert");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-12345678901234567890";

const User = require("../src/models/user.model");
const checkRole = require("../src/middleware/role.middleware");
const authMiddleware = require("../src/middleware/auth.middleware");
const authService = require("../src/services/user.service");

// Mock Express req/res helper
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
    console.log("=== STARTING PR 1.2 AUTOMATED VERIFICATION ===");
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

    // 1. Mock DB storage in User model methods for isolated testing
    const mockUsers = new Map();

    const origFindOne = User.findOne;
    const origFindOneAndDelete = User.findOneAndDelete;
    const origSave = User.prototype.save;

    User.findOne = function(query) {
        return {
            select(fields) {
                return this.exec();
            },
            exec() {
                if (query.username) {
                    return Promise.resolve(mockUsers.get(query.username) || null);
                }
                if (query["refreshTokens.tokenHash"]) {
                    const hash = query["refreshTokens.tokenHash"];
                    for (const u of mockUsers.values()) {
                        const found = (u.refreshTokens || []).some(t => t.tokenHash === hash && t.expiresAt > new Date());
                        if (found) return Promise.resolve(u);
                    }
                    return Promise.resolve(null);
                }
                return Promise.resolve(null);
            },
            then(resolve, reject) {
                return this.exec().then(resolve, reject);
            }
        };
    };

    try {
        // --- TEST 1: Bound token expiry ---
        await test("1. Access token expiration is strictly bounded (<= 24h, not 36500d)", async () => {
            const testUser = new User({
                username: "test_staff",
                password: "hashed_password",
                fullname: "Test Staff",
                positon: "Nhân viên",
                permission: 2,
                tokenVersion: 1
            });
            testUser.comparePassword = async () => true;
            testUser.save = async function() { mockUsers.set(this.username, this); return this; };
            mockUsers.set("test_staff", testUser);

            const reqRemember = { headers: {}, body: { username: "test_staff", password: "pwd", remember: true } };
            const resRemember = createMockRes();
            await authService.loginUser(reqRemember, resRemember);

            assert.strictEqual(resRemember.statusCode, 200);
            const tokenRem = resRemember.data.data.accessToken;
            const decodedRem = jwt.decode(tokenRem);
            const lifespanRem = decodedRem.exp - decodedRem.iat;
            assert(lifespanRem <= 86400, `Token lifespan for remember=true must be <= 24h (86400s), got: ${lifespanRem}`);
            assert(lifespanRem > 0);

            // Test remember = false (2h)
            const reqNoRem = { headers: {}, body: { username: "test_staff", password: "pwd", remember: false } };
            const resNoRem = createMockRes();
            await authService.loginUser(reqNoRem, resNoRem);
            const decodedNoRem = jwt.decode(resNoRem.data.data.accessToken);
            const lifespanNoRem = decodedNoRem.exp - decodedNoRem.iat;
            assert(lifespanNoRem <= 7200, `Token lifespan for remember=false must be <= 2h (7200s), got: ${lifespanNoRem}`);
        });

        // --- TEST 2: Rotating Refresh Token issued and hashed ---
        await test("2. Rotating Refresh Token is issued, hashed in DB, and returned to client", async () => {
            const user = mockUsers.get("test_staff");
            assert(user.refreshTokens.length > 0, "User must have at least 1 stored refresh token");
            const storedHash = user.refreshTokens[0].tokenHash;
            assert(storedHash && storedHash.length === 64, "Stored token must be SHA-256 hash (64 hex characters)");
        });

        // --- TEST 3: Modern Refresh Token rotation ---
        await test("3. Refresh token rotation invalidates old refresh token and provides new one", async () => {
            const reqLogin = { headers: {}, body: { username: "test_staff", password: "pwd", remember: true } };
            const resLogin = createMockRes();
            await authService.loginUser(reqLogin, resLogin);
            const initialRefreshToken = resLogin.data.data.refreshToken;

            // Refresh token call
            const reqRefresh = { headers: {}, body: { refreshToken: initialRefreshToken } };
            const resRefresh = createMockRes();
            await authService.refreshToken(reqRefresh, resRefresh);

            assert.strictEqual(resRefresh.statusCode, 200);
            const rotatedRefreshToken = resRefresh.data.data.refreshToken;
            assert.notStrictEqual(initialRefreshToken, rotatedRefreshToken, "New refresh token must be rotated");

            // Attempting to reuse old refresh token must fail
            const reqReuse = { headers: {}, body: { refreshToken: initialRefreshToken } };
            const resReuse = createMockRes();
            await authService.refreshToken(reqReuse, resReuse);
            assert.strictEqual(resReuse.statusCode, 401, "Reusing old refresh token must return 401");
        });

        // --- TEST 4: Token Versioning Revocation ---
        await test("4. Incrementing tokenVersion invalidates existing access tokens", async () => {
            const user = mockUsers.get("test_staff");
            user.tokenVersion = 1;
            const validToken = jwt.sign(
                { username: user.username, tokenVersion: 1 },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            // Verify with current tokenVersion -> passes
            let req = { headers: { authorization: `Bearer ${validToken}` } };
            let res = createMockRes();
            let nextCalled = false;
            await authMiddleware(req, res, () => { nextCalled = true; });
            assert.strictEqual(nextCalled, true, "Valid tokenVersion should call next()");

            // Bump tokenVersion in DB (simulate revocation / password change / logout)
            user.tokenVersion = 2;
            nextCalled = false;
            res = createMockRes();
            await authMiddleware(req, res, () => { nextCalled = true; });
            assert.strictEqual(nextCalled, false, "Revoked tokenVersion must NOT call next()");
            assert.strictEqual(res.statusCode, 401, "Revoked tokenVersion must return 401");
        });

        // --- TEST 5: Logout revokes session ---
        await test("5. Logout endpoint revokes token session", async () => {
            const user = mockUsers.get("test_staff");
            user.tokenVersion = 2;
            const tokenBeforeLogout = jwt.sign(
                { username: user.username, tokenVersion: 2 },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            const reqLogout = {
                headers: {},
                user: { username: "test_staff" },
                body: { allDevices: true }
            };
            const resLogout = createMockRes();
            await authService.logoutUser(reqLogout, resLogout);
            assert.strictEqual(resLogout.statusCode, 200);

            // User tokenVersion should have incremented to 3
            assert.strictEqual(user.tokenVersion, 3, "Logout should increment tokenVersion");

            // Old token now rejected
            const reqCheck = { headers: { authorization: `Bearer ${tokenBeforeLogout}` } };
            const resCheck = createMockRes();
            let nextCalled = false;
            await authMiddleware(reqCheck, resCheck, () => { nextCalled = true; });
            assert.strictEqual(resCheck.statusCode, 401, "Token before logout must be rejected with 401");
        });

        // --- TEST 6: Hardcoded Superadmin Bypass Removal ---
        await test("6. Hardcoded 'along' and 'dev' usernames cannot bypass role checks without Manager role", async () => {
            const alongUser = new User({
                username: "along",
                fullname: "A Long",
                positon: "Nhân viên", // NOT Quản lý / Admin
                permission: 2
            });
            mockUsers.set("along", alongUser);

            const managerMiddleware = checkRole(["Quản lý"]);

            // Request by 'along' who is merely 'Nhân viên'
            const reqAlong = { headers: {}, user: { username: "along" } };
            const resAlong = createMockRes();
            let nextCalled = false;
            await managerMiddleware(reqAlong, resAlong, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, false, "along without Quản lý role must NOT be allowed");
            assert.strictEqual(resAlong.statusCode, 403, "along without Quản lý role must return 403 Forbidden");

            // Real manager should succeed
            const realManager = new User({
                username: "real_manager",
                fullname: "Manager One",
                positon: "Quản lý",
                permission: 1
            });
            mockUsers.set("real_manager", realManager);

            const reqManager = { headers: {}, user: { username: "real_manager" } };
            const resManager = createMockRes();
            nextCalled = false;
            await managerMiddleware(reqManager, resManager, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, true, "Real Quản lý must pass checkRole");
        });

        // --- TEST 7: Legacy v1 Refresh Token support ---
        await test("7. Legacy refreshToken endpoint accepts { token: legacyToken } and issues bounded token", async () => {
            const user = mockUsers.get("test_staff");
            user.tokenVersion = 5;
            const legacyToken = jwt.sign(
                { username: user.username, tokenVersion: 5 },
                process.env.JWT_SECRET,
                { expiresIn: "10m" }
            );

            const reqLegacy = { headers: {}, body: { token: legacyToken } };
            const resLegacy = createMockRes();
            await authService.refreshToken(reqLegacy, resLegacy);

            assert.strictEqual(resLegacy.statusCode, 200);
            assert(resLegacy.data.data.token, "Response must include compat token");
            assert(resLegacy.data.data.refreshToken, "Response must include modern refreshToken");
            const newDecoded = jwt.decode(resLegacy.data.data.token);
            assert(newDecoded.exp - newDecoded.iat <= 86400, "New token must be bounded to <= 24h");
        });

    } finally {
        User.findOne = origFindOne;
        User.findOneAndDelete = origFindOneAndDelete;
        User.prototype.save = origSave;
    }

    console.log(`\n=== PR 1.2 TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
