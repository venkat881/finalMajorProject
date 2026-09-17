const express = require('express');
const router = express.Router();
const { register, login, adminLogin, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/admin/login', adminLogin);
router.get('/auth/me', authenticate, me);

module.exports = router;
