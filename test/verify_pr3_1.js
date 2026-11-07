/**
 * PR 3.1 Automated Verification Test Suite
 * Lead Conversion, Idempotency & Customer Mapping (LW2-030, MOD-02)
 * 
 * Verifications:
 * 1. Phone Normalization: Standardizes diverse phone formats (+84, spaces, dots, dashes) to clean VN format.
 * 2. Idempotent Conversion: Converting a lead creates contract; repeating conversion returns existing contract without duplicates.
 * 3. Multi-Service Type Support: Preserves dichVuChinh and falls back to lead wedding date.
 * 4. Duplicate Customer Prevention: Reuses existing customer with matching normalized phone number.
 * 5. Customer Merge: Preview mode non-destructive, apply mode reassigns contracts & leads, soft-marks duplicate.
 * 6. Webhook Security: Rejects unauthorized requests when LEAD_WEBHOOK_SECRET is active; accepts valid secret.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const Lead = require("../src/models/lead.model");
const KhachHang = require("../src/models/khachHang.model");
const HopDong = require("../src/models/hopDong.model");
const leadService = require("../src/services/lead.service");
const { normalizePhoneNumber, isValidVietnamPhone } = require("../src/utils/phoneUtils");

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
    console.log("=== STARTING PR 3.1 AUTOMATED VERIFICATION ===");
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

    const mockLeads = new Map();
    const mockCustomers = new Map();
    const mockContracts = new Map();

    const origLeadFind = Lead.find;
    const origLeadFindById = Lead.findById;
    const origLeadUpdateMany = Lead.updateMany;
    const origLeadSave = Lead.prototype.save;
    const origKhachHangFind = KhachHang.find;
    const origKhachHangFindById = KhachHang.findById;
    const origKhachHangFindOne = KhachHang.findOne;
    const origKhachHangUpdateOne = KhachHang.updateOne;
    const origKhachHangSave = KhachHang.prototype.save;
    const origHopDongFind = HopDong.find;
    const origHopDongFindById = HopDong.findById;
    const origHopDongFindOne = HopDong.findOne;
    const origHopDongUpdateOne = HopDong.updateOne;
    const origHopDongSave = HopDong.prototype.save;

    Lead.prototype.save = async function() {
        if (!this._id) this._id = `lead_${Date.now()}_${Math.random()}`;
        if (this.soDienThoai) this.normalizedPhone = normalizePhoneNumber(this.soDienThoai);
        mockLeads.set(String(this._id), this);
        return this;
    };

    KhachHang.prototype.save = async function() {
        if (!this._id) this._id = `kh_${Date.now()}_${Math.random()}`;
        if (this.soDienThoai) this.normalizedPhone = normalizePhoneNumber(this.soDienThoai);
        mockCustomers.set(String(this._id), this);
        return this;
    };

    HopDong.prototype.save = async function() {
        if (!this._id) this._id = `hd_${Date.now()}_${Math.random()}`;
        mockContracts.set(String(this._id), this);
        return this;
    };

    Lead.find = async (query = {}) => {
        let list = Array.from(mockLeads.values());
        if (query.$or) {
            list = list.filter(l => {
                return query.$or.some(cond => {
                    if (cond.khachHangId && String(l.khachHangId) === String(cond.khachHangId)) return true;
                    if (cond.soDienThoai && l.soDienThoai === cond.soDienThoai) return true;
                    if (cond.normalizedPhone && l.normalizedPhone === cond.normalizedPhone) return true;
                    return false;
                });
            });
        }
        return list;
    };

    Lead.findById = async (id) => mockLeads.get(String(id)) || null;

    Lead.updateMany = async (filter, update) => {
        if (filter._id && filter._id.$in) {
            for (const id of filter._id.$in) {
                const item = mockLeads.get(String(id));
                if (item && update.$set) {
                    Object.assign(item, update.$set);
                }
            }
        }
        return { modifiedCount: 1 };
    };

    KhachHang.findById = async (id) => mockCustomers.get(String(id)) || null;

    KhachHang.findOne = async (query = {}) => {
        if (query.$or) {
            for (const cond of query.$or) {
                for (const kh of mockCustomers.values()) {
                    if (cond.normalizedPhone && kh.normalizedPhone === cond.normalizedPhone) return kh;
                    if (cond.soDienThoai && kh.soDienThoai === cond.soDienThoai) return kh;
                }
            }
        }
        if (query.soDienThoai) {
            for (const kh of mockCustomers.values()) {
                if (kh.soDienThoai === query.soDienThoai || kh.normalizedPhone === query.soDienThoai) return kh;
            }
        }
        if (query.facebookId) {
            for (const kh of mockCustomers.values()) {
                if (kh.facebookId === query.facebookId) return kh;
            }
        }
        return null;
    };

    KhachHang.updateOne = async (query, update) => {
        const item = mockCustomers.get(String(query._id));
        if (item && update.$set) {
            Object.assign(item, update.$set);
        }
        return { modifiedCount: 1 };
    };

    HopDong.findById = async (id) => mockContracts.get(String(id)) || null;

    HopDong.findOne = async (query = {}) => {
        if (query.maHopDong) {
            for (const c of mockContracts.values()) {
                if (c.maHopDong === query.maHopDong) return c;
            }
        }
        return null;
    };

    HopDong.find = async (query = {}) => {
        let list = Array.from(mockContracts.values());
        if (query.$or) {
            list = list.filter(c => {
                return query.$or.some(cond => {
                    if (cond.khachHang1 && String(c.khachHang1) === String(cond.khachHang1)) return true;
                    if (cond.khachHang2 && String(c.khachHang2) === String(cond.khachHang2)) return true;
                    return false;
                });
            });
        }
        return list;
    };

    HopDong.updateOne = async (query, update) => {
        const item = mockContracts.get(String(query._id));
        if (item) {
            if (update.$set) Object.assign(item, update.$set);
            if (update.$push && update.$push.auditLog) {
                if (!item.auditLog) item.auditLog = [];
                item.auditLog.push(update.$push.auditLog);
            }
        }
        return { modifiedCount: 1 };
    };

    function createMockLead(data) {
        const id = data._id || `lead_${Date.now()}_${Math.random()}`;
        const doc = {
            _id: id,
            maLead: data.maLead || `LEAD-${Date.now().toString().slice(-6)}`,
            hoTen: data.hoTen || "Nguyễn Văn A",
            soDienThoai: data.soDienThoai || "0987654321",
            normalizedPhone: normalizePhoneNumber(data.soDienThoai || "0987654321"),
            facebookId: data.facebookId || "",
            dichVuChinh: data.dichVuChinh || 1,
            ngayCuoiDuKien: data.ngayCuoiDuKien || new Date("2026-12-25"),
            trangThai: data.trangThai || 'MOI',
            lichSuTuVan: data.lichSuTuVan || [],
            hopDongId: data.hopDongId || undefined,
            maHopDongChuyenDoi: data.maHopDongChuyenDoi || "",
            async save() {
                mockLeads.set(String(this._id), this);
                return this;
            }
        };
        mockLeads.set(String(id), doc);
        return doc;
    }

    function createMockCustomer(data) {
        const id = data._id || new mongoose.Types.ObjectId().toString();
        const doc = {
            _id: id,
            tenKhachHang: data.tenKhachHang || "Khách Hàng Test",
            soDienThoai: data.soDienThoai || "0987654321",
            normalizedPhone: normalizePhoneNumber(data.soDienThoai || "0987654321"),
            diaChi: data.diaChi || "Hà Nội",
            facebookId: data.facebookId || "",
            isMerged: false,
            async save() {
                mockCustomers.set(String(this._id), this);
                return this;
            }
        };
        mockCustomers.set(String(id), doc);
        return doc;
    }

    try {
        // Test 1: Phone Normalization
        await test("1. Phone Normalization: Standardize various VN phone formats", () => {
            assert.strictEqual(normalizePhoneNumber("090 123 4567"), "0901234567");
            assert.strictEqual(normalizePhoneNumber("+84901234567"), "0901234567");
            assert.strictEqual(normalizePhoneNumber("+84 90 123 4567"), "0901234567");
            assert.strictEqual(normalizePhoneNumber("84901234567"), "0901234567");
            assert.strictEqual(normalizePhoneNumber("090.123.4567"), "0901234567");
            assert.strictEqual(normalizePhoneNumber("090-123-4567"), "0901234567");
            assert.strictEqual(isValidVietnamPhone("0901234567"), true);
            assert.strictEqual(isValidVietnamPhone("+84901234567"), true);
            assert.strictEqual(isValidVietnamPhone("12345"), false);
        });

        // Test 2: Idempotent Lead Conversion
        await test("2. Idempotent Conversion: Converting lead creates contract; retry returns existing contract", async () => {
            mockLeads.clear();
            mockCustomers.clear();
            mockContracts.clear();

            const lead = createMockLead({
                _id: "lead_idemp_1",
                maLead: "LEAD-101",
                hoTen: "Trần Thị B",
                soDienThoai: "0912 345 678",
                dichVuChinh: 2
            });

            const req = {
                body: {
                    leadId: "lead_idemp_1",
                    maHopDong: "HD-2026-IDEMP",
                    dichVuChinh: 2
                },
                user: { username: "sale1", fullname: "Lê Văn Sale", positon: "Sale" }
            };

            // 1st Call
            const res1 = createMockRes();
            await leadService.convertToContract(req, res1);
            assert.strictEqual(res1.statusCode, 200);
            assert.strictEqual(res1.data.data.isAlreadyConverted, false);
            assert.strictEqual(lead.trangThai, 'DA_CHOT');
            assert.strictEqual(lead.maHopDongChuyenDoi, "HD-2026-IDEMP");
            const firstContractId = res1.data.data.hopDong._id;

            // Put newly created contract into mock storage
            mockContracts.set(String(firstContractId), res1.data.data.hopDong);

            // 2nd Call (Double Click or Retry)
            const res2 = createMockRes();
            await leadService.convertToContract(req, res2);
            assert.strictEqual(res2.statusCode, 200);
            assert.strictEqual(res2.data.data.isAlreadyConverted, true, "Should report already converted");
            assert.strictEqual(res2.data.data.hopDong.maHopDong, "HD-2026-IDEMP");
            assert.strictEqual(mockContracts.size, 1, "Must NOT create a second duplicate contract");
        });

        // Test 3: Multi-Service Selection & Wedding Date Fallback
        await test("3. Service & Date Mapping: Custom dichVuChinh and wedding date fallback", async () => {
            const weddingDate = new Date("2026-11-20T00:00:00.000Z");
            const lead = createMockLead({
                _id: "lead_svc_3",
                hoTen: "Phạm Minh C",
                soDienThoai: "0933445566",
                dichVuChinh: 1,
                ngayCuoiDuKien: weddingDate
            });

            // Convert with specific dichVuChinh = 3 (Phóng sự cưới) and without cacNgay.ngayCuoi
            const req = {
                body: {
                    leadId: "lead_svc_3",
                    dichVuChinh: 3,
                    cacNgay: { ngayChup: new Date("2026-10-10") }
                },
                user: { username: "sale1", fullname: "Lê Văn Sale" }
            };

            const res = createMockRes();
            await leadService.convertToContract(req, res);
            assert.strictEqual(res.statusCode, 200);

            const contract = res.data.data.hopDong;
            assert.strictEqual(contract.dichVuChinh, 3, "dichVuChinh must match requested type 3");
            assert.strictEqual(new Date(contract.cacNgay.ngayCuoi).toISOString(), weddingDate.toISOString(), "ngayCuoi must fall back to lead.ngayCuoiDuKien");
        });

        // Test 4: Duplicate Customer Prevention via Normalized Phone
        await test("4. Customer Deduplication: Reuses existing customer matching normalized phone", async () => {
            mockCustomers.clear();

            // Pre-existing customer with clean phone and valid ObjectId hex
            const preExistingId = new mongoose.Types.ObjectId().toString();
            const existingCustomer = createMockCustomer({
                _id: preExistingId,
                tenKhachHang: "Hoàng Văn D",
                soDienThoai: "0977889900"
            });

            // Lead arrives with raw formatted phone: "+84 977 889 900"
            const lead = createMockLead({
                _id: "lead_dedup_4",
                hoTen: "Hoàng Văn D",
                soDienThoai: "+84 977 889 900"
            });

            const req = {
                body: { leadId: "lead_dedup_4" },
                user: { username: "sale1" }
            };

            const res = createMockRes();
            await leadService.convertToContract(req, res);
            assert.strictEqual(res.statusCode, 200);

            // The contract must point to existing customer, NOT create a duplicate
            const contract = res.data.data.hopDong;
            assert.strictEqual(String(contract.khachHang1), String(existingCustomer._id));
            assert.strictEqual(mockCustomers.size, 1, "Must not create a new customer record");
        });

        // Test 5: Customer Merge
        await test("5. Customer Merge: Preview is read-only; Apply reassigns contracts & leads and soft-merges duplicate", async () => {
            mockCustomers.clear();
            mockContracts.clear();
            mockLeads.clear();

            const masterCust = createMockCustomer({
                _id: "cust_master",
                tenKhachHang: "Lê Văn E",
                soDienThoai: "0901112222",
                diaChi: "Hà Nội"
            });

            const dupCust = createMockCustomer({
                _id: "cust_dup",
                tenKhachHang: "Lê Văn E (Clone)",
                soDienThoai: "0901112222",
                diaChi: "123 Phố Huế, Hà Nội",
                facebookId: "fb_123456"
            });

            // Contract belonging to duplicate customer
            const dupContract = {
                _id: "hd_dup_1",
                maHopDong: "HD-DUP-01",
                khachHang1: "cust_dup",
                auditLog: []
            };
            mockContracts.set("hd_dup_1", dupContract);

            // Lead linked to duplicate customer
            const dupLead = createMockLead({
                _id: "lead_dup_1",
                khachHangId: "cust_dup",
                soDienThoai: "0901112222"
            });

            // 1. Preview Mode
            const reqPreview = {
                body: { masterCustomerId: "cust_master", duplicateCustomerId: "cust_dup", previewOnly: true },
                user: { fullname: "Admin User", role: "Admin" }
            };
            const resPreview = createMockRes();
            await leadService.mergeCustomers(reqPreview, resPreview);
            assert.strictEqual(resPreview.statusCode, 200);
            assert.strictEqual(resPreview.data.data.contractsCount, 1);
            assert.strictEqual(resPreview.data.data.leadsCount, 1);
            // Verify no mutations happened in preview
            assert.strictEqual(dupContract.khachHang1, "cust_dup");
            assert.strictEqual(dupCust.isMerged, false);

            // 2. Apply Mode
            const reqApply = {
                body: { masterCustomerId: "cust_master", duplicateCustomerId: "cust_dup", previewOnly: false },
                user: { fullname: "Admin User", role: "Admin" }
            };
            const resApply = createMockRes();
            await leadService.mergeCustomers(reqApply, resApply);
            assert.strictEqual(resApply.statusCode, 200);

            // Verify contract reassigned to master
            assert.strictEqual(String(dupContract.khachHang1), "cust_master");
            assert(dupContract.auditLog.some(l => l.action === "Gộp khách hàng"));

            // Verify lead reassigned to master
            assert.strictEqual(String(dupLead.khachHangId), "cust_master");

            // Verify duplicate customer soft-marked as merged (NOT deleted)
            assert.strictEqual(dupCust.isMerged, true);
            assert.strictEqual(String(dupCust.mergedInto), "cust_master");

            // Verify missing contact info copied to master
            assert.strictEqual(masterCust.facebookId, "fb_123456");
        });

        // Test 6: Webhook Security
        await test("6. Webhook Security: Requires valid LEAD_WEBHOOK_SECRET when configured", async () => {
            const oldSecret = process.env.LEAD_WEBHOOK_SECRET;
            process.env.LEAD_WEBHOOK_SECRET = "test_lead_secret_key_123";

            try {
                // Without Secret Header -> 401
                const reqNoAuth = {
                    headers: {},
                    body: { hoTen: "Khách Spam", soDienThoai: "0999999999" }
                };
                const resNoAuth = createMockRes();
                await leadService.webhookCreate(reqNoAuth, resNoAuth);
                assert.strictEqual(resNoAuth.statusCode, 401);

                // With Wrong Secret -> 401
                const reqBadAuth = {
                    headers: { "x-webhook-secret": "wrong_key" },
                    body: { hoTen: "Khách Spam", soDienThoai: "0999999999" }
                };
                const resBadAuth = createMockRes();
                await leadService.webhookCreate(reqBadAuth, resBadAuth);
                assert.strictEqual(resBadAuth.statusCode, 401);

                // With Valid Secret -> 200
                const reqGoodAuth = {
                    headers: { "x-webhook-secret": "test_lead_secret_key_123" },
                    body: { hoTen: "Khách Hợp Lệ n8n", soDienThoai: "0911223344" }
                };
                const resGoodAuth = createMockRes();
                await leadService.webhookCreate(reqGoodAuth, resGoodAuth);
                assert.strictEqual(resGoodAuth.statusCode, 200);
                assert.strictEqual(resGoodAuth.data.data.hoTen, "Khách Hợp Lệ n8n");

            } finally {
                if (oldSecret !== undefined) process.env.LEAD_WEBHOOK_SECRET = oldSecret;
                else delete process.env.LEAD_WEBHOOK_SECRET;
            }
        });

    } finally {
        Lead.find = origLeadFind;
        Lead.findById = origLeadFindById;
        Lead.updateMany = origLeadUpdateMany;
        Lead.prototype.save = origLeadSave;
        KhachHang.find = origKhachHangFind;
        KhachHang.findById = origKhachHangFindById;
        KhachHang.findOne = origKhachHangFindOne;
        KhachHang.updateOne = origKhachHangUpdateOne;
        KhachHang.prototype.save = origKhachHangSave;
        HopDong.find = origHopDongFind;
        HopDong.findById = origHopDongFindById;
        HopDong.findOne = origHopDongFindOne;
        HopDong.updateOne = origHopDongUpdateOne;
        HopDong.prototype.save = origHopDongSave;
    }

    console.log(`\nPR 3.1 SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
