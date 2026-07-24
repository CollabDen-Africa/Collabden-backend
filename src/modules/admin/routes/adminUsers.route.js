const { Router } = require("express");
const {
  createAdminController,
  getAdminsController,
  getAdminByIdController,
  updateAdminController,
  deactivateAdminController,
  getUsersController,
  getUserByIdController,
  getUserActivityController,
  getUserReportsController,
  getUserAuditHistoryController,
  getUserNotesController,
  addAdminNoteController,
  moderateUserController
} = require("../controllers/adminUsers.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");

const router = Router();

/**
 * @swagger
 * /api/v1/admin/users/all-users:
 *   get:
 *     summary: Retrieve all platform users
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
// Accessible by both ADMIN and SUPER_ADMIN
router.get("/all-users",
    adminMiddleware(["ADMIN", "SUPER_ADMIN"]),
    getUsersController);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}:
 *   get:
 *     summary: Retrieve a single platform user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-users/:id",
    adminMiddleware(),
    getUserByIdController);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}/activity:
 *   get:
 *     summary: Retrieve a user's activity log by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-users/:id/activity",
    adminMiddleware(),
    getUserActivityController);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}/reports:
 *   get:
 *     summary: Retrieve reports against a user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-users/:id/reports",
    adminMiddleware(),
    getUserReportsController);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}/audit-history:
 *   get:
 *     summary: Retrieve audit history for a user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-users/:id/audit-history",
    adminMiddleware(),
    getUserAuditHistoryController);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}/notes:
 *   get:
 *     summary: Retrieve admin notes for a user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-users/:id/notes",
    adminMiddleware(),
    getUserNotesController);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}/notes:
 *   post:
 *     summary: Add an admin note for a user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/all-users/:id/notes",
  adminMiddleware(["SUPER_ADMIN", "ADMIN", "MODERATOR"]),
  addAdminNoteController
);

/**
 * @swagger
 * /api/v1/admin/users/all-users/{id}/moderate:
 *   post:
 *     summary: Moderate a user (suspend, restrict, ban, reactivate)
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/all-users/:id/moderate",
  adminMiddleware(),
  moderateUserController
);

// Only SUPER_ADMIN is allowed to manage other admins
router.use(adminMiddleware(["SUPER_ADMIN"]));

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create a new admin user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", createAdminController);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Retrieve all admin users
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", getAdminsController);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Retrieve a single admin user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", getAdminByIdController);

/**
 * @swagger
 * /api/v1/admin/users/{id}/role:
 *   put:
 *     summary: Update an admin user's role or status
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id/role", updateAdminController);

/**
 * @swagger
 * /api/v1/admin/users/{id}/deactivate:
 *   patch:
 *     summary: Deactivate an admin user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/deactivate", deactivateAdminController);

module.exports = router;
