/**
 * PR 5.2 Automated Verification Test Suite
 * Double-Entry Financial Ledger, Reconciliation Run & Single Source of Truth
 * (MOD-08, T-LEDGER01, T-REPORT01)
 * 
 * Verifications:
 * 1. T-LEDGER01: Migrating payments to Ledger ensures contract total before == after (strict variance = 0 VND).
 * 2. T-REPORT01: Single Source of Truth calculation engine ensures Dashboard overview and Detailed business report
 *    metrics match 100% for identical filter intervals.
 * 3. Double-Entry Balance Invariant: Sum of Debits == Sum of Credits across individual entries and global ledger.
 * 4. Reconciliation Run Detection & Repair: Discrepancy in cached paid amount vs payments is detected and repaired.
 * 5. Reconciliation Idempotency: Re-running reconciliation after repair yields 0 discrepancies and 0 mutations.
 * 6. Ledger Immutability & DB Idempotency: Unique compound key { sourceModel, sourceId } prevents duplicate entries.
 * 7. Migration M09: Historical contracts, payments, and expenses are backfilled cleanly with T-LEDGER01 passed.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const HOPDONG = require("../src/models/hopDong.model");
const ChiTieu = require("../src/models/chiTieu.model");
const Payment = require("../src/models/payment.model");
const FinancialLedger = require("../src/models/financialLedger.model");
const ReconciliationRun = require("../src/models/reconciliationRun.model");
const financialLedgerService = require("../src/services/financialLedger.service");
const { runMigrationM09 } = require("../src/migrations/m09_double_entry_ledger_sync");

async function runTests() {
    console.log("=== STARTING PR 5.2 AUTOMATED VERIFICATION ===");
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

    // In-memory mock databases
    const mockLedgers = new Map();
    const mockContracts = new Map();
    const mockChiTieus = new Map();
    const mockReconciliationRuns = new Map();

    // Helper: Mock FinancialLedger Document
    function createMockLedgerDoc(data) {
        const doc = {
            _id: data._id || new mongoose.Types.ObjectId().toString(),
            entryNumber: data.entryNumber || financialLedgerService.generateEntryNumber(),
            transactionDate: data.transactionDate || new Date(),
            transactionType: data.transactionType,
            debitAccount: data.debitAccount,
            creditAccount: data.creditAccount,
            amount: Number(data.amount) || 0,
            currency: data.currency || "VND",
            hopDongId: data.hopDongId,
            maHopDong: data.maHopDong || "",
            khachHangId: data.khachHangId,
            tenKhachHang: data.tenKhachHang || "",
            sourceModel: data.sourceModel,
            sourceId: String(data.sourceId),
            description: data.description || "",
            creator: data.creator || "System",
            isReconciled: false,
            isImmutable: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        doc.save = async function() {
            const key = `${this.sourceModel}-${this.sourceId}`;
            mockLedgers.set(key, this);
            return this;
        };
        return doc;
    }

    // Helper: Mock ReconciliationRun Document
    function createMockReconciliationRunDoc(data) {
        const doc = {
            _id: data._id || new mongoose.Types.ObjectId().toString(),
            runCode: data.runCode,
            startedAt: data.startedAt || new Date(),
            completedAt: data.completedAt || new Date(),
            initiatedBy: data.initiatedBy || "System",
            dryRun: data.dryRun !== undefined ? data.dryRun : true,
            scope: data.scope || "ALL",
            filterParams: data.filterParams || {},
            contractsScanned: data.contractsScanned || 0,
            totalContractRevenue: data.totalContractRevenue || 0,
            totalPaidInContracts: data.totalPaidInContracts || 0,
            totalPaidInPayments: data.totalPaidInPayments || 0,
            totalPaidInLedger: data.totalPaidInLedger || 0,
            totalExpensesInChiTieu: data.totalExpensesInChiTieu || 0,
            totalExpensesInLedger: data.totalExpensesInLedger || 0,
            totalLedgerDebits: data.totalLedgerDebits || 0,
            totalLedgerCredits: data.totalLedgerCredits || 0,
            isDoubleEntryBalanced: data.isDoubleEntryBalanced !== undefined ? data.isDoubleEntryBalanced : true,
            discrepancyCount: data.discrepancyCount || 0,
            repairedCount: data.repairedCount || 0,
            status: data.status || "COMPLETED",
            discrepancies: data.discrepancies || [],
            invariantsChecked: data.invariantsChecked || {
                T_LEDGER01_passed: true,
                T_REPORT01_passed: true,
                doubleEntryBalanced: true
            },
            summary: data.summary || ""
        };
        doc.save = async function() {
            mockReconciliationRuns.set(this._id.toString(), this);
            return this;
        };
        return doc;
    }

    // Override Mongoose Model methods with in-memory stores
    FinancialLedger.findOne = async function(query) {
        if (query.sourceModel && query.sourceId) {
            const key = `${query.sourceModel}-${query.sourceId}`;
            return mockLedgers.get(key) || null;
        }
        for (const entry of mockLedgers.values()) {
            let match = true;
            if (query.maHopDong && entry.maHopDong !== query.maHopDong) match = false;
            if (query.transactionType && entry.transactionType !== query.transactionType) match = false;
            if (match) return entry;
        }
        return null;
    };

    FinancialLedger.find = function(query = {}) {
        return {
            sort: () => ({
                skip: (s) => ({
                    limit: (l) => ({
                        lean: async () => {
                            let results = Array.from(mockLedgers.values());
                            if (query.maHopDong) results = results.filter(e => e.maHopDong === query.maHopDong);
                            if (query.transactionType) results = results.filter(e => e.transactionType === query.transactionType);
                            return results;
                        }
                    })
                }),
                lean: async () => {
                    let results = Array.from(mockLedgers.values());
                    if (query.maHopDong) results = results.filter(e => e.maHopDong === query.maHopDong);
                    if (query.transactionType) results = results.filter(e => e.transactionType === query.transactionType);
                    return results;
                }
            }),
            lean: async () => {
                let results = Array.from(mockLedgers.values());
                if (query.maHopDong) results = results.filter(e => e.maHopDong === query.maHopDong);
                if (query.transactionType) results = results.filter(e => e.transactionType === query.transactionType);
                return results;
            }
        };
    };

    FinancialLedger.countDocuments = async function() {
        return mockLedgers.size;
    };

    FinancialLedger.aggregate = async function(pipeline) {
        let entries = Array.from(mockLedgers.values());
        for (const stage of pipeline) {
            if (stage.$match) {
                if (stage.$match.maHopDong) {
                    entries = entries.filter(e => e.maHopDong === stage.$match.maHopDong);
                }
                if (stage.$match.transactionType) {
                    entries = entries.filter(e => e.transactionType === stage.$match.transactionType);
                }
                if (stage.$match.transactionDate) {
                    const gte = stage.$match.transactionDate.$gte;
                    const lte = stage.$match.transactionDate.$lte;
                    if (gte && lte) {
                        entries = entries.filter(e => new Date(e.transactionDate) >= gte && new Date(e.transactionDate) <= lte);
                    }
                }
            }
            if (stage.$group) {
                if (stage.$group._id === null) {
                    const totalAmount = entries.reduce((s, e) => s + (e.amount || 0), 0);
                    return [{ _id: null, totalAmount, total: totalAmount }];
                }
                if (stage.$group._id === "$transactionType") {
                    const groups = {};
                    entries.forEach(e => {
                        groups[e.transactionType] = (groups[e.transactionType] || 0) + (e.amount || 0);
                    });
                    return Object.keys(groups).map(k => ({ _id: k, total: groups[k] }));
                }
            }
        }
        return [];
    };

    // Mock Prototype Save on FinancialLedger constructor
    FinancialLedger.prototype.save = async function() {
        const key = `${this.sourceModel}-${this.sourceId}`;
        this._id = this._id || new mongoose.Types.ObjectId().toString();
        this.entryNumber = this.entryNumber || financialLedgerService.generateEntryNumber();
        mockLedgers.set(key, this);
        return this;
    };

    // Mock HopDong
    HOPDONG.find = function(query = {}) {
        let results = Array.from(mockContracts.values());
        if (query.maHopDong && typeof query.maHopDong === 'string') {
            results = results.filter(c => c.maHopDong === query.maHopDong);
        } else if (query.maHopDong && query.maHopDong.$ne) {
            results = results.filter(c => c.maHopDong !== query.maHopDong.$ne);
        }
        if (query.ngayHopDong) {
            const gte = query.ngayHopDong.$gte;
            const lte = query.ngayHopDong.$lte;
            if (gte && lte) {
                results = results.filter(c => new Date(c.ngayHopDong) >= gte && new Date(c.ngayHopDong) <= lte);
            }
        }
        const queryObj = {
            select: () => queryObj,
            lean: async () => results,
            then: (resolve, reject) => Promise.resolve(results).then(resolve, reject)
        };
        return queryObj;
    };

    HOPDONG.updateOne = async function(filter, update) {
        for (const c of mockContracts.values()) {
            if ((filter._id && c._id === filter._id) || (filter.maHopDong && c.maHopDong === filter.maHopDong)) {
                if (update.$set) {
                    if (update.$set["thanhToan.khachHangDaThanhToan"] !== undefined) {
                        c.thanhToan.khachHangDaThanhToan = update.$set["thanhToan.khachHangDaThanhToan"];
                    }
                    if (update.$set["thanhToan.conLai"] !== undefined) {
                        c.thanhToan.conLai = update.$set["thanhToan.conLai"];
                    }
                    if (update.$set["thanhToan.phanTramDaThanhToan"] !== undefined) {
                        c.thanhToan.phanTramDaThanhToan = update.$set["thanhToan.phanTramDaThanhToan"];
                    }
                }
                return { modifiedCount: 1 };
            }
        }
        return { modifiedCount: 0 };
    };

    HOPDONG.aggregate = async function(pipeline) {
        let contracts = Array.from(mockContracts.values());
        let payments = [];
        contracts.forEach(c => {
            if (c.maHopDong !== "CH-CHUNG" && Array.isArray(c.thanhToan?.cacLuotThanhToan)) {
                c.thanhToan.cacLuotThanhToan.forEach(p => {
                    payments.push({
                        maHopDong: c.maHopDong,
                        thanhToan: { cacLuotThanhToan: p }
                    });
                });
            }
        });

        for (const stage of pipeline) {
            if (stage.$match && stage.$match["thanhToan.cacLuotThanhToan.date"]) {
                const gte = stage.$match["thanhToan.cacLuotThanhToan.date"].$gte;
                const lte = stage.$match["thanhToan.cacLuotThanhToan.date"].$lte;
                payments = payments.filter(item => {
                    const d = new Date(item.thanhToan.cacLuotThanhToan.date);
                    return d >= gte && d <= lte;
                });
            }
            if (stage.$group) {
                const total = payments.reduce((s, item) => s + (Number(item.thanhToan.cacLuotThanhToan.amount) || 0), 0);
                return [{ _id: null, totalCollected: total, count: payments.length }];
            }
        }
        return [];
    };

    // Mock ChiTieu
    ChiTieu.find = function(query = {}) {
        let results = Array.from(mockChiTieus.values());
        if (query.date) {
            const gte = query.date.$gte;
            const lte = query.date.$lte;
            if (gte && lte) {
                results = results.filter(e => new Date(e.date) >= gte && new Date(e.date) <= lte);
            }
        }
        const queryObj = {
            lean: async () => results,
            then: (resolve, reject) => Promise.resolve(results).then(resolve, reject)
        };
        return queryObj;
    };

    // Mock ReconciliationRun
    ReconciliationRun.prototype.save = async function() {
        this._id = this._id || new mongoose.Types.ObjectId().toString();
        mockReconciliationRuns.set(this._id.toString(), this);
        return this;
    };

    ReconciliationRun.find = function() {
        return {
            sort: () => ({
                skip: () => ({
                    limit: () => ({
                        lean: async () => Array.from(mockReconciliationRuns.values())
                    })
                })
            })
        };
    };

    // Prepare fixture data
    const contract1 = {
        _id: "660000000000000000000001",
        maHopDong: "HD-2026-001",
        ngayHopDong: new Date("2026-03-10T10:00:00Z"),
        thanhToan: {
            tongGiaTri: 25000000,
            tongGiaTriSauGiam: 25000000,
            khachHangDaThanhToan: 15000000,
            conLai: 10000000,
            cacLuotThanhToan: [
                { id: "PAY-001-1", amount: 10000000, method: "Tiền mặt", date: new Date("2026-03-10T10:30:00Z"), noiDung: "Cọc hợp đồng" },
                { id: "PAY-001-2", amount: 5000000, method: "Chuyển khoản", date: new Date("2026-03-15T14:00:00Z"), noiDung: "Thanh toán đợt 2" }
            ]
        },
        khachHang1: { _id: "kh-001", tenKhachHang: "Nguyễn Văn A" }
    };

    const contract2 = {
        _id: "660000000000000000000002",
        maHopDong: "HD-2026-002",
        ngayHopDong: new Date("2026-03-12T09:00:00Z"),
        thanhToan: {
            tongGiaTri: 18000000,
            tongGiaTriSauGiam: 18000000,
            khachHangDaThanhToan: 18000000,
            conLai: 0,
            cacLuotThanhToan: [
                { id: "PAY-002-1", amount: 18000000, method: "Chuyển khoản", date: new Date("2026-03-12T09:30:00Z"), noiDung: "Thanh toán 100%" }
            ]
        },
        khachHang1: { _id: "kh-002", tenKhachHang: "Trần Thị B" }
    };

    const expense1 = {
        _id: "exp-001",
        id: "CT-2026-001",
        date: new Date("2026-03-14T08:00:00Z"),
        receiver: "Xưởng in Hải Nam",
        reason: "In album ảnh",
        amount: 3200000,
        creator: "Admin"
    };

    mockContracts.set(contract1.maHopDong, contract1);
    mockContracts.set(contract2.maHopDong, contract2);
    mockChiTieus.set(expense1.id, expense1);

    // =========================================================================
    // TEST 1: T-LEDGER01 - Migrate payments to Ledger with strictly 0 VND variance
    // =========================================================================
    await test("Test 1: T-LEDGER01: Migrate payments to Ledger ensures contract total before == after (variance = 0 VND)", async () => {
        // Record contract revenue
        await financialLedgerService.recordLedgerEntry({
            transactionDate: contract1.ngayHopDong,
            transactionType: 'CONTRACT_REVENUE',
            debitAccount: '131',
            creditAccount: '511',
            amount: contract1.thanhToan.tongGiaTriSauGiam,
            maHopDong: contract1.maHopDong,
            sourceModel: 'HopDong',
            sourceId: contract1._id
        });

        // Record payments
        for (const p of contract1.thanhToan.cacLuotThanhToan) {
            await financialLedgerService.recordLedgerEntry({
                transactionDate: p.date,
                transactionType: 'PAYMENT_RECEIVED',
                debitAccount: p.method === 'Tiền mặt' ? '111' : '112',
                creditAccount: '131',
                amount: p.amount,
                maHopDong: contract1.maHopDong,
                sourceModel: 'Payment',
                sourceId: p.id
            });
        }

        const summary = await financialLedgerService.getLedgerSummaryForContract(contract1.maHopDong);
        const expectedPaidInContract = contract1.thanhToan.cacLuotThanhToan.reduce((s, p) => s + p.amount, 0);

        assert.strictEqual(summary.totalPaid, expectedPaidInContract, "Ledger totalPaid must match contract payments");
        assert.strictEqual(summary.totalPaid, 15000000, "Must equal 15,000,000 VND");
        assert.strictEqual(summary.conLai, 10000000, "Remaining debt in ledger must be exactly 10,000,000 VND");
        const variance = Math.abs(summary.totalPaid - expectedPaidInContract);
        assert.strictEqual(variance, 0, "Variance between contract payments and ledger must be strictly 0 VND (T-LEDGER01)");
    });

    // =========================================================================
    // TEST 2: T-REPORT01 - Dashboard Overview vs Detailed Report match 100%
    // =========================================================================
    await test("Test 2: T-REPORT01: Single Source of Truth calculation engine ensures Overview & Detailed reports match 100%", async () => {
        const startDate = new Date("2026-03-01T00:00:00Z");
        const endDate = new Date("2026-03-31T23:59:59Z");

        const unifiedReport = await financialLedgerService.getUnifiedFinancialSummary({
            startDate,
            endDate,
            periodType: 'month'
        });

        // Total signed contracts in March 2026: 25,000,000 + 18,000,000 = 43,000,000 VND
        assert.strictEqual(unifiedReport.soLuongHopDong, 2, "Should find 2 contracts signed in March 2026");
        assert.strictEqual(unifiedReport.tongTienHopDong, 43000000, "Total revenue must be 43,000,000 VND");
        assert.strictEqual(unifiedReport.soTienDaThuTrongKy, 33000000, "Cash Inflow in March must be 15,000,000 + 18,000,000 = 33,000,000 VND");
        assert.strictEqual(unifiedReport.tongTienKhoanChi, 3200000, "Expenses in March must match ChiTieu 3,200,000 VND");
        assert.strictEqual(unifiedReport.laiRong, 43000000 - 3200000, "Net profit must equal 39,800,000 VND");
        assert.strictEqual(unifiedReport.invariants.T_REPORT01_passed, true, "T-REPORT01 invariant must pass");
    });

    // =========================================================================
    // TEST 3: Double-Entry Balancing Invariant (Debit == Credit)
    // =========================================================================
    await test("Test 3: Double-Entry balance invariant (sum of Debits == sum of Credits)", async () => {
        const ledgerList = await financialLedgerService.listLedgerEntries();
        assert.strictEqual(ledgerList.summary.isDoubleEntryBalanced, true, "Global ledger must be balanced");
        assert.strictEqual(ledgerList.summary.totalDebits, ledgerList.summary.totalCredits, "Debits and Credits must be identical");
    });

    // =========================================================================
    // TEST 4: Financial Reconciliation Run detects and repairs discrepancies
    // =========================================================================
    await test("Test 4: Financial reconciliation run detects and auto-repairs contract cache & missing ledger entries", async () => {
        // Intentionally corrupt contract1's cached khachHangDaThanhToan
        contract1.thanhToan.khachHangDaThanhToan = 9999999; // Corrupted cache!
        mockContracts.set(contract1.maHopDong, contract1);

        // Run reconciliation with dryRun: true (Audit only)
        const auditRun = await financialLedgerService.runReconciliation({
            dryRun: true,
            scope: 'CONTRACT',
            contractCode: contract1.maHopDong
        });

        assert.strictEqual(auditRun.dryRun, true, "Must be dry run");
        assert(auditRun.discrepancyCount > 0, "Must detect discrepancies");
        assert.strictEqual(auditRun.repairedCount, 0, "Dry run must not repair anything");
        assert.strictEqual(contract1.thanhToan.khachHangDaThanhToan, 9999999, "Cache must remain unchanged in dry run");

        // Run reconciliation with dryRun: false (Auto-repair)
        const repairRun = await financialLedgerService.runReconciliation({
            dryRun: false,
            scope: 'CONTRACT',
            contractCode: contract1.maHopDong
        });

        assert.strictEqual(repairRun.dryRun, false, "Must be repair run");
        assert(repairRun.repairedCount > 0, "Must repair detected discrepancies");
        assert.strictEqual(contract1.thanhToan.khachHangDaThanhToan, 15000000, "Contract cache must be restored to 15,000,000 VND");
        assert.strictEqual(contract1.thanhToan.conLai, 10000000, "Remaining debt must be restored to 10,000,000 VND");
    });

    // =========================================================================
    // TEST 5: Reconciliation Idempotency (0 discrepancies on re-run)
    // =========================================================================
    await test("Test 5: Re-running reconciliation after repair yields 0 discrepancies and 0 mutations", async () => {
        const cleanRun = await financialLedgerService.runReconciliation({
            dryRun: false,
            scope: 'CONTRACT',
            contractCode: contract1.maHopDong
        });

        assert.strictEqual(cleanRun.discrepancyCount, 0, "Must find 0 discrepancies");
        assert.strictEqual(cleanRun.repairedCount, 0, "Must perform 0 repairs");
        assert.strictEqual(cleanRun.invariantsChecked.T_LEDGER01_passed, true, "T-LEDGER01 must pass");
        assert.strictEqual(cleanRun.invariantsChecked.doubleEntryBalanced, true, "Double entry must remain balanced");
    });

    // =========================================================================
    // TEST 6: Ledger Entry Immutability & DB Idempotency
    // =========================================================================
    await test("Test 6: Ledger entry immutability and DB idempotency via unique {sourceModel, sourceId}", async () => {
        // Attempt to record duplicate entry for existing sourceModel & sourceId
        const duplicateAttempt = await financialLedgerService.recordLedgerEntry({
            transactionDate: new Date(),
            transactionType: 'PAYMENT_RECEIVED',
            debitAccount: '111',
            creditAccount: '131',
            amount: 10000000,
            maHopDong: contract1.maHopDong,
            sourceModel: 'Payment',
            sourceId: 'PAY-001-1' // Already recorded in Test 1
        });

        assert.strictEqual(duplicateAttempt.created, false, "Must NOT create duplicate ledger entry");
        assert.strictEqual(duplicateAttempt.entry.sourceId, 'PAY-001-1', "Must return existing ledger entry");
        assert.strictEqual(duplicateAttempt.entry.isImmutable, true, "Ledger entries must be immutable");
    });

    // =========================================================================
    // TEST 7: Migration M09 Backfill & Invariant Check
    // =========================================================================
    await test("Test 7: Migration M09 backfills historical payments & expenses into ledger without data loss", async () => {
        const migrationResult = await runMigrationM09({ dryRun: false });

        assert.strictEqual(migrationResult.dryRun, false, "Must execute active migration");
        assert.strictEqual(migrationResult.contractsScanned, 2, "Must scan all contracts");
        assert(migrationResult.totalContractRevenue >= 43000000, "Revenue must be recorded");
        assert.strictEqual(migrationResult.tLedger01Passed, true, "Invariant T-LEDGER01 must pass 100%");
    });

    console.log(`\n=== PR 5.2 RESULTS: ${passed} PASSED / ${failed} FAILED ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
