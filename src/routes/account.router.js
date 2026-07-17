const express = require('express');
const router = express.Router();
const accountService = require('../services/account.service');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware, accountService.getAccounts);
router.post('/', authMiddleware, accountService.createAccount);
router.put('/:id', authMiddleware, accountService.updateAccount);
router.delete('/:id', authMiddleware, accountService.deleteAccount);

module.exports = router;
