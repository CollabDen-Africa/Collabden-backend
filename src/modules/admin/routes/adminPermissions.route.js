const { Router } = require("express");
const {
  getRolePermissionsController,
  getAllRolePermissionsController,
  getAvailablePermissionsController,
  updateRolePermissionsController,
  addPermissionsController,
  removePermissionsController,
  addModulesController,
  removeModulesController,
  deleteRoleConfigController,
  getPermissionChangeHistoryController
} = require("../controllers/adminPermissions.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All permission routes require authentication
router.use(adminMiddleware());

// ──────────────────────────────────────────────
// Retrieve Permissions & Modules
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/permissions/available:
 *   get:
 *     summary: Retrieve all available permission keys and modules (grouped by category)
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available permissions and modules
 */
router.get("/available",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_VIEW),
  getAvailablePermissionsController
);

/**
 * @swagger
 * /api/v1/admin/permissions/history:
 *   get:
 *     summary: Retrieve audit history of permission and module changes
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role (e.g. SUPPORT_ADMIN)
 *     responses:
 *       200:
 *         description: Paginated permission change history
 */
router.get("/history",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_VIEW),
  getPermissionChangeHistoryController
);

/**
 * @swagger
 * /api/v1/admin/permissions:
 *   get:
 *     summary: Retrieve permissions and module access for all roles (with assigned admin counts)
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of role configs with permissions, modules, and assignedAdmins count
 */
router.get("/",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_VIEW),
  getAllRolePermissionsController
);

/**
 * @swagger
 * /api/v1/admin/permissions/{role}:
 *   get:
 *     summary: Retrieve permissions and module access for a specific role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [SUPER_ADMIN, SUPPORT_ADMIN, FINANCE_ADMIN, VERIFICATION_ADMIN, MARKETPLACE_MODERATOR]
 *     responses:
 *       200:
 *         description: Role config with permissions, modules, and assignedAdmins count
 */
router.get("/:role",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_VIEW),
  getRolePermissionsController
);

// ──────────────────────────────────────────────
// Assign / Update Permissions
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/permissions/{role}:
 *   put:
 *     summary: Replace all permissions and modules for a specific role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions, modules]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["users.view", "users.moderate"]
 *               modules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["dashboard", "user_management"]
 *     responses:
 *       200:
 *         description: Role permissions fully updated
 */
router.put("/:role",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_MANAGE),
  updateRolePermissionsController
);

/**
 * @swagger
 * /api/v1/admin/permissions/{role}/permissions/add:
 *   patch:
 *     summary: Add specific permissions to a role (without removing existing ones)
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["users.moderate", "users.add_notes"]
 *     responses:
 *       200:
 *         description: Permissions added to role
 */
router.patch("/:role/permissions/add",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_MANAGE),
  addPermissionsController
);

/**
 * @swagger
 * /api/v1/admin/permissions/{role}/permissions/remove:
 *   patch:
 *     summary: Remove specific permissions from a role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["users.moderate"]
 *     responses:
 *       200:
 *         description: Permissions removed from role
 */
router.patch("/:role/permissions/remove",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_MANAGE),
  removePermissionsController
);

// ──────────────────────────────────────────────
// Module Access Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/permissions/{role}/modules/add:
 *   patch:
 *     summary: Grant module access to a role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modules]
 *             properties:
 *               modules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["dashboard", "user_management", "reports"]
 *     responses:
 *       200:
 *         description: Modules added to role
 */
router.patch("/:role/modules/add",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_MANAGE),
  addModulesController
);

/**
 * @swagger
 * /api/v1/admin/permissions/{role}/modules/remove:
 *   patch:
 *     summary: Revoke module access from a role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modules]
 *             properties:
 *               modules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["finance", "escrow"]
 *     responses:
 *       200:
 *         description: Modules removed from role
 */
router.patch("/:role/modules/remove",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_MANAGE),
  removeModulesController
);

// ──────────────────────────────────────────────
// Delete Role Config
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/permissions/{role}:
 *   delete:
 *     summary: Delete a role's permission config (blocked if admins are assigned)
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role config deleted
 *       409:
 *         description: Cannot delete - admins are assigned this role
 */
router.delete("/:role",
  checkPermission(ADMIN_PERMISSIONS.PERMISSIONS_MANAGE),
  deleteRoleConfigController
);

module.exports = router;
