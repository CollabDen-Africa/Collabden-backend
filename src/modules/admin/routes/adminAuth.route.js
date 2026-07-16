const express = require('express');
const AdminAuthController = require('../controllers/adminAuthController');
const { adminMiddleware } = require('../../../middleware/admin.middleware');

const router = express.Router();

router.post('/login', AdminAuthController.login);
router.post('/verify-2fa', AdminAuthController.verify2FA);
router.post('/forgot-password', AdminAuthController.forgotPassword);
router.post('/reset-password', AdminAuthController.resetPassword);

// Protected routes (requires any admin role)
router.get('/me', adminMiddleware(), AdminAuthController.me);
router.post('/logout', adminMiddleware(), AdminAuthController.logout);

module.exports = router;
