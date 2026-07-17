const jwt = require('jsonwebtoken');
const Account = require('../models/account.model');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  
  // 1. Check Root Account (from .env)
  const rootUser = process.env.WEBSITE_ADMIN_USER || 'admin_website';
  const rootPass = process.env.WEBSITE_ADMIN_PASS || 'longwedding2025';

  let isValid = false;

  if (username === rootUser && password === rootPass) {
    isValid = true;
  } else {
    // 2. Check Database Accounts
    const dbAccount = await Account.findOne({ username });
    if (dbAccount) {
      isValid = await bcrypt.compare(password, dbAccount.password);
    }
  }

  if (isValid) {
    const token = jwt.sign(
      { username: username, role: 'website_admin' },
      process.env.JWT_SECRET || 'longwedding_website_secret_key_2025',
      { expiresIn: '24h' }
    );
    return res.status(200).json({ success: true, token, message: "Đăng nhập thành công" });
  }

  return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không đúng" });
};
