const HopDong = require("../models/hopDong.model");
const KhachHang = require("../models/khachHang.model");
const DichVu = require("../models/dichVu.model");
const { success, error } = require("../utils/response");



async function create(req, res) {

    try {
        const hopDong = new HopDong({
            maHopDong: req.body.maHopDong,
            ngayHopDong: req.body.ngayHopDong,
            khachHang1: req.body.khachHang1,
            khachHang2: req.body.khachHang2,
            gioHang: req.body.gioHang,
            thanhToan: req.body.thanhToan,
            cacNgay: req.body.cacNgay,
            nguoiPhucVu: req.body.nguoiPhucVu,
            giaiDoan: req.body.giaiDoan,
            dichVuChinh: req.body.dichVuChinh
        });
        await hopDong.save();
        console.log("Đã tạo hợp đồng mã số: " + req.body.maHopDong + " thành công !");
        return success(res, "Đã tạo hợp đồng mã số: " + req.body.maHopDong + " thành công !", hopDong);
    } catch (err) {
        if (err.code === 11000) {
            return error(res, "Mã hợp đồng đã tồn tại, vui lòng sử dụng mã khác.");
        }
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { maHopDong, gioHang, thanhToan, nguoiPhucVu, giaiDoan } = req;
        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy");

        hopDong.gioHang = gioHang;
        hopDong.thanhToan = thanhToan;

        await hopDong.save();

        return success(res, { message: "Đã cập nhật thành công", hopDong });

    } catch (error) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const { maHopDong } = req;
        const HopDong = await HopDong.findOneAndDelete({ maHopDong: maHopDong });

        if (!HopDong) {
            return error(res, "Không tìm thấy dịch vụ để xóa");
        }

        console.log("Đã xóa dịch vụ:", HopDong.tenHopDong);
        return success(res, { message: "Xóa dịch vụ thành công" });
    } catch (err) {
        return error(res, err.message);
    }
}

async function pay(req, res) {
    try {
        const HopDong = await HopDong.find();
        return {
            success: true, data: {
                count: HopDong.length,
                HopDong
            }
        };
    } catch (err) {
        return error(res, err.message);
    }
}

async function list(req, res) {
    try {
        const { filter } = req.query;
        let query = {};
        const now = new Date();

        if (filter) {
            let startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);

            switch (filter) {
                case 'today': break;
                case 'week':
                    const day = startDate.getDay();
                    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
                    startDate.setDate(diff);
                    break;
                case 'month':
                    startDate.setDate(1);
                    break;
                case 'year':
                    startDate.setMonth(0, 1);
                    break;
                default:
                    startDate = null;
            }

            if (startDate) {
                query.ngayHopDong = { $gte: startDate };
            }
        }

        // ==========================================
        // SỬ DỤNG .POPULATE() ĐỂ LẤY THÔNG TIN
        // ==========================================
        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',      // Tên trường chứa ObjectId của khách hàng 1
                select: 'tenKhachHang soDienThoai' // Chỉ định các trường muốn lấy (ví dụ: tên, SĐT). Cách nhau bằng khoảng trắng.
            })
            .populate({
                path: 'khachHang2',      // Tên trường chứa ObjectId của khách hàng 2
                select: 'tenKhachHang soDienThoai'
            })
            // Tùy chọn: Bạn cũng có thể populate luôn thông tin dịch vụ trong giỏ hàng
            // .populate({
            //     path: 'gioHang.dichVu',
            //     select: 'tenDichVu'
            // })
            .sort({ ngayHopDong: -1 });

        return success(res, "Tải dữ liệu thành công !", {
            filter: filter || "all",
            count: hopDong.length,
            hopDong
        });
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    create,
    update,
    pay,
    remove,
    list
};
