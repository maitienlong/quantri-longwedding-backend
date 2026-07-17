const express = require('express');
const router = express.Router();
const authWebsiteService = require('../services/authWebsite.service');

router.post('/login', authWebsiteService.login);

module.exports = router;
