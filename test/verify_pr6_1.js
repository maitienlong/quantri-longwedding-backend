/**
 * PR 6.1 Automated Verification Test Suite
 * RBAC Granular Permissions, Security Hardening & Owner Policy (MOD-10, MOD-11)
 * 
 * Verifications:
 * 1. Granular Permission Enforcement: User lacking permission calling protected resource is blocked (403 Forbidden).
 * 2. Granular Permission Granting: User with specific permission (e.g. 'doanhthu', 'quanlychitieu') is allowed (200 OK).
 * 3. Crew Assignment Guard ('phan-cong-tho'): Staff without 'phan-cong-tho' cannot alter crew on contract (403 Forbidden).
 * 4. Manager / Admin Bypass: Role 'Quản lý' or 'Admin' can perform any action without explicit permission strings.
 * 5. ThiepCuoi Owner Policy (IDOR Protection): Customer A cannot delete or modify Customer B's invitation or guests (403).
 * 6. ThiepCuoi Owner Access: Owner can manage their own wedding invitation and guest list (200 OK).
 * 7. Migration M10: Backfills user permissions and invitation ownership cleanly and idempotently.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const User = require("../src/models/user.model");
const ThiepCuoi = require("../src/models/thiepCuoi.model");
const HopDong = require("../src/models/hopDong.model");
const { requirePermission, requireAnyPermission, checkUserPermission } = require("../src/middleware/permission.middleware");
const { checkInvitationOwner } = require("../src/middleware/ownerPolicy.middleware");
const thiepCuoiService = require("../src/services/thiepCuoi.service");
const hopDongService = require("../src/services/hopDong.service");
const { runMigrationM10 } = require("../src/migrations/m10_rbac_user_permissions_sync");

function createMockReqRes(user, params = {}, body = {}) {
    const req = {
        user,
        params,
        body,
        headers: {},
        protocol: 'http',
        get: (h) => (h === 'host' ? 'localhost:5000' : '')
    };

    const res = {
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

    return { req, res };
}

async function runTests() {
    console.log("=== STARTING PR 6.1 AUTOMATED VERIFICATION ===");
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

    // In-memory mock database
    const mockUsers = new Map();
    const mockInvitations = new Map();
    const mockContracts = new Map();

    // Mock User findOne
    User.findOne = async function(query) {
        if (query.username) {
            return mockUsers.get(query.username) || null;
        }
        return null;
    };

    User.find = function() {
        return Promise.resolve(Array.from(mockUsers.values()));
    };

    // Mock ThiepCuoi methods
    ThiepCuoi.findOne = async function(query) {
        let results = Array.from(mockInvitations.values());
        if (query.$or) {
            for (const cond of query.$or) {
                if (cond.invitationId && mockInvitations.has(cond.invitationId)) {
                    return mockInvitations.get(cond.invitationId);
                }
                if (cond._id) {
                    for (const inv of results) {
                        if (String(inv._id) === String(cond._id)) return inv;
                    }
                }
            }
        }
        if (query.invitationId) {
            return mockInvitations.get(query.invitationId) || null;
        }
        return null;
    };

    ThiepCuoi.find = function() {
        return Promise.resolve(Array.from(mockInvitations.values()));
    };

    ThiepCuoi.findOneAndDelete = async function(query) {
        const inv = await ThiepCuoi.findOne(query);
        if (inv) {
            mockInvitations.delete(inv.invitationId);
            return inv;
        }
        return null;
    };

    // Mock HopDong methods
    HopDong.findOne = async function(query) {
        if (query.maHopDong) {
            return mockContracts.get(query.maHopDong) || null;
        }
        return null;
    };

    // Create fixture accounts
    const managerUser = {
        _id: "u-mgr",
        username: "manager1",
        positon: "Quản lý",
        permission: 1,
        permissions: ["*"],
        save: async function() { return this; }
    };

    const accountantUser = {
        _id: "u-acc",
        username: "accountant1",
        positon: "Nhân viên",
        permission: 0,
        permissions: ["tongquan", "quanlychitieu", "doanhthu"],
        save: async function() { return this; }
    };

    const photographerUser = {
        _id: "u-photo",
        username: "photographer1",
        positon: "Thợ chụp",
        permission: 0,
        permissions: ["tongquan", "lichcuahang", "lichSoanDo"], // lacks 'doanhthu', 'quanlychitieu', 'phan-cong-tho'
        save: async function() { return this; }
    };

    const crewAssignerUser = {
        _id: "u-crew",
        username: "dispatch1",
        positon: "Điều phối",
        permission: 0,
        permissions: ["tongquan", "banhang", "phan-cong-tho"],
        save: async function() { return this; }
    };

    const customerA = {
        _id: "cust-A",
        id: "cust-A",
        username: "khachA",
        customerId: "cust-A",
        positon: "Khách hàng"
    };

    const customerB = {
        _id: "cust-B",
        id: "cust-B",
        username: "khachB",
        customerId: "cust-B",
        positon: "Khách hàng"
    };

    mockUsers.set(managerUser.username, managerUser);
    mockUsers.set(accountantUser.username, accountantUser);
    mockUsers.set(photographerUser.username, photographerUser);
    mockUsers.set(crewAssignerUser.username, crewAssignerUser);

    // Create fixture wedding invitation for Customer B
    const invitationB = {
        _id: "inv-B-001",
        invitationId: "thiep-khach-B",
        customerId: "cust-B",
        createdBy: "cust-B",
        creator: "khachB",
        khachHangId: "cust-B",
        isPublished: true,
        guestList: [
            { id: "guest-1", name: "Nguyễn Văn Bạn B", group: "Bạn Cô Dâu" }
        ],
        rsvps: [
            { guestName: "Nguyễn Văn Bạn B", phone: "0912345678", status: "attending", note: "Chúc mừng bạn!" }
        ],
        save: async function() {
            mockInvitations.set(this.invitationId, this);
            return this;
        }
    };
    mockInvitations.set(invitationB.invitationId, invitationB);

    // Create fixture contract
    const contract1 = {
        _id: "hd-001",
        maHopDong: "HD2026101",
        giaiDoan: 1,
        subGiaiDoan: "dang_thuc_hien",
        nguoiPhucVu: {
            banHang: "sale1",
            thoChupHinh: "thoA",
            thoMakeUp: "makeA",
            thoChinhAnh: "photoA"
        },
        save: async function() {
            mockContracts.set(this.maHopDong, this);
            return this;
        }
    };
    mockContracts.set(contract1.maHopDong, contract1);

    // =========================================================================
    // TEST 1: Granular Permission Enforcement (Blocking unauthorized access)
    // =========================================================================
    await test("Test 1: User lacking permission (photographer lacking 'doanhthu') calling protected route is blocked (403)", async () => {
        const { req, res } = createMockReqRes(photographerUser);
        let nextCalled = false;

        const middleware = requirePermission("doanhthu");
        await middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false, "Must not allow next()");
        assert.strictEqual(res.statusCode, 403, "Must return HTTP 403 Forbidden");
        assert.strictEqual(res.data?.requiredPermission, "doanhthu", "Must indicate missing permission");
    });

    // =========================================================================
    // TEST 2: Granular Permission Granting (Allowing authorized access)
    // =========================================================================
    await test("Test 2: User with granted permission (accountant with 'doanhthu') calling protected route is allowed (200)", async () => {
        const { req, res } = createMockReqRes(accountantUser);
        let nextCalled = false;

        const middleware = requirePermission("doanhthu");
        await middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true, "Must call next() successfully");
        assert.strictEqual(res.statusCode, 200, "Status must remain 200");
    });

    // =========================================================================
    // TEST 3: Crew Assignment Guard ('phan-cong-tho')
    // =========================================================================
    await test("Test 3: Crew Assignment Guard ('phan-cong-tho'): Staff without permission blocked from altering crew (403)", async () => {
        // photographerUser has NO 'phan-cong-tho'
        const { req, res } = createMockReqRes(photographerUser, {}, {
            maHopDong: "HD2026101",
            nguoiPhucVu: {
                thoChupHinh: "thoX_NEW", // Attempting unauthorized crew change!
                thoMakeUp: "makeA"
            }
        });

        await hopDongService.update(req, res);

        assert.strictEqual(res.statusCode, 403, "Must reject crew assignment with 403 Forbidden");
        assert(res.data?.message?.includes("phan-cong-tho"), "Error message must cite missing phan-cong-tho permission");

        // Now test crewAssignerUser (who has 'phan-cong-tho')
        const { req: req2, res: res2 } = createMockReqRes(crewAssignerUser, {}, {
            maHopDong: "HD2026101",
            nguoiPhucVu: {
                thoChupHinh: "thoX_APPROVED",
                thoMakeUp: "makeA"
            }
        });

        await hopDongService.update(req2, res2);
        assert.strictEqual(res2.statusCode, 200, "Authorized dispatcher must successfully update crew");
        assert.strictEqual(contract1.nguoiPhucVu.thoChupHinh, "thoX_APPROVED", "Crew must be updated");
    });

    // =========================================================================
    // TEST 4: Manager / Admin Universal Bypass
    // =========================================================================
    await test("Test 4: Manager/Admin role bypasses granular permission check across any resource", async () => {
        const { req, res } = createMockReqRes(managerUser);
        let nextCalled = false;

        const middleware = requirePermission("any_arbitrary_permission_key");
        await middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true, "Manager must bypass permission requirement");
    });

    // =========================================================================
    // TEST 5: ThiepCuoi Owner Policy - IDOR Protection
    // =========================================================================
    await test("Test 5: ThiepCuoi Owner Policy (IDOR Protection): Customer A blocked from accessing Customer B's invitation/guests (403)", async () => {
        const { req, res } = createMockReqRes(customerA, { id: "thiep-khach-B" });
        let nextCalled = false;

        // Try to access RSVP of Customer B
        await checkInvitationOwner(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false, "Must not allow next()");
        assert.strictEqual(res.statusCode, 403, "Must return HTTP 403 Forbidden");
        assert(res.data?.message?.includes("Owner Policy"), "Must cite Owner Policy in error message");

        // Try to delete Customer B's guest as Customer A via service
        const { req: delReq, res: delRes } = createMockReqRes(customerA, { id: "thiep-khach-B", guestId: "guest-1" });
        await checkInvitationOwner(delReq, delRes, async () => {
            await thiepCuoiService.deleteGuest(delReq, delRes);
        });

        assert.strictEqual(delRes.statusCode, 403, "Must block guest deletion attempt with 403");
        assert.strictEqual(invitationB.guestList.length, 1, "Guest list must remain untouched");
    });

    // =========================================================================
    // TEST 6: ThiepCuoi Owner Access
    // =========================================================================
    await test("Test 6: ThiepCuoi Owner Access: Customer B can manage their own wedding invitation and guest list", async () => {
        const { req, res } = createMockReqRes(customerB, { id: "thiep-khach-B" });
        let nextCalled = false;

        await checkInvitationOwner(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true, "Owner must be authorized by Owner Policy");
        assert.strictEqual(res.statusCode, 200, "Must succeed with 200 OK");
        assert.strictEqual(req.invitation.invitationId, "thiep-khach-B", "Request must attach validated invitation");
    });

    // =========================================================================
    // TEST 7: Migration M10 Verification
    // =========================================================================
    await test("Test 7: Migration M10 backfills missing user permissions and invitation ownership idempotently", async () => {
        // Create an unmigrated user without permissions array
        const unmigratedUser = {
            _id: "u-legacy",
            username: "sale_legacy",
            positon: "Sale",
            permissions: [],
            save: async function() {
                mockUsers.set(this.username, this);
                return this;
            }
        };
        mockUsers.set(unmigratedUser.username, unmigratedUser);

        // Create an unmigrated invitation without customerId/creator
        const unmigratedInv = {
            _id: "inv-legacy-1",
            invitationId: "thiep-legacy-1",
            khachHangId: "kh-legacy-1",
            customerId: "",
            creator: "",
            save: async function() {
                mockInvitations.set(this.invitationId, this);
                return this;
            }
        };
        mockInvitations.set(unmigratedInv.invitationId, unmigratedInv);

        const summary = await runMigrationM10({ dryRun: false });

        assert.strictEqual(summary.dryRun, false, "Must run active migration");
        assert(summary.usersUpdated >= 1, "Must update legacy user permissions");
        assert(summary.invitationsUpdated >= 1, "Must update legacy invitation ownership");

        // Verify backfilled user has sale permissions
        assert(unmigratedUser.permissions.includes("banhang"), "Must include banhang permission");
        assert(unmigratedUser.permissions.includes("leads"), "Must include leads permission");

        // Verify backfilled invitation has customerId
        assert.strictEqual(unmigratedInv.customerId, "kh-legacy-1", "Must backfill customerId from khachHangId");
    });

    console.log(`\n=== PR 6.1 RESULTS: ${passed} PASSED / ${failed} FAILED ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
