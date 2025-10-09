const { success, error } = require("../utils/response");
const khachHangService = require("../services/khachHang.service");

async function taoKhachHang(req, res) {
    try {
        const khachHang = await khachHangService.taoKhachHang(req.body);
        return success(res, khachHang);
    } catch (e) {
        return error(res, e.message);
    }
}

async function listAll(req, res) {
    try {
        const khachHang = await khachHangService.listAll(req.body);
        return success(res, khachHang);
    } catch (e) {
        return error(res, e.message);
    }
}

async function findOne(req, res) {
    try {
        const khachHang = await khachHangService.findOne(req.body);
        return success(res, khachHang);
    } catch (e) {
        return error(res, e.message);
    }
}


module.exports = {
    taoKhachHang,
    listAll,
    findOne
};
