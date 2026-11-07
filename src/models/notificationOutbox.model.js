const mongoose = require("mongoose");

const notificationOutboxSchema = new mongoose.Schema({
    notificationCode: { type: String, required: true, unique: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong" },
    maHopDong: { type: String, default: "", index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkTask" },
    eventType: {
        type: String,
        required: true,
        enum: [
            'STAGE_ADVANCED',
            'TASK_ASSIGNED',
            'TASK_OVERDUE',
            'TASK_COMPLETED',
            'PAYMENT_RECEIVED',
            'CONTRACT_CANCELLED',
            'CUSTOMER_APPROVED',
            'GENERAL_ALERT'
        ],
        default: 'GENERAL_ALERT'
    },
    recipient: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: { type: String, default: "" },
        fullname: { type: String, default: "" },
        role: { type: String, default: "" },
        channel: {
            type: String,
            enum: ['IN_APP', 'EMAIL', 'ZALO', 'WEBHOOK'],
            default: 'IN_APP'
        }
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    status: {
        type: String,
        enum: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'],
        default: 'PENDING',
        index: true
    },
    idempotencyKey: { type: String, unique: true, sparse: true },
    sentAt: { type: Date },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String, default: "" }
}, {
    timestamps: true
});

notificationOutboxSchema.index({ status: 1, createdAt: 1 });
notificationOutboxSchema.index({ "recipient.username": 1, status: 1 });

module.exports = mongoose.model("NotificationOutbox", notificationOutboxSchema);

