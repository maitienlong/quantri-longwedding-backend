const ChiTieu = require("../models/chiTieu.model");
const donViNhanTienService = require("./donViNhanTien.service");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

function getICTStartOfDay() {
    const now = new Date();
    const tzOffset = 7 * 60; // ICT is UTC+7
    const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
    const ictDate = new Date(localTime);
    
    const ictStart = new Date(Date.UTC(
        ictDate.getFullYear(),
        ictDate.getMonth(),
        ictDate.getDate(),
        0, 0, 0, 0
    ));
    
    ictStart.setHours(ictStart.getHours() - 7);
    return ictStart;
}

function getICTDateRange(period) {
    if (!period) return null;
    const startOfToday = getICTStartOfDay();
    
    let start, end;
    switch (period) {
        case 'today':
        case 'hôm nay': {
            start = startOfToday;
            end = new Date(startOfToday);
            end.setDate(end.getDate() + 1);
            break;
        }
        case 'week':
        case 'this_week':
        case 'tuần':
        case 'tuần này': {
            const now = new Date();
            const tzOffset = 7 * 60;
            const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
            const ictDate = new Date(localTime);
            const day = ictDate.getDay();
            const diffToMonday = ictDate.getDate() - (day === 0 ? 6 : day - 1);
            
            const startOfWeek = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth(),
                diffToMonday,
                0, 0, 0, 0
            ));
            startOfWeek.setHours(startOfWeek.getHours() - 7);
            
            start = startOfWeek;
            end = new Date(startOfWeek);
            end.setDate(end.getDate() + 7);
            break;
        }
        case 'month':
        case 'this_month':
        case 'tháng':
        case 'tháng này': {
            const now = new Date();
            const tzOffset = 7 * 60;
            const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
            const ictDate = new Date(localTime);
            
            const startOfMonth = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth(),
                1,
                0, 0, 0, 0
            ));
            startOfMonth.setHours(startOfMonth.getHours() - 7);
            
            const endOfMonth = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth() + 1,
                1,
                0, 0, 0, 0
            ));
            endOfMonth.setHours(endOfMonth.getHours() - 7);
            
            start = startOfMonth;
            end = endOfMonth;
            break;
        }
        default:
            return null;
    }
    return { start, end };
}

async function create(req, res) {
    try {
        const { date, receiver, reason, amount, creator, note, maHopDong } = req.body;
        
        if (!receiver) return error(res, "Người nhận (receiver) là bắt buộc");
        if (!reason) return error(res, "Lý do chi (reason) là bắt buộc");
        if (amount === undefined || amount === null) return error(res, "Số tiền chi (amount) là bắt buộc");

        const generatedId = req.body.id || `CT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const finalCreator = creator || req.user?.fullname || req.user?.username || "Hệ thống";

        const chiTieu = new ChiTieu({
            id: generatedId,
            date: date ? new Date(date) : new Date(),
            receiver,
            reason,
            amount: Number(amount) || 0,
            creator: finalCreator,
            note,
            maHopDong
        });

        await chiTieu.save();
        console.log(`Đã tạo chi tiêu: ${generatedId} với số tiền ${amount}`);

        createLog({
            action: `Tạo khoản chi tiêu (${generatedId})`,
            user: req.user?.fullname || finalCreator || "Nhân viên",
            req,
            details: { id: generatedId, amount: Number(amount) || 0, receiver, reason, maHopDong }
        });

        // Tự động kiểm tra và lưu đơn vị nhận tiền nếu chưa tồn tại
        if (receiver) {
            donViNhanTienService.ensureReceiverExists(receiver).catch(e => console.error("ensureReceiverExists error:", e.message));
        }

        return success(res, "Tạo lượt chi tiêu thành công", chiTieu);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { id, date, receiver, reason, amount, creator, note, maHopDong } = req.body;
        
        if (!id) return error(res, "Thiếu ID chi tiêu để cập nhật");

        const updateFields = {};
        if (date !== undefined) updateFields.date = new Date(date);
        if (receiver !== undefined) updateFields.receiver = receiver;
        if (reason !== undefined) updateFields.reason = reason;
        if (amount !== undefined) updateFields.amount = Number(amount) || 0;
        if (creator !== undefined) updateFields.creator = creator;
        if (note !== undefined) updateFields.note = note;
        if (maHopDong !== undefined) updateFields.maHopDong = maHopDong;

        const chiTieu = await ChiTieu.findOneAndUpdate(
            { id: id },
            { $set: updateFields },
            { new: true }
        );

        if (!chiTieu) {
            return error(res, "Không tìm thấy lượt chi tiêu để cập nhật");
        }

        console.log(`Đã cập nhật chi tiêu: ${id}`);

        createLog({
            action: `Cập nhật khoản chi tiêu (${id})`,
            user: req.user?.fullname || "Nhân viên",
            req,
            details: { id, amount: updateFields.amount, receiver: updateFields.receiver, reason: updateFields.reason }
        });

        // Tự động kiểm tra và lưu đơn vị nhận tiền nếu chưa tồn tại
        if (receiver) {
            donViNhanTienService.ensureReceiverExists(receiver).catch(e => console.error("ensureReceiverExists error:", e.message));
        }

        return success(res, "Cập nhật lượt chi tiêu thành công", chiTieu);
    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const id = req.body.id || req.query.id || req.params.id;
        if (!id) return error(res, "Thiếu ID chi tiêu để xóa");

        const chiTieu = await ChiTieu.findOneAndDelete({ id: id });
        if (!chiTieu) {
            return error(res, "Không tìm thấy lượt chi tiêu để xóa");
        }

        console.log(`Đã xóa chi tiêu: ${id}`);

        createLog({
            action: `Xóa khoản chi tiêu (${id})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { id, amount: chiTieu.amount, receiver: chiTieu.receiver, reason: chiTieu.reason }
        });

        return success(res, "Xóa lượt chi tiêu thành công", { id });
    } catch (err) {
        return error(res, err.message);
    }
}

async function find(req, res) {
    try {
        const { keyword, filter, startDate, endDate, maHopDong } = req.body;
        const query = {};

        // Lọc theo mã hợp đồng
        if (maHopDong !== undefined && maHopDong !== "") {
            query.maHopDong = maHopDong;
        }

        // Lọc theo ngày tháng
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                query.date.$gte = new Date(startDate);
            }
            if (endDate) {
                query.date.$lte = new Date(endDate);
            }
        } else if (filter && filter !== 'all') {
            const range = getICTDateRange(filter);
            if (range) {
                query.date = { $gte: range.start, $lt: range.end };
            }
        }

        // Lọc theo từ khóa tìm kiếm
        if (keyword) {
            query.$or = [
                { id: { $regex: keyword, $options: 'i' } },
                { receiver: { $regex: keyword, $options: 'i' } },
                { reason: { $regex: keyword, $options: 'i' } },
                { creator: { $regex: keyword, $options: 'i' } },
                { note: { $regex: keyword, $options: 'i' } },
                { maHopDong: { $regex: keyword, $options: 'i' } }
            ];
        }

        const chiTieuList = await ChiTieu.find(query).sort({ date: -1 });

        return success(res, "Tải danh sách chi tiêu thành công", {
            count: chiTieuList.length,
            chiTieu: chiTieuList
        });
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    create,
    update,
    remove,
    find
};
