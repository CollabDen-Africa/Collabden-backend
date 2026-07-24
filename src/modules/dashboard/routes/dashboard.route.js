const { Router } = require("express");
const {
  getDashboardData,
  getUserActiveProjects,
  getUserNotifications,
  getAdminDashboardData,
  getAdminUserStats,
  getAdminProjectStats,
  getAdminPendingStats,
  getRecentActivities,
  getPendingActions,
} = require("../controllers/dashboard.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const { adminMiddleware } = require("../../../middleware/admin.middleware");

const router = Router();

/**
 * @swagger
 * /api/v1/dashboard/projects:
 *   get:
 *     summary: Fetch user active projects widget data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/projects", authMiddleware, getUserActiveProjects);

/**
 * @swagger
 * /api/v1/dashboard/notifications:
 *   get:
 *     summary: Fetch user notifications widget data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/notifications", authMiddleware, getUserNotifications);

/**
 * @swagger
 * /api/v1/dashboard:
 *   get:
 *     summary: (Legacy) Fetch user dashboard data
 *     description: Aggregates active projects and recent notifications. Deprecated in favor of individual widget endpoints.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", authMiddleware, getDashboardData);


// ADMIN DASHBOARD ROUTES


/**
 * @swagger
 * /api/v1/dashboard/admin/stats/users:
 *   get:
 *     summary: Fetch admin user statistics widget data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/admin/stats/users", adminMiddleware(), getAdminUserStats);

/**
 * @swagger
 * /api/v1/dashboard/admin/stats/projects:
 *   get:
 *     summary: Fetch admin project statistics widget data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/admin/stats/projects", adminMiddleware(), getAdminProjectStats);

/**
 * @swagger
 * /api/v1/dashboard/admin/stats/pending:
 *   get:
 *     summary: Fetch admin pending actions counts widget data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/admin/stats/pending", adminMiddleware(), getAdminPendingStats);

/**
 * @swagger
 * /api/v1/dashboard/admin:
 *   get:
 *     summary: (Legacy) Fetch admin dashboard overview data
 *     description: Aggregates total and active counts. Deprecated in favor of individual widget endpoints.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/admin", adminMiddleware(), getAdminDashboardData);

/**
 * @swagger
 * /api/v1/dashboard/admin/activities:
 *   get:
 *     summary: Fetch recent platform activities
 *     description: Returns recent audit logs. Limit can be provided as a query parameter.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/admin/activities", adminMiddleware(["SUPER_ADMIN"]), getRecentActivities);

/**
 * @swagger
 * /api/v1/dashboard/admin/pending-actions:
 *   get:
 *     summary: Fetch pending administrative actions
 *     description: Returns pending administrative actions customized by the admin's role.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/admin/pending-actions", adminMiddleware(), getPendingActions);

module.exports = router;
