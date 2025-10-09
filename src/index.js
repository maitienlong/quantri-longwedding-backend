const express = require('express');
const app = express();
const bodyParser = require('body-parser');
var cors = require('cors')
const mongoose = require('mongoose')
mongoose.Promise = require('bluebird');
require('dotenv').config()

const port = process.env.PORT;

//CONFIG ------------------------------------------------------------------
app.use(express.json())
app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}))

const authRoutes = require("./routes/auth.router");
const khachHangRoutes = require("./routes/khachHang.router");

app.use('/auth', authRoutes);
app.use('/khachHang', khachHangRoutes);
app.get("/", (req, res) => {
  res.send("API is running...");
});

module.exports = app;