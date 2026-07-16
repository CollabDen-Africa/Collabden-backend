const { Router } = require("express");
const { getDashboardData, getAdminDashboardData } = require("../controllers/dashboard.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const { adminMiddleware } = require("../../../middleware/admin.middleware");

const router = Router();

/**
 * @swagger
 * /api/v1/dashboard:
 *   get:
 *     summary: Fetch user dashboard data
 *     description: Aggregates active projects and recent notifications for the authenticated user.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", authMiddleware, getDashboardData);

/**
 * @swagger
 * /api/v1/dashboard/admin:
 *   get:
 *     summary: Fetch admin dashboard overview data
 *     description: Aggregates total and active counts for users and projects.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin dashboard data fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/admin", adminMiddleware(), getAdminDashboardData);

module.exports = router;
