const { Router } = require("express");
const {
  generatePaymentReportController,
  getPaymentAuditHistoryController,
} = require("../controllers/adminPaymentReports.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/payments/reports:
 *   get:
 *     summary: Generate filtered payment reports for administrative review and financial tracking
 *     tags: [Admin Management - Payment Reports & Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateStart
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transactions starting from this date
 *       - in: query
 *         name: dateEnd
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transactions up to this date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by transaction type (FUNDING, WITHDRAWAL, ESCROW_CREDIT, ESCROW_DEBIT)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by transaction status (PENDING, COMPLETED, FAILED, REVERSED)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Payment report generated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/reports",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  generatePaymentReportController
);

/**
 * @swagger
 * /api/v1/admin/payments/audit:
 *   get:
 *     summary: Retrieve read-only audit log history for payment and escrow administrative actions
 *     tags: [Admin Management - Payment Reports & Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by action or administrator email
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: string
 *         description: Filter audit records by administrator ID
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
 *         description: Audit log records retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/audit",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getPaymentAuditHistoryController
);

module.exports = router;
