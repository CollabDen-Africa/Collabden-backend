const express = require("express");
const adminUserController = require("../controllers/adminUserController");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const { createAdminNoteSchema, userModerationSchema } = require("../../../schemas/adminUser.schema");

const router = express.Router();

// Apply adminMiddleware to all endpoints in this file (any logged-in admin user)
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Retrieve list of users
 *     description: Retrieve list of users with filtering, search, and pagination.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by id, email, display name, or first/last name
 *       - in: query
 *         name: accountStatus
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DEACTIVATED, DELETED, SUSPENDED, BANNED, RESTRICTED]
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [APPROVED, UNVERIFIED, PENDING, REJECTED]
 *       - in: query
 *         name: subscriptionPlan
 *         schema:
 *           type: string
 *           enum: [BASIC, ADVANCE, PRO, ELITE]
 *       - in: query
 *         name: openToCollaborate
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: dateJoinedStart
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateJoinedEnd
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/", adminUserController.listUsers);

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   get:
 *     summary: Retrieve user details
 *     description: Get detailed profile of a user.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile details fetched
 *       404:
 *         description: User not found
 */
router.get("/:userId", adminUserController.getUserDetails);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/notes:
 *   post:
 *     summary: Add administrative note
 *     description: Create an admin-only internal note on a user profile.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Note added successfully
 *       404:
 *         description: User not found
 */
router.post(
  "/:userId/notes",
  validateRequest(createAdminNoteSchema),
  adminUserController.createNote
);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/notes:
 *   get:
 *     summary: Get administrative notes
 *     description: Get all internal admin notes for a user profile.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notes fetched successfully
 */
router.get("/:userId/notes", adminUserController.getNotes);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/audit-history:
 *   get:
 *     summary: Get user audit history
 *     description: Retrieve all administrative actions performed on a specific user.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit history fetched successfully
 */
router.get("/:userId/audit-history", adminUserController.getAuditHistory);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/moderate:
 *   post:
 *     summary: Perform user moderation
 *     description: Suspend, restrict, reactivate, or ban a user. Only allowed for SUPER_ADMIN or MARKETPLACE_MODERATOR.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [SUSPEND, RESTRICT, REACTIVATE, BAN]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found
 */
router.post(
  "/:userId/moderate",
  adminMiddleware(["SUPER_ADMIN", "MARKETPLACE_MODERATOR"]),
  validateRequest(userModerationSchema),
  adminUserController.moderateUser
);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/activity:
 *   get:
 *     summary: Get user activity feed
 *     description: Retrieve all user activities (logins, projects, collaborations, verifications, transactions) sorted chronologically.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity feed fetched successfully
 *       404:
 *         description: User not found
 */
router.get("/:userId/activity", adminUserController.getUserActivityFeed);

module.exports = router;
