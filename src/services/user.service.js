const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const { success, error } = require("../utils/response");


async function createUser(req, res) {
    const data = req.body;
    try {
        const user = new User({ username: data.username, password: data.password, fullname: data.fullname, birthday: data.birthday, positon: data.positon, permission: data.permission });
        await user.save();
        console.log("Tài khoản: " + data.fullname + " đã được tạo thành công !");
        return success(res, "Tạo tài khoản thành công!", {
            username: user.username, fullname: user.fullname,
            birthday: user.birthday, positon: user.positon, permission: user.permission
        });
    } catch (err) {
       return error(res, "Tạo user thất bại !" + err.message);
    }
}

async function updateUser(req, res) {
    try {
        const { username, password, fullname, birthday, positon, permission } = req.body;
        if (!username) return error(res, "Thiếu username để cập nhật");

        const user = await User.findOne({ username });
        if (!user) return error(res, "Không tìm thấy tài khoản người dùng");

        if (password) user.password = password; // pre-save hook will hash this
        if (fullname !== undefined) user.fullname = fullname;
        if (birthday !== undefined) user.birthday = birthday;
        if (positon !== undefined) user.positon = positon;
        if (permission !== undefined) user.permission = Number(permission);

        await user.save();
        console.log(`Đã cập nhật người dùng: ${username}`);
        return success(res, "Cập nhật nhân viên thành công", {
            username: user.username,
            fullname: user.fullname,
            birthday: user.birthday,
            positon: user.positon,
            permission: user.permission
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
        // 1. Kiểm tra email có tồn tại
        const user = await User.findOne({ username });
        if (!user) {
            return error(res, "Tài khoản không tồn tại!")
        }

        // 2. So sánh mật khẩu
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {

            return error(res, "Mật khẩu không đúng!")
        }

        // 3. Tạo JWT token
        const token = jwt.sign(
            { username: user.username, fullname: user.fullname }, // payload
            process.env.JWT_SECRET, // secret key
            { expiresIn: "1d" } // token hết hạn sau 1 ngày
        );

        return success(res, "Đăng nhập thành công!", {
            token: token,
            username: user.username,
            fullname: user.fullname,
            birthday: user.birthday,
            positon: user.positon,
            permission: user.permission
        });

    } catch (err) {
        return error(res, "Đăng nhập thất bại: " + err.message);
    }
}


module.exports = {
    loginUser,
    createUser,
    updateUser,
    removeUser,
    findUsers
};
