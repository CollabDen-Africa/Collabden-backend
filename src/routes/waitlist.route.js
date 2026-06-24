const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlist.controller');
const { authMiddleware } = require("../middleware/auth.middleware");
const { adminMiddleware } = require("../middleware/admin.middleware");

/**
 * @swagger
 * tags:
 *   name: Waitlist
 *   description: API endpoints for managing the early access waitlist
 */

/**
 * @swagger
 * /api/v1/waitlist:
 *   post:
 *     summary: Join the waitlist
 *     description: Adds a new user's email to the waitlist.
 *     tags: [Waitlist]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               name:
 *                 type: string
 *                 example: John Doe
 *               phoneNumber:
 *                 type: string
 *                 example: +1234567890
 *     responses:
 *       201:
 *         description: Successfully joined the waitlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully joined the waitlist!
 *                 entry:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request (missing/invalid email, or already on the waitlist)
 *       500:
 *         description: Internal server error
 */
router.post("/", waitlistController.joinWaitlist);

/**
 * @swagger
 * /api/v1/waitlist:
 *   get:
 *     summary: Retrieve all waitlist entries (Admin Only)
 *     description: Returns a paginated list of all waitlist entries. Supports optional search by name or email. Requires Admin privileges.
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of entries per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter entries by name or email (case-insensitive)
 *     responses:
 *       200:
 *         description: Paginated list of waitlist entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  waitlistController.getWaitlist
);

/**
 * @swagger
 * /api/v1/waitlist/download:
 *   get:
 *     summary: Download waitlist as Excel (Admin Only)
 *     description: Generates and downloads an Excel file containing all waitlist entries. Requires Admin privileges.
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file containing the waitlist
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 *       500:
 *         description: Internal server error
 */
router.get(
  "/download",
  authMiddleware,
  adminMiddleware,
  waitlistController.downloadWaitlist
);

module.exports = router;
