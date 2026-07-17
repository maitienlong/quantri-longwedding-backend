const Account = require('../models/account.model');
const bcrypt = require('bcryptjs');

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({}, { password: 0 }); // Không trả về password
    res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    console.error("Lỗi getAccounts:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const { username, password } = req.body;
    const existing = await Account.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Tài khoản đã tồn tại" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAccount = new Account({ username, password: hashedPassword });
    await newAccount.save();

    const accounts = await Account.find({}, { password: 0 });
    res.status(201).json({ success: true, data: accounts, message: "Tạo tài khoản thành công" });
  } catch (error) {
    console.error("Lỗi createAccount:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }

    if (username) account.username = username;
    
    // Nếu có gửi mật khẩu mới thì mã hóa rồi cập nhật
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      account.password = await bcrypt.hash(password, salt);
    }

    await account.save();

    const accounts = await Account.find({}, { password: 0 });
    res.status(200).json({ success: true, data: accounts, message: "Cập nhật thành công" });
  } catch (error) {
    console.error("Lỗi updateAccount:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    await Account.findByIdAndDelete(id);

    const accounts = await Account.find({}, { password: 0 });
    res.status(200).json({ success: true, data: accounts, message: "Xóa tài khoản thành công" });
  } catch (error) {
    console.error("Lỗi deleteAccount:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
