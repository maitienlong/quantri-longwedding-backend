const LichSoanDo = require("../models/lichSoanDo.model");
const { success, error } = require("../utils/response");

async function createOrUpdate(req, res) {
    try {
        const {
            hopDongId,
            maHopDong,
            ngaySoan,
            ngayMuon,
            ngayTra,
            datCoc,
            nguoiKiem,
            noiDung,
            trangThai,
            dsMuon,
            dsTra
        } = req.body;

        if (!hopDongId) {
            return error(res, "Thiếu hopDongId");
        }
        if (!maHopDong) {
            return error(res, "Thiếu maHopDong");
        }

        let item = await LichSoanDo.findOne({ hopDongId });

        if (item) {
            // Update
            item.ngaySoan = ngaySoan;
            item.ngayMuon = ngayMuon;
            item.ngayTra = ngayTra;
            item.datCoc = Number(datCoc) || 0;
            item.nguoiKiem = nguoiKiem;
            item.noiDung = noiDung;
            item.trangThai = trangThai;
            item.dsMuon = dsMuon || [];
            item.dsTra = dsTra || [];
            await item.save();
            return success(res, "Cập nhật lịch soạn đồ thành công", item);
        } else {
            // Create
            item = new LichSoanDo({
                hopDongId,
                maHopDong,
                ngaySoan,
                ngayMuon,
                ngayTra,
                datCoc: Number(datCoc) || 0,
                nguoiKiem,
                noiDung,
                trangThai,
                dsMuon: dsMuon || [],
                dsTra: dsTra || []
            });
            await item.save();
            return success(res, "Tạo lịch soạn đồ thành công", item);
        }
    } catch (err) {
        return error(res, err.message);
    }
}

async function findAll(req, res) {
    try {
        const list = await LichSoanDo.find()
            .populate({
                path: "hopDongId",
                populate: [
                    { path: "khachHang1", select: "tenKhachHang soDienThoai" },
                    { path: "khachHang2", select: "tenKhachHang soDienThoai" }
                ]
            })
            .sort({ createdAt: -1 });

        return success(res, "Lấy danh sách lịch soạn đồ thành công", {
            count: list.length,
            lichSoanDo: list
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function findByContract(req, res) {
    try {
        const { hopDongId } = req.body || req.query;
        const item = await LichSoanDo.findOne({ hopDongId }).populate({
            path: "hopDongId",
            populate: [
                { path: "khachHang1", select: "tenKhachHang soDienThoai" },
                { path: "khachHang2", select: "tenKhachHang soDienThoai" }
            ]
        });
        if (!item) {
            return success(res, "Không tìm thấy lịch soạn đồ cho hợp đồng này", null);
        }
        return success(res, "Tìm thấy lịch soạn đồ", item);
    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const { id } = req.body || req.query;
        const item = await LichSoanDo.findByIdAndDelete(id);
        if (!item) {
            return error(res, "Không tìm thấy lịch soạn đồ để xóa");
        }
        return success(res, "Xóa lịch soạn đồ thành công");
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    createOrUpdate,
    findAll,
    findByContract,
    remove
};
