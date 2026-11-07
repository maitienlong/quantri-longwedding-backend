const express = require('express');
const app = express();
var cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const port = process.env.PORT;

//CONFIG ------------------------------------------------------------------
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// Helmet for security headers (allows cross-origin for images)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Rate limiting (1500 requests per 15 minutes to allow polling & dashboard operations)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: "Quá nhiều request từ IP này, vui lòng thử lại sau."
});
app.use(['/api/', '/auth/', '/hopDong', '/khachHang', '/dichVu', '/chiTieu', '/lichSoanDo', '/trangPhuc', '/vouchers', '/leads', '/baoCao'], limiter);

// Body parser limits (cho phép gửi payload ảnh dung lượng lớn)
app.use(express.json({
  limit: "100mb",
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Express 5 compatible NoSQL Injection Sanitizer (req.query is getter-only in Express 5)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

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
const thiepCuoiRoutes = require("./routes/thiepCuoi.router");
const albumRoutes = require("./routes/album.router");
const logRoutes = require("./routes/log.router");
const visitorsRoutes = require("./routes/visitors.router");
const loaiHopDongRoutes = require("./routes/loaiHopDong.router");
const loaiDichVuRoutes = require("./routes/loaiDichVu.router");
const thiduaRoutes = require("./routes/thidua.router");
const sepayRoutes = require("./routes/sepay.router");
const baoCaoRoutes = require("./routes/baoCao.router");
const donViNhanTienRoutes = require("./routes/donViNhanTien.router");
const voucherRoutes = require("./routes/voucher.router");
const trangPhucRoutes = require("./routes/trangPhuc.router");
const leadRoutes = require("./routes/lead.router");
const bookingRoutes = require("./routes/booking.router");
const wardrobeRoutes = require("./routes/wardrobe.router");
const taskRoutes = require("./routes/task.router");
const printDeliverableRoutes = require("./routes/printDeliverable.router");
const financialLedgerRoutes = require("./routes/financialLedger.router");

app.use('/auth', authRoutes);
app.use('/khachHang', khachHangRoutes);
app.use('/api/khach-hang', khachHangRoutes);
app.use('/api/khachHang', khachHangRoutes);
app.use('/dichVu', dichVuRoutes);
app.use('/hopDong', hopDongRoutes);
app.use('/chiTieu', chiTieuRoutes);
app.use('/lichSoanDo', lichSoanDoRoutes);
app.use('/loaiHopDong', loaiHopDongRoutes);
app.use('/loaiDichVu', loaiDichVuRoutes);
app.use('/api/loai-dich-vu', loaiDichVuRoutes);
app.use('/donViNhanTien', donViNhanTienRoutes);
app.use('/api/don-vi-nhan-tien', donViNhanTienRoutes);
app.use('/api/thi-dua', thiduaRoutes);
app.use('/api/sepay', sepayRoutes);
app.use('/api/bao-cao', baoCaoRoutes);
app.use('/baoCao', baoCaoRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/thiep-cuoi', thiepCuoiRoutes);
app.use('/thiep-cuoi', thiepCuoiRoutes);
const thiepCuoiService = require("./services/thiepCuoi.service");
app.get(['/t/:id', '/t/:id/:guestSlug', '/moi/:id', '/moi/:id/:guestSlug', '/p/:id', '/p/:id/:guestSlug', '/thiep/:id', '/thiep/:id/:guestSlug'], thiepCuoiService.getInvitationShareSeo);
app.use('/api/album', albumRoutes);
app.use('/api/v2/albums', albumRoutes);
app.use('/api/v2/portal/albums', albumRoutes);
app.use('/api/log', logRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/vouchers', voucherRoutes);
app.use('/api/trang-phuc', trangPhucRoutes);
app.use('/trangPhuc', trangPhucRoutes);
app.use('/api/leads', leadRoutes);
app.use('/leads', leadRoutes);
app.use('/api/v2/bookings', bookingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/v2/wardrobe', wardrobeRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/v2/tasks', taskRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/v2/notifications', taskRoutes);
app.use('/api/v2/print-deliverables', printDeliverableRoutes);
app.use('/api/print-deliverables', printDeliverableRoutes);
app.use('/api/v2/finance', financialLedgerRoutes);
app.use('/api/finance', financialLedgerRoutes);

app.get("/", (req, res) => {
  res.send("API is running... " + process.env.VERSION);
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
