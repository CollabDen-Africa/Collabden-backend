const { Router } = require("express");
const { getDashboardData } = require("../controllers/dashboard.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");

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

module.exports = router;
