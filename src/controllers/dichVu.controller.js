const { success, error } = require("../utils/response");
const dichVuService = require("../services/dichVu.service.js");

async function create(req, res) {
    try {
        await dichVuService.create(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function update(req, res) {
    try {
        await dichVuService.update(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function remove(req, res) {
    try {
         await dichVuService.remove(req.body, res);
    } catch (e) {
        return error(res, e.message);
    }
}

async function find(req, res) {
    try {
        const dichVu = await dichVuService.find(req.body, res);
        return success(res, dichVu);
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
