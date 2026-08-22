const KhachHang = require("../models/khachHang.model");
const { success, error } = require("../utils/response");
const jwt = require("jsonwebtoken");



async function create(req, res) {
    const data = req.body;
    try {
        const khachHang = new KhachHang({
            maKhachHang: data.maKhachHang,
            tenKhachHang: data.tenKhachHang,
            soDienThoai: data.soDienThoai,
            avatar: data.avatar || "",
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


function createSearchRegex(keyword) {
    if (!keyword) return null;
    const map = {
        'a': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'e': '[eèéẻẽẹêềếểễệ]',
        'i': '[iìíỉĩị]',
        'o': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'u': '[uùúủũụưừứửữự]',
        'y': '[yỳýỷỹỵ]',
        'd': '[dđ]',
    };
    const pattern = keyword.split('').map(char => {
        const lower = char.toLowerCase();
        if (map[lower]) return map[lower];
        return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return new RegExp(pattern, 'i');
}

async function find(req, res) {
    const { soDienThoai, keyword, facebookId, tenKhachHang } = req.body || {};
    try {
        let query = {};
        if (tenKhachHang) {
            query.tenKhachHang = createSearchRegex(tenKhachHang);
        } else if (soDienThoai) {
            const escaped = soDienThoai.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.soDienThoai = { $regex: escaped, $options: 'i' };
        } else if (facebookId) {
            const escaped = facebookId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.facebookId = { $regex: escaped, $options: 'i' };
        } else if (keyword) {
            const searchRegex = createSearchRegex(keyword);
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { tenKhachHang: searchRegex },
                { soDienThoai: { $regex: escaped, $options: 'i' } },
                { diaChi: searchRegex }
            ];
        }

        let customersQuery = KhachHang.find(query).sort({ createdAt: -1 });
        if (tenKhachHang || soDienThoai || facebookId || keyword) {
            customersQuery = customersQuery.limit(50);
        }
        const customers = await customersQuery;

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

        const updateFields = { tenKhachHang, soDienThoai, maDangNhap, ngaySinhNhat, gioiTinh, diaChi, ngayCapCCCD, facebookId };
        if (avatar !== undefined) updateFields.avatar = avatar;

        const khachHang = await KhachHang.findByIdAndUpdate(
            _id,
            { $set: updateFields },
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

async function login(req, res) {
    const { soDienThoai, maDangNhap } = req.body;
    try {
        if (!soDienThoai || !maDangNhap) {
            return error(res, "Vui lòng nhập tài khoản (SĐT/Link FB) và mã đăng nhập", 400);
        }

        let query = {};
        
        // Kiểm tra xem là link facebook hay sđt/id
        if (soDienThoai.includes("facebook.com") || soDienThoai.includes("fb.com")) {
            const formData = new URLSearchParams();
            formData.append('link', soDienThoai);

            const response = await fetch('https://id.traodoisub.com/api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            const json = await response.json();
            if (json && json.success === 200 && json.id) {
                query.facebookId = json.id;
            } else {
                return error(res, "Không thể trích xuất ID từ link Facebook này.", 400);
            }
        } else {
            query = { $or: [{ soDienThoai: soDienThoai }, { facebookId: soDienThoai }] };
        }

        const khachHang = await KhachHang.findOne(query);
        if (!khachHang) {
            return error(res, "Khách hàng không tồn tại trên hệ thống", 400);
        }

        if (khachHang.maDangNhap !== maDangNhap) {
            return error(res, "Mã đăng nhập không đúng", 400);
        }

        const token = jwt.sign(
            { id: khachHang._id, soDienThoai: khachHang.soDienThoai, role: 'KhachHang', fullname: khachHang.tenKhachHang },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        return success(res, "Đăng nhập thành công!", { token, khachHang });
    } catch (err) {
        return error(res, err.message, 500);
    }
}

module.exports = {
    create,
    find,
    update,
    remove,
    getFacebookInfo,
    login
};
