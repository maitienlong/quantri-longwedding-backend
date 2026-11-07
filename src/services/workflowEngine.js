const WorkTask = require("../models/workTask.model");
const NotificationOutbox = require("../models/notificationOutbox.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

function addDays(date, days) {
    if (!date) return null;
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Returns standard workflow steps template tailored to contract services and dates
 */
function getWorkflowTemplate(contract) {
    if (!contract) return [];

    const ngayChup = contract.cacNgay?.ngayChup ? new Date(contract.cacNgay.ngayChup) : null;
    const ngayCuoi = contract.cacNgay?.ngayCuoi ? new Date(contract.cacNgay.ngayCuoi) : null;
    const ngayAnHoi = contract.cacNgay?.ngayAnHoi ? new Date(contract.cacNgay.ngayAnHoi) : null;
    const ngayTraAnh = contract.cacNgay?.ngayTraAnh ? new Date(contract.cacNgay.ngayTraAnh) : null;
    const ngayChuyenInAnh = contract.cacNgay?.ngayChuyenInAnh ? new Date(contract.cacNgay.ngayChuyenInAnh) : null;

    const thoChup = contract.nguoiPhucVu?.thoChupHinh || "";
    const thoMake = contract.nguoiPhucVu?.thoMakeUp || "";
    const thoChinh = contract.nguoiPhucVu?.thoChinhAnh || "";
    const banHang = contract.nguoiPhucVu?.banHang || "";
    const phucVu = contract.nguoiPhucVu?.phucVu || "";

    const steps = [
        // GIAI ĐOẠN 1: CHỤP HÌNH
        {
            stepKey: "CHUP_ANH",
            stage: 1,
            title: `Chụp ảnh hợp đồng ${contract.maHopDong}`,
            description: "Thực hiện buổi chụp ảnh theo đúng concept và lịch hẹn với khách hàng.",
            assigneeRole: "Thợ chụp",
            assigneeName: thoChup,
            dueAt: ngayChup,
            priority: "HIGH",
            checklist: [
                { text: "Kiểm tra máy ảnh, ống kính và pin dự phòng", isDone: false },
                { text: "Xác nhận địa điểm chụp và trang phục của cô dâu chú rể", isDone: false },
                { text: "Hoàn tất ca chụp đúng giờ quy định", isDone: false }
            ]
        },
        {
            stepKey: "BAN_GIAO_FILE_GOC",
            stage: 1,
            title: `Bàn giao file ảnh gốc ${contract.maHopDong}`,
            description: "Copy file ảnh gốc RAW/JPEG lên hệ thống lưu trữ Google Drive của Studio.",
            assigneeRole: "Thợ chụp",
            assigneeName: thoChup,
            dueAt: ngayChup ? addDays(ngayChup, 1) : null,
            priority: "MEDIUM",
            checklist: [
                { text: "Sao lưu toàn bộ thẻ nhớ lên Google Drive Studio", isDone: false },
                { text: "Gửi link ảnh gốc vào hệ thống quản lý hợp đồng", isDone: false }
            ]
        },

        // GIAI ĐOẠN 2: HẬU KỲ
        {
            stepKey: "KHACH_CHON_ANH",
            stage: 2,
            title: `Hướng dẫn khách hàng chọn ảnh ${contract.maHopDong}`,
            description: "Gửi link portal cho khách duyệt và chọn ảnh sửa theo số lượng gói quy định.",
            assigneeRole: "Lễ tân / CSKH",
            assigneeName: banHang,
            dueAt: ngayChup ? addDays(ngayChup, 5) : null,
            priority: "MEDIUM",
            checklist: [
                { text: "Gửi link portal và mã truy cập cho khách hàng", isDone: false },
                { text: "Xác nhận danh sách mã ảnh khách chọn chỉnh sửa", isDone: false }
            ]
        },
        {
            stepKey: "CHINH_SUA_HAU_KY",
            stage: 2,
            title: `Chỉnh sửa ảnh hậu kỳ & thiết kế layout ${contract.maHopDong}`,
            description: "Retouch màu sắc, da, dáng và lên bố cục album cưới hoàn chỉnh.",
            assigneeRole: "Thợ chỉnh ảnh",
            assigneeName: thoChinh,
            dueAt: ngayTraAnh ? addDays(ngayTraAnh, -7) : (ngayChup ? addDays(ngayChup, 12) : null),
            priority: "HIGH",
            checklist: [
                { text: "Chỉnh màu và retouch toàn bộ ảnh đã chọn", isDone: false },
                { text: "Thiết kế layout album theo khổ ảnh của hợp đồng", isDone: false },
                { text: "Đăng tải bản layout lên hệ thống để chuẩn bị duyệt", isDone: false }
            ]
        },
        {
            stepKey: "KHACH_DUYET_LAYOUT",
            stage: 2,
            title: `Khách hàng duyệt bản in & chốt in ${contract.maHopDong}`,
            description: "Khách hàng xác nhận ưng ý layout trên Client Portal hoặc tại cửa hàng.",
            assigneeRole: "Thợ chỉnh ảnh",
            assigneeName: thoChinh,
            dueAt: ngayTraAnh ? addDays(ngayTraAnh, -4) : null,
            priority: "HIGH",
            checklist: [
                { text: "Gửi link duyệt layout cho khách", isDone: false },
                { text: "Tiếp nhận và sửa các điểm note (retouch pins) nếu có", isDone: false },
                { text: "Khách bấm xác nhận chốt in trên Portal", isDone: false }
            ]
        },

        // GIAI ĐOẠN 3: IN ẢNH
        {
            stepKey: "XUAT_FILE_GUI_IN",
            stage: 3,
            title: `Xuất file in chuẩn màu & gửi xưởng in ${contract.maHopDong}`,
            description: "Kiểm tra hệ màu CMYK/sRGB và chuyển file cho xưởng in gia công.",
            assigneeRole: "Hậu kỳ / In ấn",
            assigneeName: thoChinh,
            dueAt: ngayChuyenInAnh || (ngayTraAnh ? addDays(ngayTraAnh, -3) : null),
            priority: "HIGH",
            checklist: [
                { text: "Kiểm tra độ phân giải (300 DPI) và hệ màu", isDone: false },
                { text: "Gửi file sang xưởng in và lấy mã hẹn nhận hàng", isDone: false }
            ]
        },
        {
            stepKey: "NHAN_HANG_KIEM_TRA_QC",
            stage: 3,
            title: `Nhận sản phẩm từ xưởng & Kiểm tra chất lượng (QC)`,
            description: "Kiểm tra bìa album, bề mặt ảnh ép pha lê/gỗ, khung ảnh không trầy xước.",
            assigneeRole: "Lễ tân / Kho",
            assigneeName: phucVu,
            dueAt: ngayTraAnh ? addDays(ngayTraAnh, -1) : null,
            priority: "HIGH",
            checklist: [
                { text: "Kiểm tra số lượng ảnh cổng và cuốn album", isDone: false },
                { text: "Kiểm tra màu in đúng bản mẫu, không lem/trầy xước", isDone: false },
                { text: "Đóng gói bọc góc bảo vệ sẵn sàng bàn giao", isDone: false }
            ]
        },

        // GIAI ĐOẠN 4: HOÀN THÀNH
        {
            stepKey: "BAN_GIAO_SAN_PHAM",
            stage: 4,
            title: `Bàn giao album & ảnh cho khách hàng ${contract.maHopDong}`,
            description: "Bàn giao toàn bộ sản phẩm hoàn thiện cho cô dâu chú rể.",
            assigneeRole: "Lễ tân",
            assigneeName: phucVu,
            dueAt: ngayTraAnh || (ngayCuoi ? addDays(ngayCuoi, -3) : null),
            priority: "HIGH",
            checklist: [
                { text: "Khách hàng kiểm tra sản phẩm tại cửa hàng", isDone: false },
                { text: "Khách ký nhận biên bản bàn giao sản phẩm", isDone: false }
            ]
        },
        {
            stepKey: "QUYET_TOAN_HOP_DONG",
            stage: 4,
            title: `Quyết toán công nợ hợp đồng ${contract.maHopDong}`,
            description: "Thu đủ số tiền còn lại và đóng hợp đồng.",
            assigneeRole: "Kế toán",
            assigneeName: "Kế toán",
            dueAt: ngayTraAnh || new Date(),
            priority: "HIGH",
            checklist: [
                { text: "Thu phần tiền còn lại (conLai = 0 đ)", isDone: false },
                { text: "Xuất phiếu thu / hóa đơn hoàn tất hợp đồng", isDone: false }
            ]
        }
    ];

    return steps;
}

/**
 * Idempotently generates workflow tasks for a contract.
 * Re-running this function 3+ times will NOT produce duplicate tasks.
 */
async function instantiateWorkflow({ contractId, contract, performedBy = "Hệ thống" }) {
    let targetContract = contract;
    if (!targetContract && contractId) {
        targetContract = await HopDong.findById(contractId);
    }
    if (!targetContract) {
        throw new Error("Không tìm thấy hợp đồng để sinh workflow tasks");
    }

    const templateSteps = getWorkflowTemplate(targetContract);
    let createdCount = 0;
    let skippedCount = 0;
    const tasks = [];

    const currentStage = Number(targetContract.giaiDoan) || 1;

    for (const step of templateSteps) {
        const idempotencyKey = `${targetContract._id}_${step.stepKey}`;

        // Check if task already instantiated (Idempotent Guard)
        let existing = await WorkTask.findOne({ idempotencyKey });

        if (existing) {
            skippedCount++;
            tasks.push(existing);
        } else {
            // Determine initial status based on contract stage
            let initialStatus = 'PENDING';
            let completedAt = undefined;

            if (step.stage < currentStage) {
                initialStatus = 'COMPLETED';
                completedAt = new Date();
            } else if (step.stage === currentStage) {
                initialStatus = 'IN_PROGRESS';
            }

            const taskCode = `TSK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
            const newTask = new WorkTask({
                taskCode,
                contractId: targetContract._id,
                maHopDong: targetContract.maHopDong,
                stepKey: step.stepKey,
                stage: step.stage,
                title: step.title,
                description: step.description,
                assigneeName: step.assigneeName,
                assigneeRole: step.assigneeRole,
                dueAt: step.dueAt,
                completedAt,
                status: initialStatus,
                priority: step.priority,
                checklist: step.checklist,
                idempotencyKey,
                auditLog: [
                    {
                        action: `Khởi tạo nhiệm vụ (${initialStatus})`,
                        performedBy,
                        timestamp: new Date(),
                        details: { stepKey: step.stepKey, stage: step.stage }
                    }
                ]
            });

            await newTask.save();
            createdCount++;
            tasks.push(newTask);
        }
    }

    return {
        createdCount,
        skippedCount,
        totalTasks: tasks.length,
        tasks
    };
}

/**
 * Handles workflow updates when contract transitions stage or is cancelled.
 */
async function onContractStageTransition({ contract, previousStage, nextStage, nextSubStage, performedBy = "Hệ thống" }) {
    if (!contract) return;

    // 1. If contract cancelled -> cancel all incomplete tasks
    if (nextSubStage === 'huy') {
        const incompleteTasks = await WorkTask.find({
            contractId: contract._id,
            status: { $in: ['PENDING', 'IN_PROGRESS'] }
        });

        for (const t of incompleteTasks) {
            t.status = 'CANCELLED';
            t.cancellationReason = "Hợp đồng đã hủy";
            t.auditLog.push({
                action: "Hủy nhiệm vụ theo hợp đồng",
                performedBy,
                timestamp: new Date(),
                details: { contractCancelled: true }
            });
            await t.save();
        }

        // Outbox notification
        const notifCode = `NOTIF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const cancelNotif = new NotificationOutbox({
            notificationCode: notifCode,
            contractId: contract._id,
            maHopDong: contract.maHopDong,
            eventType: 'CONTRACT_CANCELLED',
            title: `Hợp đồng ${contract.maHopDong} đã bị hủy`,
            content: `Các nhiệm vụ chưa hoàn thành của hợp đồng ${contract.maHopDong} đã được hủy tự động.`,
            idempotencyKey: `${contract._id}_cancel_notif`,
            status: 'PENDING'
        });
        await cancelNotif.save();
        return;
    }

    // 2. Stage progression -> activate stage tasks and queue Outbox Notification
    const stageTasks = await WorkTask.find({
        contractId: contract._id,
        stage: nextStage,
        status: 'PENDING'
    });

    for (const t of stageTasks) {
        t.status = 'IN_PROGRESS';
        t.auditLog.push({
            action: `Kích hoạt nhiệm vụ giai đoạn ${nextStage}`,
            performedBy,
            timestamp: new Date()
        });
        await t.save();
    }

    // Create Outbox Notification (Idempotent per contract + stage)
    const stageNotifKey = `${contract._id}_stage_${nextStage}`;
    const existingNotif = await NotificationOutbox.findOne({ idempotencyKey: stageNotifKey });

    if (!existingNotif) {
        const notifCode = `NOTIF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const stageNames = { 1: "Chụp hình", 2: "Hậu kỳ", 3: "In ảnh", 4: "Hoàn thành" };
        const stageName = stageNames[nextStage] || `Giai đoạn ${nextStage}`;

        const notif = new NotificationOutbox({
            notificationCode: notifCode,
            contractId: contract._id,
            maHopDong: contract.maHopDong,
            eventType: 'STAGE_ADVANCED',
            title: `Hợp đồng ${contract.maHopDong} chuyển sang ${stageName}`,
            content: `Hợp đồng ${contract.maHopDong} đã tiến sang ${stageName}. Các nhiệm vụ liên quan đã được kích hoạt.`,
            idempotencyKey: stageNotifKey,
            data: { nextStage, nextSubStage, performedBy },
            status: 'PENDING'
        });
        await notif.save();
    }
}

/**
 * Update task progress, checklist, status, or notes
 */
async function updateTask(req, res) {
    try {
        const taskId = req.params.id;
        const task = await WorkTask.findById(taskId);
        if (!task) return error(res, "Không tìm thấy nhiệm vụ", 404);

        const { status, notes, checklistUpdates, completedItemIndex, dueAt, priority } = req.body;
        const performedBy = req.user?.fullname || req.user?.username || "Nhân viên";

        if (status && status !== task.status) {
            task.status = status;
            if (status === 'COMPLETED') {
                task.completedAt = new Date();
                // Mark all checklist items as done
                (task.checklist || []).forEach(item => {
                    item.isDone = true;
                    item.doneAt = item.doneAt || new Date();
                    item.doneBy = item.doneBy || performedBy;
                });
            }
        }

        if (completedItemIndex !== undefined && Array.isArray(task.checklist) && task.checklist[completedItemIndex]) {
            task.checklist[completedItemIndex].isDone = true;
            task.checklist[completedItemIndex].doneAt = new Date();
            task.checklist[completedItemIndex].doneBy = performedBy;

            // Auto-complete task if all checklist items are done
            const allDone = task.checklist.every(item => item.isDone);
            if (allDone && task.status === 'IN_PROGRESS') {
                task.status = 'COMPLETED';
                task.completedAt = new Date();
            }
        }

        if (Array.isArray(checklistUpdates)) {
            task.checklist = checklistUpdates;
            const allDone = task.checklist.every(item => item.isDone);
            if (allDone && task.status === 'IN_PROGRESS') {
                task.status = 'COMPLETED';
                task.completedAt = new Date();
            }
        }

        if (notes !== undefined) task.notes = notes;
        if (dueAt !== undefined) task.dueAt = new Date(dueAt);
        if (priority !== undefined) task.priority = priority;

        task.auditLog.push({
            action: "Cập nhật tiến độ nhiệm vụ",
            performedBy,
            timestamp: new Date(),
            details: { status: task.status, notes }
        });

        await task.save();
        return success(res, "Cập nhật nhiệm vụ thành công", task);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * List tasks with filters (by assignee, contract, status, overdue)
 */
async function listTasks(req, res) {
    try {
        const { assigneeName, maHopDong, status, stage, overdue, limit = 100, page = 1 } = req.query;
        const query = {};

        if (assigneeName) query.assigneeName = new RegExp(assigneeName.trim(), "i");
        if (maHopDong) query.maHopDong = new RegExp(maHopDong.trim(), "i");
        if (status && status !== 'all') query.status = status;
        if (stage && stage !== 'all') query.stage = Number(stage);

        if (overdue === 'true' || overdue === true) {
            query.dueAt = { $lt: new Date() };
            query.status = { $in: ['PENDING', 'IN_PROGRESS'] };
        }

        const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        const [tasks, total] = await Promise.all([
            WorkTask.find(query)
                .sort({ dueAt: 1, priority: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            WorkTask.countDocuments(query)
        ]);

        return success(res, "Lấy danh sách nhiệm vụ thành công", {
            tasks,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * API handler to instantiate workflow for a contract
 * POST /api/v2/contracts/:id/workflow/instantiate
 */
async function instantiateWorkflowEndpoint(req, res) {
    try {
        const contractId = req.params.id;
        const performedBy = req.user?.fullname || "Người dùng";
        const result = await instantiateWorkflow({ contractId, performedBy });
        return success(res, "Khởi tạo workflow tasks thành công", result);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

/**
 * Process pending notifications from Outbox
 */
async function processOutbox({ limit = 50 } = {}) {
    const pendingNotifs = await NotificationOutbox.find({ status: 'PENDING' })
        .sort({ createdAt: 1 })
        .limit(limit);

    let processedCount = 0;
    let errorsCount = 0;

    for (const notif of pendingNotifs) {
        try {
            // Mark as sent
            notif.status = 'SENT';
            notif.sentAt = new Date();
            await notif.save();
            processedCount++;
        } catch (err) {
            notif.status = 'FAILED';
            notif.retryCount = (notif.retryCount || 0) + 1;
            notif.lastError = err.message;
            await notif.save();
            errorsCount++;
        }
    }

    return { processedCount, errorsCount, totalPendingScanned: pendingNotifs.length };
}

/**
 * GET /api/v2/notifications
 */
async function listNotifications(req, res) {
    try {
        const username = req.user?.username;
        const query = {};
        if (username) {
            query.$or = [
                { "recipient.username": username },
                { "recipient.username": "" },
                { "recipient.username": { $exists: false } }
            ];
        }

        const notifications = await NotificationOutbox.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        return success(res, "Lấy thông báo thành công", notifications);
    } catch (err) {
        return error(res, err.message, 500);
    }
}

module.exports = {
    getWorkflowTemplate,
    instantiateWorkflow,
    onContractStageTransition,
    updateTask,
    listTasks,
    instantiateWorkflowEndpoint,
    processOutbox,
    listNotifications
};

