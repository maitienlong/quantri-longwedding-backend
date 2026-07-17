const express = require('express');
const app = express();
const bodyParser = require('body-parser');
var cors = require('cors')
const mongoose = require('mongoose')
const path = require('path');
mongoose.Promise = require('bluebird');
require('dotenv').config()

const port = process.env.PORT;

//CONFIG ------------------------------------------------------------------
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');

// Helmet for security headers (allows cross-origin for images)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Quá nhiều request từ IP này, vui lòng thử lại sau."
});
app.use('/api/', limiter);
app.use('/auth/', limiter);

// Body parser limits (reduced to 2MB)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// CORS configuration
app.use(cors());

// IP Blocking Middleware
const BlockedIP = require('./models/blockedIp.model');
global.blockedIPs = new Set();
// Load blocked IPs into memory
BlockedIP.find({}).then(ips => {
  ips.forEach(ipDoc => global.blockedIPs.add(ipDoc.ip));
  console.log(`Loaded ${global.blockedIPs.size} blocked IPs into memory`);
}).catch(err => console.error("Error loading blocked IPs:", err));

app.use((req, res, next) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip === '::1') ip = '127.0.0.1';
  if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

  if (ip !== '127.0.0.1' && ip !== 'localhost' && global.blockedIPs.has(ip)) {
    return res.status(403).json({ success: false, message: 'Access Denied: Your IP is blocked by the administrator.' });
  }
  next();
});

app.use('/api/images', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require("./routes/auth.router");
const khachHangRoutes = require("./routes/khachHang.router");
const dichVuRoutes = require("./routes/dichVu.router");
const hopDongRoutes = require("./routes/hopDong.router");
const chiTieuRoutes = require("./routes/chiTieu.router");
const lichSoanDoRoutes = require("./routes/lichSoanDo.router");
const websiteRoutes = require("./routes/website.router");
const albumRoutes = require("./routes/album.router");
const logRoutes = require("./routes/log.router");
const accountRoutes = require("./routes/account.router");
const authWebsiteRoutes = require("./routes/authWebsite.router");
const visitorsRoutes = require("./routes/visitors.router");

app.use('/auth', authRoutes);
app.use('/khachHang', khachHangRoutes);
app.use('/dichVu', dichVuRoutes);
app.use('/hopDong', hopDongRoutes);
app.use('/chiTieu', chiTieuRoutes);
app.use('/lichSoanDo', lichSoanDoRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/album', albumRoutes);
app.use('/api/log', logRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/authWebsite', authWebsiteRoutes);
app.use('/api/visitors', visitorsRoutes);
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Global Error Handler (Hides stack traces in production)
app.use((err, req, res, next) => {
  console.error('Error:', err); // Log cho server
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Đã có lỗi xảy ra từ máy chủ, vui lòng thử lại sau.'
      : err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

module.exports = app;