const KhachHang = require("../models/khachHang.model");

async function listAll() { 
    try {
        const khachHang = await KhachHang.find();
         return {
            success: true, data: {
                count: khachHang.length,
                khachHang
            }
        };
    } catch (error) {
        return { success: false, error: err.message };
    }
}

async function findOne(data) { 
    try {
        const khachHang = await KhachHang.find({ maKhachHang: data.maKhachHang });
        if (khachHang.length === 0) {
            return { success: false, message: "Không tìm thấy khách hàng!" };
        }
         return {
            success: true, data: {
                count: khachHang.length,
                khachHang
            }
        };
    } catch (error) {
        return { success: false, message: err.message };
    }
}

async function taoKhachHang(data) {
    try {
        const khachHang = new KhachHang({
            maKhachHang: data.maKhachHang,
            tenKhachHang: data.tenKhachHang,
            maDangNhap: data.maDangNhap,
            ngaySinhNhat: data.ngaySinhNhat,
            gioiTinh: data.gioiTinh,
            diaChi: data.diaChi,
            ngayCapCCCD: data.ngayCapCCCD
        });
        await khachHang.save();
        console.log("Khởi tạo khách hàng: " + data.fullname + " thành công !");
        return {
            success: true, data: {
                khachHang
            }
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}


module.exports = {
    listAll,
    taoKhachHang,
    findOne
};
