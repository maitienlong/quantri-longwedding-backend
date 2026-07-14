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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors())
app.use('/api/images', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}))

const authRoutes = require("./routes/auth.router");
const khachHangRoutes = require("./routes/khachHang.router");
const dichVuRoutes = require("./routes/dichVu.router");
const hopDongRoutes = require("./routes/hopDong.router");
const chiTieuRoutes = require("./routes/chiTieu.router");
const lichSoanDoRoutes = require("./routes/lichSoanDo.router");
const websiteRoutes = require("./routes/website.router");

app.use('/auth', authRoutes);
app.use('/khachHang', khachHangRoutes);
app.use('/dichVu', dichVuRoutes);
app.use('/hopDong', hopDongRoutes);
app.use('/chiTieu', chiTieuRoutes);
app.use('/lichSoanDo', lichSoanDoRoutes);
app.use('/api/website', websiteRoutes);
app.get("/", (req, res) => {
  res.send("API is running...");
});

module.exports = app;