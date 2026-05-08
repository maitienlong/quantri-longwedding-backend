const { success, error } = require("../utils/response");
const userService = require("../services/user.service");

async function createUser(req, res) {
    try { 
        const user = await userService.createUser(req.body);
        return success(res, user);
    } catch (e) {
        return error(res, e.message);
    }
}

async function loginUser(req, res) {
   try { 
        const user = await userService.loginUser(res, req.body);
        return success(res, user);
    } catch (e) {
        return error(res, e.message);
    }
}

async function getListUser(req, res) {

}

module.exports = {
    createUser,
    loginUser,
    getListUser
};
