const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isDone: { type: Boolean, default: false },
    doneAt: { type: Date },
    doneBy: { type: String, default: "" }
}, { _id: true });

const workTaskSchema = new mongoose.Schema({
    taskCode: { type: String, required: true, unique: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong", required: true },
    maHopDong: { type: String, required: true, index: true },
    workflowInstanceId: { type: String, default: "" },
    stepKey: { type: String, required: true }, // e.g. CHUP_ANH, CHON_ANH, CHINH_SUA_HAU_KY, KHACH_DUYET_LAYOUT, XUAT_FILE_GUI_IN, BAN_GIAO
    stage: { type: Number, required: true, min: 1, max: 4 }, // Giai đoạn 1..4
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assigneeName: { type: String, default: "" },
    assigneeRole: { type: String, default: "" },
    dueAt: { type: Date },
    completedAt: { type: Date },
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'],
        default: 'PENDING'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    checklist: [checklistItemSchema],
    idempotencyKey: { type: String, unique: true, sparse: true },
    notes: { type: String, default: "" },
    cancellationReason: { type: String, default: "" },
    auditLog: [
        {
            action: { type: String },
            performedBy: { type: String },
            timestamp: { type: Date, default: Date.now },
            details: { type: mongoose.Schema.Types.Mixed }
        }
    ]
}, {
    timestamps: true
});

// Indexes for query performance & idempotency
workTaskSchema.index({ contractId: 1, stepKey: 1 });
workTaskSchema.index({ status: 1, dueAt: 1 });
workTaskSchema.index({ assigneeName: 1, status: 1 });
workTaskSchema.index({ stage: 1, status: 1 });

module.exports = mongoose.model("WorkTask", workTaskSchema);

