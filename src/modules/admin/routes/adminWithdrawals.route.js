const { Router } = require("express");
const {
  getWithdrawalsController,
  getWithdrawalByIdController,
  getSubscriptionPaymentsController,
  getSubscriptionPaymentByIdController,
} = require("../controllers/adminWithdrawals.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/finance/withdrawals:
 *   get:
 *     summary: Retrieve withdrawal requests and processing status
 *     tags: [Admin Management - Withdrawals & Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by ID, reference, or user details
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)
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
 *         description: Withdrawal requests fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/withdrawals",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getWithdrawalsController
);

/**
 * @swagger
 * /api/v1/admin/finance/withdrawals/{id}:
 *   get:
 *     summary: Retrieve details of a specific withdrawal request
 *     tags: [Admin Management - Withdrawals & Subscriptions]
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
 *         description: Withdrawal request details fetched successfully
 *       404:
 *         description: Withdrawal request not found
 */
router.get(
  "/withdrawals/:id",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getWithdrawalByIdController
);

/**
 * @swagger
 * /api/v1/admin/finance/subscription-payments:
 *   get:
 *     summary: Retrieve subscription payment records, including upgrades, renewals, and cancellations
 *     tags: [Admin Management - Withdrawals & Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by invoice ID, invoice number, or user details
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by invoice status (PAID, PENDING, FAILED, VOID)
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *         description: Filter by tier (BASIC, ADVANCE, PRO, ELITE)
 *       - in: query
 *         name: billingCycle
 *         schema:
 *           type: string
 *         description: Filter by billing cycle (MONTHLY, ANNUAL)
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
 *         description: Subscription payment records fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/subscription-payments",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getSubscriptionPaymentsController
);

/**
 * @swagger
 * /api/v1/admin/finance/subscription-payments/{id}:
 *   get:
 *     summary: Retrieve details of a specific subscription payment record / invoice
 *     tags: [Admin Management - Withdrawals & Subscriptions]
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
 *         description: Subscription payment record details fetched successfully
 *       404:
 *         description: Record not found
 */
router.get(
  "/subscription-payments/:id",
  checkPermission(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  getSubscriptionPaymentByIdController
);

module.exports = router;
