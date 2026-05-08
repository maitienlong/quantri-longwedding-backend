const KhachHang = require("../models/khachHang.model");
const { success, error } = require("../utils/response");



async function create(req, res) {
    const data = req.body;
    try {
        const khachHang = new KhachHang({
            maKhachHang: data.maKhachHang,
            tenKhachHang: data.tenKhachHang,
            soDienThoai: data.soDienThoai,
            avatar: data.avatar || "https://pngtree.com/free-png-vectors/avatar-placeholder",
            maDangNhap: data.maDangNhap || "abcd1234",
            ngaySinhNhat: data.ngaySinhNhat || "01/01/2000",
            gioiTinh: data.gioiTinh || "Nam",
            diaChi: data.diaChi || "Địa chỉ chưa cập nhật",
            ngayCapCCCD: data.ngayCapCCCD || "01/01/2020"
        });
        await khachHang.save();
        console.log("Khởi tạo khách hàng: " + data.tenKhachHang + " thành công !");
        return success(res, "Khởi tạo khách hàng thành công!", khachHang);
    } catch (err) {
        return error(res, err.message);
    }
}


async function find(req, res) {
    const data = req.body;
    try {
        console.log("Tìm khách hàng với số điện thoại: " + data.soDienThoai);
        const khachHang = await KhachHang.find({ soDienThoai: { $regex: data.soDienThoai, $options: 'i' } });
        if (khachHang.length === 0) {
            return error(res, "Không tìm thấy khách hàng!");
        }
        return success(res, "Tìm khách hàng thành công!", khachHang);
    } catch (err) {
        return error(res, err.message);
    }
}


module.exports = {
    create,
    find
};
