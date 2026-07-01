const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const {
  getNotificationSettings,
  updateNotificationSettings,
} = require("../controllers/notificationSetting.controller");

/**
 * @swagger
 * tags:
 *   name: NotificationSettings
 *   description: Notification settings management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationSetting:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique setting ID
 *           example: clx1abc2d0001abcd1234efgh
 *         userId:
 *           type: string
 *           description: ID of the user this setting belongs to
 *           example: clx0xyz1a0000abcd5678ijkl
 *         inApp:
 *           type: boolean
 *           description: Receive in-app notifications
 *           example: true
 *         email:
 *           type: boolean
 *           description: Receive email notifications
 *           example: true
 *         sms:
 *           type: boolean
 *           description: Receive SMS notifications
 *           example: false
 *         frequency:
 *           type: string
 *           enum: [IMMEDIATE, DAILY, WEEKLY]
 *           description: Frequency of grouped notifications
 *           example: IMMEDIATE
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the settings were created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the settings were last updated
 */

/**
 * @swagger
 * /api/v1/notification-settings:
 *   get:
 *     summary: Get notification settings for the authenticated user
 *     description: Returns the notification preferences for the currently logged-in user.
 *     tags: [NotificationSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSetting'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       500:
 *         description: Internal server error
 */
router.get("/", authMiddleware, getNotificationSettings);

/**
 * @swagger
 * /api/v1/notification-settings:
 *   patch:
 *     summary: Update notification settings
 *     description: Updates the notification preferences for the authenticated user.
 *     tags: [NotificationSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inApp:
 *                 type: boolean
 *               email:
 *                 type: boolean
 *               sms:
 *                 type: boolean
 *               frequency:
 *                 type: string
 *                 enum: [IMMEDIATE, DAILY, WEEKLY]
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSetting'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       500:
 *         description: Internal server error
 */
router.patch("/", authMiddleware, updateNotificationSettings);

module.exports = router;
