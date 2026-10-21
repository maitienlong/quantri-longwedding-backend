const LoaiDichVu = require("../models/loaiDichVu.model");
const DichVu = require("../models/dichVu.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

const defaultServiceTypes = [
    {
        id: 1,
        name: "Trang Phục",
        prefix: "CLOTHING_",
        icon: "👗",
        color: "#9333ea",
        badgeBg: "#f3e8ff",
        description: "Váy cưới, áo dài, vest chú rể, trang phục bê lễ"
    },
    {
        id: 2,
        name: "Gói Dịch Vụ",
        prefix: "SERVICE_",
        icon: "📦",
        color: "#2563eb",
        badgeBg: "#dbeafe",
        description: "Gói chụp studio, pre-wedding, phóng sự cưới trọn gói"
    },
    {
        id: 3,
        name: "Ảnh (Lab)",
        prefix: "LAB_",
        icon: "🖼️",
        color: "#059669",
        badgeBg: "#d1fae5",
        description: "Ảnh phóng cổng, ảnh để bàn, album photobook"
    },
    {
        id: 4,
        name: "Trang Điểm",
        prefix: "MAKEUP_",
        icon: "💄",
        color: "#db2777",
        badgeBg: "#fce7f3",
        description: "Trang điểm cô dâu ăn hỏi, tiệc cưới, makeup tiệc"
    },
    {
        id: 5,
        name: "Thiệp Cưới Online",
        prefix: "VIP_",
        icon: "💌",
        color: "#e11d48",
        badgeBg: "#ffe4e6",
        description: "Mẫu thiệp cưới trực tuyến tương tác cao cấp"
    }
];

function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
    return str;
}

function generatePrefixFromName(name) {
    if (!name) return 'DV_';
    const clean = removeVietnameseTones(name).trim();
    const words = clean.split(/[\s\-_+.,/]+/).filter(Boolean);
    const initials = words.map(w => w.charAt(0).toUpperCase()).join('');
    return (initials || 'DV') + '_';
}

async function find(req, res) {
    try {
        let list = await LoaiDichVu.find().sort({ id: 1 });
        if (list.length === 0) {
            console.log("LoaiDichVu collection is empty. Seeding defaults...");
            await LoaiDichVu.insertMany(defaultServiceTypes);
            list = await LoaiDichVu.find().sort({ id: 1 });
        }

        // Lấy số lượng dịch vụ theo từng loại
        const counts = await DichVu.aggregate([
            { $group: { _id: "$loaiDichVu", count: { $sum: 1 } } }
        ]);
        const countMap = {};
        counts.forEach(c => {
            if (c._id !== undefined && c._id !== null) {
                countMap[c._id] = c.count;
            }
        });

        const listWithCount = list.map(item => {
            const obj = item.toObject();
            obj.serviceCount = countMap[item.id] || 0;
            return obj;
        });

        return success(res, "Tải danh sách loại dịch vụ thành công", {
            count: listWithCount.length,
            loaiDichVu: listWithCount
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function create(req, res) {
    try {
        let { name, prefix, icon, color, badgeBg, description } = req.body;
        if (!name || !name.trim()) {
            return error(res, "Tên loại dịch vụ không được để trống");
        }
        name = name.trim();

        // Kiểm tra tên trùng lặp
        const existing = await LoaiDichVu.findOne({
            name: { $regex: new RegExp(`^${name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (existing) {
            return error(res, `Loại dịch vụ "${name}" đã tồn tại!`);
        }

        // Tạo prefix nếu chưa có
        if (!prefix || !prefix.trim()) {
            prefix = generatePrefixFromName(name);
        } else {
            prefix = prefix.trim().toUpperCase();
            if (!prefix.endsWith('_')) {
                prefix += '_';
            }
        }

        // Tự động tìm ID lớn nhất để tăng lên 1
        const maxDoc = await LoaiDichVu.findOne().sort({ id: -1 });
        const nextId = maxDoc ? (maxDoc.id + 1) : 1;

        const newType = new LoaiDichVu({
            id: nextId,
            name,
            prefix,
            icon: icon ? icon.trim() : "📦",
            color: color || "#2563eb",
            badgeBg: badgeBg || "#dbeafe",
            description: description ? description.trim() : ""
        });

        await newType.save();
        console.log(`Đã tạo loại dịch vụ: ${name} (ID: ${nextId}, Prefix: ${prefix})`);

        createLog({
            action: `Thêm loại dịch vụ mới (${name})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { id: nextId, name, prefix }
        });

        return success(res, "Thêm loại dịch vụ thành công", newType);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { id, _id, name, prefix, icon, color, badgeBg, description } = req.body;
        const targetId = id !== undefined ? Number(id) : undefined;

        if (targetId === undefined && !_id) {
            return error(res, "Thiếu ID loại dịch vụ cần cập nhật");
        }

        if (!name || !name.trim()) {
            return error(res, "Tên loại dịch vụ không được để trống");
        }

        const query = targetId !== undefined ? { id: targetId } : { _id };

        // Kiểm tra trùng tên với loại dịch vụ khác
        const duplicateCheck = await LoaiDichVu.findOne({
            name: { $regex: new RegExp(`^${name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
            ...(targetId !== undefined ? { id: { $ne: targetId } } : { _id: { $ne: _id } })
        });
        if (duplicateCheck) {
            return error(res, `Tên loại dịch vụ "${name.trim()}" đã được sử dụng!`);
        }

        let formattedPrefix = prefix;
        if (prefix && prefix.trim()) {
            formattedPrefix = prefix.trim().toUpperCase();
            if (!formattedPrefix.endsWith('_')) {
                formattedPrefix += '_';
            }
        }

        const updateData = {
            name: name.trim(),
            ...(formattedPrefix !== undefined && { prefix: formattedPrefix }),
            ...(icon !== undefined && { icon: icon.trim() }),
            ...(color !== undefined && { color }),
            ...(badgeBg !== undefined && { badgeBg }),
            ...(description !== undefined && { description: description.trim() })
        };

        const updated = await LoaiDichVu.findOneAndUpdate(
            query,
            { $set: updateData },
            { new: true }
        );

        if (!updated) {
            return error(res, "Không tìm thấy loại dịch vụ để cập nhật");
        }

        console.log(`Đã cập nhật loại dịch vụ: ${updated.name} (ID: ${updated.id})`);

        createLog({
            action: `Cập nhật loại dịch vụ (${updated.name})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { id: updated.id, updateData }
        });

        return success(res, "Cập nhật loại dịch vụ thành công", updated);
    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const id = req.body?.id ?? req.query?.id ?? req.params?.id;
        const _id = req.body?._id ?? req.query?._id ?? req.params?._id;

        const targetId = id !== undefined ? Number(id) : undefined;
        if (targetId === undefined && !_id) {
            return error(res, "Thiếu ID loại dịch vụ cần xóa");
        }

        const query = targetId !== undefined ? { id: targetId } : { _id };
        const found = await LoaiDichVu.findOne(query);

        if (!found) {
            return error(res, "Không tìm thấy loại dịch vụ để xóa");
        }

        // Kiểm tra xem có dịch vụ nào đang gắn với loại này không
        const activeCount = await DichVu.countDocuments({ loaiDichVu: found.id });
        if (activeCount > 0) {
            return error(res, `Không thể xóa loại dịch vụ "${found.name}" vì đang có ${activeCount} dịch vụ trong kho thuộc loại này. Vui lòng chuyển đổi hoặc xóa các dịch vụ liên quan trước!`);
        }

        const deleted = await LoaiDichVu.findOneAndDelete(query);

        console.log(`Đã xóa loại dịch vụ ID ${found.id}: ${found.name}`);

        createLog({
            action: `Xóa loại dịch vụ (${found.name})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { id: found.id, name: found.name }
        });

        return success(res, `Đã xóa loại dịch vụ "${found.name}" thành công!`, deleted);
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    find,
    create,
    update,
    remove,
    defaultServiceTypes,
    generatePrefixFromName
};
