/**
 * PR 4.1 Automated Verification Test Suite
 * Workflow Tasks & Outbox Notification Engine (LW2-040, MOD-09)
 * 
 * Verifications:
 * 1. T-TASK01: Retry creating workflow 3 times does NOT triple tasks (Strict Idempotency).
 * 2. Stage Progression: Advancing contract stage triggers stage tasks to IN_PROGRESS & queues Outbox Notification.
 * 3. Contract Cancellation: Cancelling contract transitions pending/in_progress tasks to CANCELLED.
 * 4. Task Progress & Checklist: Marking checklist items completes task and sets completedAt.
 * 5. Outbox Idempotency: Duplicate transition calls do NOT create duplicate outbox notifications.
 * 6. Outbox Processing: processOutbox marks PENDING notifications as SENT reliably.
 * 7. Query Filters: listTasks accurately filters by assignee, stage, and overdue status.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const WorkTask = require("../src/models/workTask.model");
const NotificationOutbox = require("../src/models/notificationOutbox.model");
const HopDong = require("../src/models/hopDong.model");
const workflowEngine = require("../src/services/workflowEngine");

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
    console.log("=== STARTING PR 4.1 AUTOMATED VERIFICATION ===");
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

    const mockTasks = new Map();
    const mockNotifications = new Map();
    const mockContracts = new Map();

    // Mock WorkTask
    WorkTask.find = (query = {}) => {
        let list = Array.from(mockTasks.values());

        if (query.contractId) {
            list = list.filter(t => String(t.contractId) === String(query.contractId));
        }
        if (query.stage) {
            list = list.filter(t => t.stage === Number(query.stage));
        }
        if (query.status) {
            if (typeof query.status === 'string') {
                list = list.filter(t => t.status === query.status);
            } else if (query.status.$in) {
                list = list.filter(t => query.status.$in.includes(t.status));
            }
        }
        if (query.assigneeName) {
            const re = new RegExp(query.assigneeName);
            list = list.filter(t => re.test(t.assigneeName));
        }
        if (query.dueAt && query.dueAt.$lt) {
            list = list.filter(t => t.dueAt && new Date(t.dueAt) < query.dueAt.$lt);
        }

        return {
            _list: [...list],
            sort() { return this; },
            skip(n) { this._list = this._list.slice(n); return this; },
            limit(n) { this._list = this._list.slice(0, n); return this; },
            then(resolve, reject) { return Promise.resolve(this._list).then(resolve, reject); }
        };
    };

    WorkTask.findOne = async (query = {}) => {
        if (query.idempotencyKey) {
            for (const t of mockTasks.values()) {
                if (t.idempotencyKey === query.idempotencyKey) return t;
            }
        }
        return null;
    };

    WorkTask.findById = async (id) => mockTasks.get(String(id)) || null;

    WorkTask.countDocuments = async (query = {}) => {
        const queryChain = WorkTask.find(query);
        const res = await queryChain;
        return res.length;
    };

    WorkTask.prototype.save = async function() {
        if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
        mockTasks.set(String(this._id), this);
        return this;
    };

    // Mock NotificationOutbox
    NotificationOutbox.find = (query = {}) => {
        let list = Array.from(mockNotifications.values());
        if (query.status) {
            list = list.filter(n => n.status === query.status);
        }
        return {
            _list: [...list],
            sort() { return this; },
            limit(n) { this._list = this._list.slice(0, n); return this; },
            then(resolve, reject) { return Promise.resolve(this._list).then(resolve, reject); }
        };
    };

    NotificationOutbox.findOne = async (query = {}) => {
        if (query.idempotencyKey) {
            for (const n of mockNotifications.values()) {
                if (n.idempotencyKey === query.idempotencyKey) return n;
            }
        }
        return null;
    };

    NotificationOutbox.prototype.save = async function() {
        if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
        mockNotifications.set(String(this._id), this);
        return this;
    };

    // Mock HopDong
    HopDong.findById = async (id) => mockContracts.get(String(id)) || null;

    function createMockContract(data) {
        const id = data._id || new mongoose.Types.ObjectId().toString();
        const doc = {
            _id: id,
            maHopDong: data.maHopDong || "HD-2026-TASK",
            dichVuChinh: data.dichVuChinh || 1,
            giaiDoan: data.giaiDoan || 1,
            subGiaiDoan: data.subGiaiDoan || "dang_thuc_hien",
            cacNgay: data.cacNgay || {
                ngayChup: new Date("2026-11-20"),
                ngayCuoi: new Date("2026-12-25"),
                ngayTraAnh: new Date("2026-12-15")
            },
            nguoiPhucVu: data.nguoiPhucVu || {
                thoChupHinh: "Thợ Nam",
                thoMakeUp: "Thợ Hoa",
                thoChinhAnh: "Thợ Hùng",
                banHang: "Sale Trang",
                phucVu: "Lễ tân Linh"
            }
        };
        mockContracts.set(String(id), doc);
        return doc;
    }

    try {
        // Test 1: T-TASK01 Idempotency
        await test("1. T-TASK01: Retry creating workflow 3 times does NOT triple tasks (Strict Idempotency)", async () => {
            mockTasks.clear();
            mockNotifications.clear();

            const contract = createMockContract({ maHopDong: "HD-IDEMP-01" });

            // 1st instantiation
            const r1 = await workflowEngine.instantiateWorkflow({ contract });
            assert.strictEqual(r1.createdCount, 9, "Initial run should create 9 tasks");
            assert.strictEqual(r1.skippedCount, 0);
            assert.strictEqual(mockTasks.size, 9);

            // 2nd instantiation (Retry)
            const r2 = await workflowEngine.instantiateWorkflow({ contract });
            assert.strictEqual(r2.createdCount, 0, "2nd retry must create 0 new tasks");
            assert.strictEqual(r2.skippedCount, 9);
            assert.strictEqual(mockTasks.size, 9, "Total task count must remain exactly 9");

            // 3rd instantiation (Retry again)
            const r3 = await workflowEngine.instantiateWorkflow({ contract });
            assert.strictEqual(r3.createdCount, 0, "3rd retry must create 0 new tasks");
            assert.strictEqual(r3.skippedCount, 9);
            assert.strictEqual(mockTasks.size, 9, "Collection size must remain exactly 9 without duplicating");
        });

        // Test 2: Stage Progression Triggers Stage Tasks & Notification
        await test("2. Stage Progression: Advancing contract stage triggers stage tasks to IN_PROGRESS & queues Outbox Notification", async () => {
            mockTasks.clear();
            mockNotifications.clear();

            const contract = createMockContract({ maHopDong: "HD-PROG-02", giaiDoan: 1 });
            await workflowEngine.instantiateWorkflow({ contract });

            // Tasks in stage 2 initially PENDING
            const stage2TasksBefore = Array.from(mockTasks.values()).filter(t => t.stage === 2);
            assert(stage2TasksBefore.every(t => t.status === 'PENDING'));

            // Advance contract to Stage 2
            await workflowEngine.onContractStageTransition({
                contract,
                previousStage: 1,
                nextStage: 2,
                nextSubStage: "cho_chinh",
                performedBy: "Kỹ thuật trưởng"
            });

            // Stage 2 tasks should now be IN_PROGRESS
            const stage2TasksAfter = Array.from(mockTasks.values()).filter(t => t.stage === 2);
            assert(stage2TasksAfter.every(t => t.status === 'IN_PROGRESS'), "Stage 2 tasks must transition to IN_PROGRESS");

            // Verify Outbox Notification queued
            const notifs = Array.from(mockNotifications.values());
            const stageNotif = notifs.find(n => n.eventType === 'STAGE_ADVANCED');
            assert(stageNotif, "Outbox must have STAGE_ADVANCED notification");
            assert.strictEqual(stageNotif.status, 'PENDING');
            assert(stageNotif.title.includes("Hậu kỳ"));
        });

        // Test 3: Contract Cancellation Cancels Incomplete Tasks
        await test("3. Contract Cancellation: Cancelling contract transitions pending/in_progress tasks to CANCELLED", async () => {
            mockTasks.clear();
            mockNotifications.clear();

            const contract = createMockContract({ maHopDong: "HD-CANCEL-03", giaiDoan: 1 });
            await workflowEngine.instantiateWorkflow({ contract });

            // Mark 1 task as COMPLETED beforehand
            const allTasks = Array.from(mockTasks.values());
            allTasks[0].status = 'COMPLETED';

            // Cancel contract
            await workflowEngine.onContractStageTransition({
                contract,
                previousStage: 1,
                nextStage: 4,
                nextSubStage: "huy",
                performedBy: "Quản lý Studio"
            });

            // Incomplete tasks must be CANCELLED
            const remainingTasks = Array.from(mockTasks.values());
            assert.strictEqual(remainingTasks[0].status, 'COMPLETED', "Already completed task should remain COMPLETED");
            for (let i = 1; i < remainingTasks.length; i++) {
                assert.strictEqual(remainingTasks[i].status, 'CANCELLED', `Task ${remainingTasks[i].stepKey} must be CANCELLED`);
                assert.strictEqual(remainingTasks[i].cancellationReason, "Hợp đồng đã hủy");
            }

            // Notification Outbox recorded cancellation
            const cancelNotif = Array.from(mockNotifications.values()).find(n => n.eventType === 'CONTRACT_CANCELLED');
            assert(cancelNotif, "Outbox must record CONTRACT_CANCELLED notification");
        });

        // Test 4: Task Progress & Checklist Auto-completion
        await test("4. Task Progress & Checklist: Completing checklist items auto-completes task and sets completedAt", async () => {
            mockTasks.clear();

            const contract = createMockContract({ maHopDong: "HD-CHECK-04" });
            const wf = await workflowEngine.instantiateWorkflow({ contract });
            const photoTask = wf.tasks.find(t => t.stepKey === 'CHUP_ANH');
            assert.strictEqual(photoTask.status, 'IN_PROGRESS');
            assert.strictEqual(photoTask.checklist.length, 3);

            // Complete items 0, 1, 2 sequentially
            const req1 = {
                params: { id: String(photoTask._id) },
                body: { completedItemIndex: 0 },
                user: { fullname: "Thợ Nam" }
            };
            const res1 = createMockRes();
            await workflowEngine.updateTask(req1, res1);
            assert.strictEqual(photoTask.status, 'IN_PROGRESS', "Task still in progress when partially done");

            // Complete remaining items
            const req2 = {
                params: { id: String(photoTask._id) },
                body: {
                    checklistUpdates: [
                        { text: "Item 1", isDone: true },
                        { text: "Item 2", isDone: true },
                        { text: "Item 3", isDone: true }
                    ]
                },
                user: { fullname: "Thợ Nam" }
            };
            const res2 = createMockRes();
            await workflowEngine.updateTask(req2, res2);

            assert.strictEqual(photoTask.status, 'COMPLETED', "Task must auto-complete when all checklist items done");
            assert(photoTask.completedAt instanceof Date, "completedAt timestamp must be recorded");
        });

        // Test 5: Outbox Idempotency
        await test("5. Outbox Idempotency: Duplicate transition calls do NOT create duplicate outbox notifications", async () => {
            mockNotifications.clear();

            const contract = createMockContract({ maHopDong: "HD-NOTIF-05" });

            // Call transition twice
            await workflowEngine.onContractStageTransition({ contract, previousStage: 1, nextStage: 2, nextSubStage: "cho_chinh" });
            await workflowEngine.onContractStageTransition({ contract, previousStage: 1, nextStage: 2, nextSubStage: "cho_chinh" });

            assert.strictEqual(mockNotifications.size, 1, "Must have exactly 1 notification in outbox due to idempotencyKey");
        });

        // Test 6: Outbox Processing
        await test("6. Outbox Processing: processOutbox marks PENDING notifications as SENT reliably", async () => {
            const notifs = Array.from(mockNotifications.values());
            assert.strictEqual(notifs[0].status, 'PENDING');

            const result = await workflowEngine.processOutbox();
            assert.strictEqual(result.processedCount, 1);
            assert.strictEqual(result.errorsCount, 0);
            assert.strictEqual(notifs[0].status, 'SENT');
            assert(notifs[0].sentAt instanceof Date);
        });

        // Test 7: Query Filters (Assignee, Overdue, Stage)
        await test("7. Query Filters: listTasks accurately filters by assignee, stage, and overdue status", async () => {
            mockTasks.clear();

            const contract = createMockContract({ maHopDong: "HD-FILTER-07" });
            await workflowEngine.instantiateWorkflow({ contract });

            // 1. Filter by assignee "Thợ Nam"
            const reqAssignee = { query: { assigneeName: "Thợ Nam" } };
            const resAssignee = createMockRes();
            await workflowEngine.listTasks(reqAssignee, resAssignee);
            assert.strictEqual(resAssignee.statusCode, 200);
            assert(resAssignee.data.data.tasks.length > 0);
            assert(resAssignee.data.data.tasks.every(t => t.assigneeName === "Thợ Nam"));

            // 2. Filter by stage 3
            const reqStage = { query: { stage: 3 } };
            const resStage = createMockRes();
            await workflowEngine.listTasks(reqStage, resStage);
            assert.strictEqual(resStage.statusCode, 200);
            assert(resStage.data.data.tasks.every(t => t.stage === 3));

            // 3. Filter overdue
            // Create an overdue task (due in the past)
            const overdueTask = new WorkTask({
                taskCode: "TSK-OVERDUE-01",
                contractId: contract._id,
                maHopDong: contract.maHopDong,
                stepKey: "TEST_OVERDUE",
                stage: 1,
                title: "Task quá hạn",
                dueAt: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
                status: "IN_PROGRESS"
            });
            mockTasks.set(String(overdueTask._id), overdueTask);

            const reqOverdue = { query: { overdue: "true" } };
            const resOverdue = createMockRes();
            await workflowEngine.listTasks(reqOverdue, resOverdue);
            assert.strictEqual(resOverdue.statusCode, 200);
            assert.strictEqual(resOverdue.data.data.tasks.length, 1);
            assert.strictEqual(resOverdue.data.data.tasks[0].taskCode, "TSK-OVERDUE-01");
        });

    } catch (err) {
        console.error("Test execution aborted:", err);
    }

    console.log(`\nPR 4.1 SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
