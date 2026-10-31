const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        description: "Tên hành động, ví dụ: Lọc ảnh máy tính"
    },
    user: {
        type: String,
        required: true,
        description: "Tên hoặc ID của người thực hiện"
    },
    ipAddress: {
        type: String,
        description: "Địa chỉ IP của máy tính gửi yêu cầu"
    },
    deviceInfo: {
        type: String,
        description: "Thông tin thiết bị, trình duyệt, hệ điều hành (User-Agent)"
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        description: "Chi tiết bổ sung cho hành động"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

LogSchema.index({ createdAt: -1 });
LogSchema.index({ user: 1 });

module.exports = mongoose.model('Log', LogSchema);
