const LoaiHopDong = require("../models/loaiHopDong.model");
const { success, error } = require("../utils/response");

const defaultTypes = [
    { name: 'Pre-Wedding', id: 1 },
    { name: 'Phóng Sự Ăn Hỏi', id: 2 },
    { name: 'Phóng Sự Cưới', id: 3 },
    { name: 'Beauty', id: 4 },
    { name: 'Ảnh Thẻ', id: 5 },
    { name: 'Bé', id: 6 },
    { name: 'Gia Đình', id: 7 },
    { name: 'Video Phóng Sự', id: 8 },
    { name: 'Thiệp Mời', id: 9 },
    { name: 'Livestream', id: 10 },
    { name: 'Trang điểm', id: 11 },
    { name: 'Cho thuê trang phục', id: 12 },
    { name: 'Khác', id: 13 }
];

async function find(req, res) {
    try {
        let list = await LoaiHopDong.find().sort({ id: 1 });
        if (list.length === 0) {
            console.log("LoaiHopDong collection is empty. Seeding defaults...");
            await LoaiHopDong.insertMany(defaultTypes);
            list = await LoaiHopDong.find().sort({ id: 1 });
        }
        return success(res, "Tải danh sách loại hợp đồng thành công", {
            count: list.length,
            loaiHopDong: list
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function create(req, res) {
    try {
        const { name } = req.body;
        if (!name) return error(res, "Tên loại hợp đồng không được trống");

        // Tìm ID lớn nhất hiện tại để cộng thêm 1
        const maxType = await LoaiHopDong.findOne().sort({ id: -1 });
        const nextId = maxType ? maxType.id + 1 : 1;

        const newType = new LoaiHopDong({
            id: nextId,
            name: name
        });
        await newType.save();
        console.log(`Đã tạo loại hợp đồng: ${name} (ID: ${nextId})`);
        return success(res, "Thêm loại hợp đồng thành công", newType);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { id, name } = req.body;
        if (!id) return error(res, "Thiếu ID loại hợp đồng");
        if (!name) return error(res, "Tên loại hợp đồng không được trống");

        const updated = await LoaiHopDong.findOneAndUpdate(
            { id: Number(id) },
            { $set: { name: name } },
            { new: true }
        );

        if (!updated) return error(res, "Không tìm thấy loại hợp đồng để cập nhật");

        console.log(`Đã cập nhật loại hợp đồng ID ${id} thành: ${name}`);
        return success(res, "Cập nhật loại hợp đồng thành công", updated);
    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const id = req.body.id || req.query.id;
        if (!id) return error(res, "Thiếu ID loại hợp đồng");

        const deleted = await LoaiHopDong.findOneAndDelete({ id: Number(id) });
        if (!deleted) return error(res, "Không tìm thấy loại hợp đồng để xóa");

        console.log(`Đã xóa loại hợp đồng ID ${id}: ${deleted.name}`);
        return success(res, "Xóa loại hợp đồng thành công", deleted);
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    find,
    create,
    update,
    remove
};
