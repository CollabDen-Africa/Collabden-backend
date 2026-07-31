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
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require authentication
router.use(adminMiddleware());

// ──────────────────────────────────────────────
// Platform User Management Routes
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/users/all-users:
 *   get:
 *     summary: Retrieve all platform users
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-users",
    checkPermission(ADMIN_PERMISSIONS.USERS_VIEW),
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
    checkPermission(ADMIN_PERMISSIONS.USERS_VIEW),
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
    checkPermission(ADMIN_PERMISSIONS.USERS_VIEW_ACTIVITY),
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
    checkPermission(ADMIN_PERMISSIONS.USERS_VIEW_REPORTS),
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
    checkPermission(ADMIN_PERMISSIONS.USERS_VIEW_AUDIT),
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
    checkPermission(ADMIN_PERMISSIONS.USERS_VIEW),
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
  checkPermission(ADMIN_PERMISSIONS.USERS_ADD_NOTES),
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
  checkPermission(ADMIN_PERMISSIONS.USERS_MODERATE),
  moderateUserController
);

// ──────────────────────────────────────────────
// Admin User Management Routes (SUPER_ADMIN only)
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create a new admin user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/",
  checkPermission(ADMIN_PERMISSIONS.ADMINS_CREATE),
  createAdminController
);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Retrieve all admin users
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/",
  checkPermission(ADMIN_PERMISSIONS.ADMINS_VIEW),
  getAdminsController
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Retrieve a single admin user by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id",
  checkPermission(ADMIN_PERMISSIONS.ADMINS_VIEW),
  getAdminByIdController
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/role:
 *   put:
 *     summary: Update an admin user's role or status
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id/role",
  checkPermission(ADMIN_PERMISSIONS.ADMINS_UPDATE_ROLE),
  updateAdminController
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/deactivate:
 *   patch:
 *     summary: Deactivate an admin user
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/deactivate",
  checkPermission(ADMIN_PERMISSIONS.ADMINS_DEACTIVATE),
  deactivateAdminController
);

module.exports = router;
