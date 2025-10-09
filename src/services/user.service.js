const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

async function getAllUsers() {
    return await User.find();
}

async function createUser(data) {
    try {
        const user = new User({ username: data.username, password: data.password, fullname: data.fullname, birthday: data.birthday, positon: data.positon, permission: data.permission });
        await user.save();
        console.log("Tài khoản: " + data.fullname + " đã được tạo thành công !");
        return {
            success: true, data: {
                username: user.username, fullname: user.fullname,
                birthday: user.birthday, positon: user.positon, permission: user.permission
            }
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function loginUser(data) {
    const { username, password } = data;

    try {
        // 1. Kiểm tra email có tồn tại
        const user = await User.findOne({ username });
        if (!user) {
            return {
                success: false,
                data: {
                    message: "Tài khoản không tồn tại",
                    token: null,
                    username: null,
                    fullname: null,
                }
            };
        }

        // 2. So sánh mật khẩu
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {

            return {
                success: false,
                data: {
                    message: "Mật khẩu không đúng",
                    token: null,
                    username: null,
                    fullname: null,
                }
            };
        }

        // 3. Tạo JWT token
        const token = jwt.sign(
            { username: user.username, fullname: user.fullname }, // payload
            process.env.JWT_SECRET || "mysecret", // secret key
            { expiresIn: "1d" } // token hết hạn sau 1 ngày
        );

        return {
            success: true,
            data: {
                message: "Đăng nhập thành công",
                token: token,
                username: user.username,
                fullname: user.fullname,
            }
        };

    } catch (err) {
        return {
            success: true,
            data: {
                message: err.message,
                token: null,
                username: null,
                fullname: null,
            }
        };
    }
}


module.exports = {
    getAllUsers,
    loginUser,
    createUser,
};
