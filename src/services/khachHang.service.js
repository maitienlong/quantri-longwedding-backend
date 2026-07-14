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
            ngayCapCCCD: data.ngayCapCCCD || "01/01/2020",
            facebookId: data.facebookId || ""
        });
        await khachHang.save();
        console.log("Khởi tạo khách hàng: " + data.tenKhachHang + " thành công !");
        return success(res, "Khởi tạo khách hàng thành công!", khachHang);
    } catch (err) {
        return error(res, err.message);
    }
}


async function find(req, res) {
    const { soDienThoai, keyword, facebookId } = req.body || {};
    try {
        let query = {};
        if (soDienThoai) {
            query.soDienThoai = { $regex: soDienThoai, $options: 'i' };
        } else if (facebookId) {
            query.facebookId = { $regex: facebookId, $options: 'i' };
        } else if (keyword) {
            query.$or = [
                { tenKhachHang: { $regex: keyword, $options: 'i' } },
                { soDienThoai: { $regex: keyword, $options: 'i' } },
                { diaChi: { $regex: keyword, $options: 'i' } }
            ];
        }

        const customers = await KhachHang.find(query).sort({ createdAt: -1 });

        // For each customer, count how many contracts they have
        const HopDong = require("../models/hopDong.model");
        const customersWithStats = await Promise.all(customers.map(async (c) => {
            const contractCount = await HopDong.countDocuments({
                $or: [
                    { khachHang1: c._id },
                    { khachHang2: c._id }
                ]
            });
            return {
                ...c.toObject(),
                soHopDong: contractCount
            };
        }));

        return success(res, "Tìm khách hàng thành công!", customersWithStats);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { _id, tenKhachHang, soDienThoai, avatar, maDangNhap, ngaySinhNhat, gioiTinh, diaChi, ngayCapCCCD, facebookId } = req.body;
        if (!_id) return error(res, "Thiếu _id khách hàng để cập nhật");

        const khachHang = await KhachHang.findByIdAndUpdate(
            _id,
            { $set: { tenKhachHang, soDienThoai, avatar, maDangNhap, ngaySinhNhat, gioiTinh, diaChi, ngayCapCCCD, facebookId } },
            { new: true }
        );

        if (!khachHang) return error(res, "Không tìm thấy khách hàng để cập nhật");
        return success(res, "Cập nhật khách hàng thành công!", khachHang);
    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const _id = req.body._id || req.query._id || req.params._id;
        if (!_id) return error(res, "Thiếu _id khách hàng để xóa");

        // Check if customer has contracts. Warn and prevent delete if linked.
        const HopDong = require("../models/hopDong.model");
        const contractCount = await HopDong.countDocuments({
            $or: [
                { khachHang1: _id },
                { khachHang2: _id }
            ]
        });

        if (contractCount > 0) {
            return error(res, `Không thể xóa khách hàng này vì đang có ${contractCount} hợp đồng liên kết trên hệ thống!`);
        }

        const khachHang = await KhachHang.findByIdAndDelete(_id);
        if (!khachHang) return error(res, "Không tìm thấy khách hàng để xóa");

        return success(res, "Xóa khách hàng thành công!", { _id });
    } catch (err) {
        return error(res, err.message);
    }
}

async function getFacebookInfo(req, res) {
    const { url } = req.body;
    if (!url) return error(res, "Thiếu URL Facebook");
    try {
        const formData = new URLSearchParams();
        formData.append('link', url);

        const response = await fetch('https://id.traodoisub.com/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const json = await response.json();
        
        if (json && json.success === 200 && json.id) {
            return success(res, "Lấy thông tin Facebook thành công!", { 
                name: json.name || "",
                uid: json.id
            });
        }
        
        return error(res, "Không tìm thấy thông tin Facebook");
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    create,
    find,
    update,
    remove,
    getFacebookInfo
};
