const { success, error } = require("../utils/response");
const trangPhucService = require("../services/trangPhuc.service.js");

async function create(req, res) {
    try {
        await trangPhucService.create(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function update(req, res) {
    try {
        await trangPhucService.update(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function remove(req, res) {
    try {
         await trangPhucService.remove(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function find(req, res) {
    try {
        const trangPhuc = await trangPhucService.find(req.body, res);
        return success(res, trangPhuc);
    } catch (e) {
        return error(res, e.message);
    }
}


module.exports = {
    create,
    update,
    remove,
    find,
};
