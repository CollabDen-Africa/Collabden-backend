const { Router } = require("express");
const securityController = require("../controllers/security.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");

const router = Router();

// Require auth for all these endpoints
router.use(authMiddleware);

// 2FA Setup
/**
 * @swagger
 * /api/v1/user/security/2fa/setup:
 *   post:
 *     summary: Generate 2FA secret and QR code
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup details including secret and QR code URL
 *       401:
 *         description: Unauthorized
 */
router.post("/2fa/setup", securityController.setup2FA);

/**
 * @swagger
 * /api/v1/user/security/2fa/verify:
 *   post:
 *     summary: Verify 2FA token and enable 2FA
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA successfully enabled
 *       400:
 *         description: Invalid 2FA code
 *       401:
 *         description: Unauthorized
 */
router.post("/2fa/verify", securityController.verify2FASetup);

// Device management
/**
 * @swagger
 * /api/v1/user/security/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out from all devices
 *       401:
 *         description: Unauthorized
 */
router.post("/logout-all", securityController.logoutAllDevices);

// Account management
/**
 * @swagger
 * /api/v1/user/security/deactivate:
 *   post:
 *     summary: Deactivate user account
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account successfully deactivated
 *       401:
 *         description: Unauthorized
 */
router.post("/deactivate", securityController.deactivateAccount);

/**
 * @swagger
 * /api/v1/user/security/delete:
 *   delete:
 *     summary: Delete user account
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account marked for deletion
 *       401:
 *         description: Unauthorized
 */
router.delete("/delete", securityController.deleteAccount);

// Data export
/**
 * @swagger
 * /api/v1/user/security/data-export:
 *   post:
 *     summary: Request user data export
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data export requested
 *       401:
 *         description: Unauthorized
 */
router.post("/data-export", securityController.requestDataExport);

/**
 * @swagger
 * /api/v1/user/security/data-export/{id}:
 *   get:
 *     summary: Check user data export status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Data export request ID
 *     responses:
 *       200:
 *         description: Status of the export request
 *       404:
 *         description: Request not found
 *       401:
 *         description: Unauthorized
 */
router.get("/data-export/:id", securityController.checkDataExportStatus);

// Support
/**
 * @swagger
 * /api/v1/user/security/support-request:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Support ticket created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/support-request", securityController.createSupportTicket);

module.exports = router;
