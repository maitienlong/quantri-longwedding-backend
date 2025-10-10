const { success, error } = require("../utils/response.js");
const hopDongService = require("../services/hopDong.service.js");

async function taoHDCuoi(req, res) {
    try {
        await hopDongService.taoHDCuoi(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function capNhatHDCuoi(req, res) {
    try {
        await hopDongService.capNhatHDCuoi(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function thanhToanHDCuoi(req, res) {
    try {
        await hopDongService.thanhToanHDCuoi(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function xoaHDCUoi(req, res) {
    try {
        const hopDong = await hopDongService.xoaHDCUoi(req.body, res);
        return success(res, hopDong);
    } catch (e) {
        return error(res, e.message);
    }
}

async function findAllHDCuoi(req, res) {
    try {
        const hopDong = await hopDongService.findAllHDCuoi(req.body, res);
        return success(res, hopDong);
    } catch (e) {
        return error(res, e.message);
    }
}


async function taoHD(req, res) {
    try {
        await hopDongService.createCuoi(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function capNhatHD(req, res) {
    try {
        await hopDongService.update(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function thanhToanHD(req, res) {
    try {
        await hopDongService.remove(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function xoaHD(req, res) {
    try {
        const hopDong = await hopDongService.findAll(req.body, res);
        return success(res, hopDong);
    } catch (e) {
        return error(res, e.message);
    }
}

async function findAllHD(req, res) {
    try {
        const hopDong = await hopDongService.findAll(req.body, res);
        return success(res, hopDong);
    } catch (e) {
        return error(res, e.message);
    }
}



module.exports = {
    taoHDCuoi,
    capNhatHDCuoi,
    thanhToanHDCuoi,
    xoaHDCUoi,
    findAllHDCuoi,
    taoHD,
    capNhatHD,
    thanhToanHD,
    xoaHD,
    findAllHD
};
