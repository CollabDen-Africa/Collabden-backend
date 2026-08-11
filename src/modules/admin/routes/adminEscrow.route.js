const { Router } = require("express");
const {
  getEscrowsController,
  getEscrowByIdController,
} = require("../controllers/adminEscrow.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/escrow:
 *   get:
 *     summary: Retrieve escrow records across all projects with search, filtering, and pagination
 *     tags: [Admin Management - Payments & Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by project name, escrow ID, funding reference, or user email/name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (PENDING_FUNDING, FUNDED, LOCKED, COMPLETED)
 *       - in: query
 *         name: dateStart
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateEnd
 *         schema:
 *           type: string
 *           format: date
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
 *         description: Escrow records fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/",
  checkPermission(ADMIN_PERMISSIONS.ESCROW_VIEW),
  getEscrowsController
);

/**
 * @swagger
 * /api/v1/admin/escrow/{id}:
 *   get:
 *     summary: Retrieve complete details for an escrow record by Escrow ID or Project ID
 *     tags: [Admin Management - Payments & Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Escrow details fetched successfully
 *       404:
 *         description: Escrow record not found
 */
router.get(
  "/:id",
  checkPermission(ADMIN_PERMISSIONS.ESCROW_VIEW),
  getEscrowByIdController
);

module.exports = router;
