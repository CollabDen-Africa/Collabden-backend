const express = require('express');
const AdminAuthController = require('../controllers/adminAuthController');
const { adminMiddleware } = require('../../../middleware/admin.middleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Authenticate an admin using email and password. May require 2FA.
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful or 2FA required
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', AdminAuthController.login);

/**
 * @swagger
 * /api/v1/admin/auth/verify-2fa:
 *   post:
 *     summary: Verify 2FA
 *     description: Verify the 2FA code sent to the admin's email.
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminId:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA verification successful
 *       401:
 *         description: Invalid or expired 2FA code
 */
router.post('/verify-2fa', AdminAuthController.verify2FA);

/**
 * @swagger
 * /api/v1/admin/auth/forgot-password:
 *   post:
 *     summary: Forgot password
 *     description: Send a password reset link to the admin's email.
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset password email sent
 *       400:
 *         description: Admin not found or error occurred
 */
router.post('/forgot-password', AdminAuthController.forgotPassword);

/**
 * @swagger
 * /api/v1/admin/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     description: Reset the admin's password using the token sent to their email.
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired reset token
 */
router.post('/reset-password', AdminAuthController.resetPassword);

// Protected routes (requires any admin role)

/**
 * @swagger
 * /api/v1/admin/auth/me:
 *   get:
 *     summary: Get admin profile
 *     description: Retrieve the authenticated admin's profile.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', adminMiddleware(), AdminAuthController.me);

/**
 * @swagger
 * /api/v1/admin/auth/logout:
 *   post:
 *     summary: Admin logout
 *     description: Logout the authenticated admin.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       400:
 *         description: Error logging out
 */
router.post('/logout', adminMiddleware(), AdminAuthController.logout);

module.exports = router;
