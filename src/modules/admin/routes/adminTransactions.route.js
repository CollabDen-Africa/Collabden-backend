const { Router } = require("express");
const {
  getTransactionsController,
  getTransactionByIdController,
} = require("../controllers/adminTransactions.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/transactions:
 *   get:
 *     summary: Retrieve all payment transactions across the platform
 *     tags: [Admin Management - Payments & Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by transaction ID, reference, description, or user details
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by type (FUNDING, WITHDRAWAL, ESCROW_CREDIT, ESCROW_DEBIT)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (PENDING, COMPLETED, FAILED, REVERSED)
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
 *         description: Payment transactions retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getTransactionsController
);

/**
 * @swagger
 * /api/v1/admin/transactions/{id}:
 *   get:
 *     summary: Retrieve details of a specific payment transaction by ID
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
 *         description: Transaction details retrieved successfully
 *       404:
 *         description: Transaction not found
 */
router.get(
  "/:id",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getTransactionByIdController
);

module.exports = router;
