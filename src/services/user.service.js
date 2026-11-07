const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
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
            hoaHongTheoLoaiHD: Array.isArray(data.hoaHongTheoLoaiHD) ? data.hoaHongTheoLoaiHD : [],
            permissions: Array.isArray(data.permissions) ? data.permissions : []
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
        const { username, password, fullname, birthday, positon, permission, permissions, avatar, luongCoBan, luongHoaHong, loaiHoaHong, chiTieuTuan, chiTieuThang, chiTieuNam, hoaHongTheoLoaiHD } = req.body;
        if (!username) return error(res, "Thiếu username để cập nhật");

        // Kiểm tra quyền người thực hiện thao tác
        let isManager = false;
        if (req.user && req.user.username) {
            const requester = await User.findOne({ username: req.user.username });
            if (requester) {
                isManager = requester.positon === "Quản lý" || 
                            requester.positon === "Admin" || 
                            requester.positon === "Quản trị viên" || 
                            requester.permission === 1;
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
            if (permissions !== undefined && Array.isArray(permissions)) user.permissions = permissions;
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

        // 3. Tạo JWT access token có hạn ngắn (24h khi ghi nhớ, 2h khi không ghi nhớ)
        const isRemember = req.body?.remember !== false && req.body?.remember !== "false";
        const expiresIn = isRemember ? (process.env.ACCESS_TOKEN_EXPIRES_IN || "24h") : "2h";
        const expiresInSeconds = isRemember ? 86400 : 7200;

        const tokenPayload = {
            username: user.username,
            fullname: user.fullname,
            positon: user.positon,
            permission: user.permission,
            permissions: user.permissions || [],
            tokenVersion: user.tokenVersion || 0,
            isRemember
        };

        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn });

        // 4. Sinh rotating Refresh Token bảo mật lưu hash trong DB
        const refreshTokenVal = user.createRefreshToken(isRemember ? 30 : 7);
        await user.save();

        createLog({
            action: "Đăng nhập hệ thống",
            user: user.fullname || user.username,
            req,
            details: { username: user.username, positon: user.positon, isRemember }
        });

        return success(res, "Đăng nhập thành công!", {
            token: accessToken, // Giữ trường token để tương thích ngược 100% với axiosClient v1
            accessToken: accessToken,
            refreshToken: refreshTokenVal,
            expiresIn: expiresInSeconds,
            username: user.username,
            fullname: user.fullname,
            birthday: user.birthday,
            positon: user.positon,
            permission: user.permission,
            permissions: user.permissions || [],
            avatar: user.avatar,
            isRemember: isRemember
        });

    } catch (err) {
        return error(res, "Đăng nhập thất bại: " + err.message, 500);
    }
}

async function refreshToken(req, res) {
    try {
        const rawRefreshToken = req.body?.refreshToken;
        const authHeader = req.headers?.["authorization"] || req.headers?.authorization;
        const legacyToken = req.body?.token || (authHeader && authHeader.split(" ")[1]);

        let user = null;
        let isRemember = true;

        if (rawRefreshToken) {
            // Chuẩn v2: Sử dụng rotating Refresh Token bảo mật
            const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
            user = await User.findOne({
                "refreshTokens.tokenHash": tokenHash,
                "refreshTokens.expiresAt": { $gt: new Date() }
            });

            if (!user) {
                return error(res, "Refresh token không hợp lệ hoặc đã hết hạn", 401);
            }

            // Thu hồi token cũ (loại bỏ token đã dùng khỏi mảng)
            user.refreshTokens = (user.refreshTokens || []).filter(t => t.tokenHash !== tokenHash);
        } else if (legacyToken) {
            // Chế độ tương thích ngược v1: Client cũ gửi { token }
            let decoded;
            try {
                decoded = jwt.verify(legacyToken, process.env.JWT_SECRET, { ignoreExpiration: true });
            } catch (jwtErr) {
                return error(res, "Token v1 không hợp lệ", 401);
            }

            if (!decoded || !decoded.username) {
                return error(res, "Token không hợp lệ", 401);
            }

            // Giới hạn an toàn: không cấp mới nếu token đã được cấp trước đó quá 30 ngày
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (decoded.iat && (nowSeconds - decoded.iat > 30 * 24 * 3600)) {
                return error(res, "Phiên đăng nhập đã quá hạn tối đa, vui lòng đăng nhập lại", 401);
            }

            user = await User.findOne({ username: decoded.username });
            if (!user) {
                return error(res, "Tài khoản không còn tồn tại trên hệ thống", 401);
            }

            // Kiểm tra tokenVersion nếu có trong payload
            if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
                return error(res, "Phiên đăng nhập đã bị thu hồi", 401);
            }

            isRemember = decoded.isRemember !== false;
        } else {
            return error(res, "Không tìm thấy token để gia hạn", 401);
        }

        // Tạo access token mới với hạn ngắn
        const expiresIn = isRemember ? (process.env.ACCESS_TOKEN_EXPIRES_IN || "24h") : "2h";
        const expiresInSeconds = isRemember ? 86400 : 7200;

        const newAccessToken = jwt.sign(
            {
                username: user.username,
                fullname: user.fullname,
                positon: user.positon,
                permission: user.permission,
                permissions: user.permissions || [],
                tokenVersion: user.tokenVersion || 0,
                isRemember
            },
            process.env.JWT_SECRET,
            { expiresIn }
        );

        // Xoay vòng Refresh Token mới
        const newRefreshToken = user.createRefreshToken(isRemember ? 30 : 7);
        await user.save();

        return success(res, "Gia hạn phiên đăng nhập thành công", {
            token: newAccessToken, // Tương thích v1
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: expiresInSeconds,
            username: user.username,
            fullname: user.fullname,
            positon: user.positon,
            permission: user.permission,
            permissions: user.permissions || []
        });
    } catch (err) {
        return error(res, "Không thể gia hạn phiên đăng nhập: " + err.message, 401);
    }
}

async function logoutUser(req, res) {
    try {
        const username = req.user?.username || req.body?.username;
        const rawRefreshToken = req.body?.refreshToken;
        const allDevices = req.body?.allDevices === true || req.body?.allDevices === "true";

        if (!username) {
            return success(res, "Đã đăng xuất");
        }

        const user = await User.findOne({ username });
        if (user) {
            if (allDevices) {
                // Thu hồi tất cả các phiên: tăng tokenVersion và xóa mọi refresh token
                user.tokenVersion = (user.tokenVersion || 0) + 1;
                user.refreshTokens = [];
            } else if (rawRefreshToken) {
                // Thu hồi phiên hiện tại theo refreshToken hash
                const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
                user.refreshTokens = (user.refreshTokens || []).filter(t => t.tokenHash !== tokenHash);
            } else {
                // Mặc định đăng xuất thiết bị: tăng tokenVersion để vô hiệu hóa access token hiện có
                user.tokenVersion = (user.tokenVersion || 0) + 1;
                user.refreshTokens = [];
            }
            await user.save();
        }

        createLog({
            action: "Đăng xuất hệ thống",
            user: req.user?.fullname || username,
            req,
            details: { username, allDevices }
        });

        return success(res, "Đăng xuất thành công");
    } catch (err) {
        return error(res, "Đăng xuất thất bại: " + err.message, 500);
    }
}

async function updateUserPermissions(req, res) {
    try {
        const { username, permissions } = req.body;
        if (!username) return error(res, "Thiếu username để cập nhật quyền", 400);

        // Kiểm tra quyền người thực hiện thao tác: chỉ Quản lý mới được phân quyền
        let isManager = false;
        if (req.user && req.user.username) {
            const requester = await User.findOne({ username: req.user.username });
            if (requester) {
                isManager = requester.positon === "Quản lý" || 
                            requester.positon === "Admin" || 
                            requester.positon === "Quản trị viên" || 
                            requester.permission === 1;
            }
        }

        if (!isManager) {
            return error(res, "Bạn không có quyền phân quyền cho người dùng khác", 403);
        }

        const user = await User.findOne({ username });
        if (!user) return error(res, "Không tìm thấy tài khoản người dùng", 404);

        user.permissions = Array.isArray(permissions) ? permissions : [];
        if (user.positon !== 'Quản lý' && user.positon !== 'Admin' && user.positon !== 'Quản trị viên') {
            const hasAll = user.permissions.includes('*') || user.permissions.includes('all');
            user.permission = hasAll ? 1 : 2;
        }
        await user.save();

        createLog({
            action: "Phân quyền chức năng nhân viên",
            user: req.user?.fullname || "Quản lý",
            req,
            details: { username, fullname: user.fullname, permissions: user.permissions }
        });

        return success(res, "Cập nhật phân quyền chức năng thành công!", {
            username: user.username,
            fullname: user.fullname,
            permissions: user.permissions
        });
    } catch (err) {
        return error(res, "Cập nhật phân quyền thất bại: " + err.message, 500);
    }
}

module.exports = {
    loginUser,
    refreshToken,
    logoutUser,
    createUser,
    updateUser,
    updateUserPermissions,
    removeUser,
    findUsers
};
