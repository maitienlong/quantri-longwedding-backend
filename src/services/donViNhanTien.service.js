const DonViNhanTien = require("../models/donViNhanTien.model");
const ChiTieu = require("../models/chiTieu.model");
const { success, error } = require("../utils/response");

// Helper tự động thêm đơn vị nếu chưa có trong DB
async function ensureReceiverExists(receiverName) {
    if (!receiverName || typeof receiverName !== 'string') return null;
    const trimmed = receiverName.trim();
    if (!trimmed) return null;

    try {
        let existing = await DonViNhanTien.findOne({
            name: { $regex: new RegExp(`^${trimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });

        if (!existing) {
            existing = new DonViNhanTien({
                name: trimmed
            });
            await existing.save();
            console.log(`[DonViNhanTien] Đã tự động thêm đơn vị nhận tiền mới: ${trimmed}`);
        }
        return existing;
    } catch (err) {
        console.error(`[DonViNhanTien] Lỗi khi kiểm tra/thêm đơn vị ${trimmed}:`, err.message);
        return null;
    }
}

async function find(req, res) {
    try {
        const { keyword } = req.body || {};

        // 1. Tự động gom các receiver đã từng chi tiêu nhưng chưa lưu trong DonViNhanTien
        const existingInChiTieu = await ChiTieu.distinct("receiver");
        for (const rec of existingInChiTieu) {
            if (rec && typeof rec === 'string' && rec.trim()) {
                await ensureReceiverExists(rec.trim());
            }
        }

        // 2. Lấy danh sách thống kê chi tiêu theo từng receiver
        const stats = await ChiTieu.aggregate([
            {
                $group: {
                    _id: "$receiver",
                    soLanChi: { $sum: 1 },
                    tongTienChi: { $sum: "$amount" }
                }
            }
        ]);

        const statsMap = {};
        stats.forEach(s => {
            if (s._id) {
                statsMap[s._id.trim().toLowerCase()] = {
                    soLanChi: s.soLanChi,
                    tongTienChi: s.tongTienChi
                };
            }
        });

        // 3. Truy vấn danh sách đơn vị nhận tiền
        let query = {};
        if (keyword && keyword.trim()) {
            query = {
                $or: [
                    { name: { $regex: keyword.trim(), $options: 'i' } },
                    { phone: { $regex: keyword.trim(), $options: 'i' } },
                    { address: { $regex: keyword.trim(), $options: 'i' } },
                    { note: { $regex: keyword.trim(), $options: 'i' } }
                ]
            };
        }

        const list = await DonViNhanTien.find(query).sort({ name: 1 }).lean();

        // Gắn thêm số liệu thống kê vào từng đơn vị
        const enrichedList = list.map(item => {
            const key = (item.name || '').trim().toLowerCase();
            const stat = statsMap[key] || { soLanChi: 0, tongTienChi: 0 };
            return {
                ...item,
                id: item._id.toString(),
                soLanChi: stat.soLanChi,
                tongTienChi: stat.tongTienChi
            };
        });

        return success(res, "Tải danh sách đơn vị nhận tiền thành công", {
            count: enrichedList.length,
            donViNhanTien: enrichedList
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function create(req, res) {
    try {
        const { name, phone, address, note } = req.body;
        if (!name || !name.trim()) {
            return error(res, "Tên đơn vị nhận tiền không được để trống");
        }

        const trimmedName = name.trim();
        const existing = await DonViNhanTien.findOne({
            name: { $regex: new RegExp(`^${trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });

        if (existing) {
            return error(res, `Đơn vị nhận tiền "${trimmedName}" đã tồn tại trong hệ thống!`);
        }

        const newDonVi = new DonViNhanTien({
            name: trimmedName,
            phone: (phone || "").trim(),
            address: (address || "").trim(),
            note: (note || "").trim()
        });

        await newDonVi.save();
        console.log(`Đã thêm đơn vị nhận tiền: ${trimmedName}`);

        return success(res, "Thêm đơn vị nhận tiền thành công", newDonVi);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { id, _id, name, phone, address, note } = req.body;
        const targetId = id || _id;

        if (!targetId) {
            return error(res, "Thiếu ID đơn vị nhận tiền để cập nhật");
        }

        const updateData = {};
        if (name !== undefined) {
            if (!name.trim()) return error(res, "Tên đơn vị nhận tiền không được để trống");
            const trimmedName = name.trim();
            // Kiểm tra trùng tên với đơn vị khác
            const duplicate = await DonViNhanTien.findOne({
                _id: { $ne: targetId },
                name: { $regex: new RegExp(`^${trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
            });
            if (duplicate) {
                return error(res, `Tên đơn vị nhận tiền "${trimmedName}" đã được sử dụng!`);
            }
            updateData.name = trimmedName;
        }

        if (phone !== undefined) updateData.phone = phone.trim();
        if (address !== undefined) updateData.address = address.trim();
        if (note !== undefined) updateData.note = note.trim();

        const updated = await DonViNhanTien.findByIdAndUpdate(
            targetId,
            { $set: updateData },
            { new: true }
        );

        if (!updated) {
            return error(res, "Không tìm thấy đơn vị nhận tiền để cập nhật");
        }

        return success(res, "Cập nhật đơn vị nhận tiền thành công", updated);
    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const targetId = req.body.id || req.body._id || req.query.id || req.params.id;
        if (!targetId) {
            return error(res, "Thiếu ID đơn vị nhận tiền để xóa");
        }

        const deleted = await DonViNhanTien.findByIdAndDelete(targetId);
        if (!deleted) {
            return error(res, "Không tìm thấy đơn vị nhận tiền để xóa");
        }

        console.log(`Đã xóa đơn vị nhận tiền: ${deleted.name}`);
        return success(res, "Xóa đơn vị nhận tiền thành công", { id: targetId });
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    find,
    create,
    update,
    remove,
    ensureReceiverExists
};
