const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notification.controller");

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique notification ID
 *           example: clx1abc2d0001abcd1234efgh
 *         userId:
 *           type: string
 *           description: ID of the user this notification belongs to
 *           example: clx0xyz1a0000abcd5678ijkl
 *         title:
 *           type: string
 *           description: Notification title
 *           example: Project Created
 *         message:
 *           type: string
 *           description: Notification message body
 *           example: Your project "My App" has been created successfully.
 *         type:
 *           type: string
 *           enum: [INVITE, SYSTEM, PROJECT_CREATED, TASK_ASSIGNED, MESSAGE]
 *           description: Type of notification
 *           example: PROJECT_CREATED
 *         isRead:
 *           type: boolean
 *           description: Whether the notification has been read
 *           example: false
 *         link:
 *           type: string
 *           nullable: true
 *           description: Optional URL to navigate to
 *           example: /projects/clx1abc2d0001abcd1234efgh
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the notification was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the notification was last updated
 */

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get all notifications for the authenticated user
 *     description: Returns all notifications for the currently logged-in user, ordered by most recent first.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No token, unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */
router.get("/", authMiddleware, getNotifications);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Marks all unread notifications for the authenticated user as read.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: All notifications marked as read
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No token, unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */
router.patch("/read-all", authMiddleware, markAllNotificationsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     description: Marks a specific notification as read by its ID.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The notification ID to mark as read
 *         schema:
 *           type: string
 *           example: clx1abc2d0001abcd1234efgh
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification marked as read
 *                 notification:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No token, unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */
router.patch("/:id/read", authMiddleware, markNotificationRead);

module.exports = router;

