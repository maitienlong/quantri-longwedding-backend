const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

async function createUser(req, res) {
    const data = req.body;
    try {
        const user = new User({ 
            username: data.username, 
            password: data.password, 
            fullname: data.fullname, 
            birthday: data.birthday, 
            positon: data.positon, 
            permission: data.permission,
            avatar: data.avatar || "",
            luongCoBan: data.luongCoBan !== undefined ? Number(data.luongCoBan) : 0,
            luongHoaHong: data.luongHoaHong !== undefined ? Number(data.luongHoaHong) : 0,
            loaiHoaHong: data.loaiHoaHong !== undefined ? Number(data.loaiHoaHong) : 0,
            chiTieuTuan: data.chiTieuTuan !== undefined ? Number(data.chiTieuTuan) : 5,
            chiTieuThang: data.chiTieuThang !== undefined ? Number(data.chiTieuThang) : 20,
            chiTieuNam: data.chiTieuNam !== undefined ? Number(data.chiTieuNam) : 200,
            hoaHongTheoLoaiHD: Array.isArray(data.hoaHongTheoLoaiHD) ? data.hoaHongTheoLoaiHD : []
        });
        await user.save();
        console.log("Tài khoản: " + data.fullname + " đã được tạo thành công !");
        createLog({
            action: "Tạo tài khoản nhân viên",
            user: req.user?.fullname || "Quản lý",
            req,
            details: { username: data.username, fullname: data.fullname, positon: data.positon }
        });
        return success(res, "Tạo tài khoản thành công!", {
            username: user.username, fullname: user.fullname,
            birthday: user.birthday, positon: user.positon, permission: user.permission,
            avatar: user.avatar,
            luongCoBan: user.luongCoBan, luongHoaHong: user.luongHoaHong, loaiHoaHong: user.loaiHoaHong,
            chiTieuTuan: user.chiTieuTuan, chiTieuThang: user.chiTieuThang, chiTieuNam: user.chiTieuNam
        });
    } catch (err) {
       return error(res, "Tạo user thất bại !" + err.message);
    }
}

async function updateUser(req, res) {
    try {
        const { username, password, fullname, birthday, positon, permission, avatar, luongCoBan, luongHoaHong, loaiHoaHong, chiTieuTuan, chiTieuThang, chiTieuNam, hoaHongTheoLoaiHD } = req.body;
        if (!username) return error(res, "Thiếu username để cập nhật");

        // Kiểm tra quyền người thực hiện thao tác
        let isManager = false;
        if (req.user && req.user.username) {
            const requester = await User.findOne({ username: req.user.username });
            if (requester) {
                isManager = requester.positon === "Quản lý" || 
                            requester.positon === "Admin" || 
                            requester.positon === "Quản trị viên" || 
                            requester.permission === 1 || 
                            requester.username === "along";
            }
        }

        const isSelfUpdate = req.user && req.user.username && (req.user.username.toLowerCase() === username.toLowerCase());

        if (!isManager && !isSelfUpdate) {
            return error(res, "Bạn không có quyền cập nhật thông tin người dùng khác", 403);
        }

        const user = await User.findOne({ username });
        if (!user) return error(res, "Không tìm thấy tài khoản người dùng");

        if (password) user.password = password; // pre-save hook will hash this
        if (fullname !== undefined) user.fullname = fullname;
        if (birthday !== undefined) user.birthday = birthday;
        if (avatar !== undefined) user.avatar = avatar;

        // Chỉ Quản lý mới được chỉnh sửa các quyền hạn, chức vụ và mức lương, KPI
        if (isManager) {
            if (positon !== undefined) user.positon = positon;
            if (permission !== undefined) user.permission = Number(permission);
            if (luongCoBan !== undefined) user.luongCoBan = Number(luongCoBan);
            if (luongHoaHong !== undefined) user.luongHoaHong = Number(luongHoaHong);
            if (loaiHoaHong !== undefined) user.loaiHoaHong = Number(loaiHoaHong);
            if (chiTieuTuan !== undefined) user.chiTieuTuan = Number(chiTieuTuan);
            if (chiTieuThang !== undefined) user.chiTieuThang = Number(chiTieuThang);
            if (chiTieuNam !== undefined) user.chiTieuNam = Number(chiTieuNam);
            if (hoaHongTheoLoaiHD !== undefined && Array.isArray(hoaHongTheoLoaiHD)) user.hoaHongTheoLoaiHD = hoaHongTheoLoaiHD;
        }

        await user.save();
        console.log(`Đã cập nhật người dùng: ${username}`);
        createLog({
            action: "Cập nhật tài khoản",
            user: req.user?.fullname || username,
            req,
            details: { username, fullname: user.fullname, positon: user.positon }
        });
        return success(res, "Cập nhật nhân viên thành công", {
            username: user.username,
            fullname: user.fullname,
            birthday: user.birthday,
            positon: user.positon,
            permission: user.permission,
            avatar: user.avatar,
            luongCoBan: user.luongCoBan,
            luongHoaHong: user.luongHoaHong,
            loaiHoaHong: user.loaiHoaHong,
            chiTieuTuan: user.chiTieuTuan,
            chiTieuThang: user.chiTieuThang,
            chiTieuNam: user.chiTieuNam
        });
    } catch (err) {
        return error(res, "Cập nhật nhân viên thất bại: " + err.message);
    }
}

async function removeUser(req, res) {
    try {
        const username = req.body.username || req.query.username || req.params.username;
        if (!username) return error(res, "Thiếu username để xóa");

        const user = await User.findOneAndDelete({ username });
        if (!user) return error(res, "Không tìm thấy nhân viên để xóa");

        console.log(`Đã xóa nhân viên: ${username}`);
        createLog({
            action: "Xóa tài khoản nhân viên",
            user: req.user?.fullname || "Quản lý",
            req,
            details: { username, fullname: user.fullname }
        });
        return success(res, "Xóa nhân viên thành công", { username });
    } catch (err) {
        return error(res, "Xóa nhân viên thất bại: " + err.message);
    }
}

async function findUsers(req, res) {
    try {
        const keyword = req.body.keyword || req.query.keyword || req.body.q || req.query.q;
        let query = {};

        if (keyword) {
            query.$or = [
                { username: { $regex: keyword, $options: "i" } },
                { fullname: { $regex: keyword, $options: "i" } },
                { positon: { $regex: keyword, $options: "i" } }
            ];
        }

        const users = await User.find(query).select("-password").sort({ createdAt: -1 });
        return success(res, "Tải danh sách nhân viên thành công", {
            count: users.length,
            users
        });
    } catch (err) {
        return error(res, "Lấy danh sách nhân viên thất bại: " + err.message);
    }
}

async function loginUser(req, res) {
    const data = req.body;
    const { username, password } = data;

    try {
        if (!username || !password) {
            return error(res, "Vui lòng nhập đầy đủ tài khoản và mật khẩu!", 400);
        }

        // 1. Kiểm tra tài khoản có tồn tại
        const user = await User.findOne({ username });
        if (!user) {
            return error(res, "Tài khoản không tồn tại trên hệ thống!", 400);
        }

        // 2. So sánh mật khẩu
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return error(res, "Mật khẩu không chính xác!", 400);
        }

        // 3. Tạo JWT token
        const isRemember = req.body?.remember !== false && req.body?.remember !== "false";
        const signOptions = isRemember ? { expiresIn: "36500d" } : { expiresIn: "365d" };

        const token = jwt.sign(
            { username: user.username, fullname: user.fullname, isRemember },
            process.env.JWT_SECRET,
            signOptions
        );

        createLog({
            action: "Đăng nhập hệ thống",
            user: user.fullname || user.username,
            req,
            details: { username: user.username, positon: user.positon, isRemember }
        });

        return success(res, "Đăng nhập thành công!", {
            token: token,
            username: user.username,
            fullname: user.fullname,
            birthday: user.birthday,
            positon: user.positon,
            permission: user.permission,
            avatar: user.avatar,
            isRemember: isRemember
        });

    } catch (err) {
        return error(res, "Đăng nhập thất bại: " + err.message, 500);
    }
}

async function refreshToken(req, res) {
    try {
        const authHeader = req.headers["authorization"];
        const oldToken = req.body?.token || (authHeader && authHeader.split(" ")[1]);
        if (!oldToken) {
            return error(res, "Không tìm thấy token để gia hạn", 401);
        }

        const decoded = jwt.verify(oldToken, process.env.JWT_SECRET, { ignoreExpiration: true });
        if (!decoded || !decoded.username) {
            return error(res, "Token không hợp lệ", 401);
        }

        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            return error(res, "Tài khoản không còn tồn tại trên hệ thống", 401);
        }

        const newToken = jwt.sign(
            { username: user.username, fullname: user.fullname, isRemember: true },
            process.env.JWT_SECRET,
            { expiresIn: "36500d" }
        );

        return success(res, "Gia hạn phiên đăng nhập thành công", {
            token: newToken,
            username: user.username,
            fullname: user.fullname,
            positon: user.positon,
            permission: user.permission
        });
    } catch (err) {
        return error(res, "Không thể gia hạn phiên đăng nhập: " + err.message, 401);
    }
}

module.exports = {
    loginUser,
    refreshToken,
    createUser,
    updateUser,
    removeUser,
    findUsers
};
