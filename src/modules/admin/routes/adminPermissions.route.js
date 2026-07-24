const { Router } = require("express");
const {
  getRolePermissionsController,
  getAllRolePermissionsController,
  updateRolePermissionsController
} = require("../controllers/adminPermissions.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");

const router = Router();

// Only SUPER_ADMIN is allowed to manage permissions
router.use(adminMiddleware(["SUPER_ADMIN"]));

/**
 * @swagger
 * /api/v1/admin/permissions:
 *   get:
 *     summary: Retrieve permissions for all roles
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", getAllRolePermissionsController);

/**
 * @swagger
 * /api/v1/admin/permissions/{role}:
 *   get:
 *     summary: Retrieve permissions for a specific role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:role", getRolePermissionsController);

/**
 * @swagger
 * /api/v1/admin/permissions/{role}:
 *   put:
 *     summary: Update permissions and module access for a specific role
 *     tags: [Admin Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:role", updateRolePermissionsController);

module.exports = router;
