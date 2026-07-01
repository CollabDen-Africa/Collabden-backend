const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const { subscribeSchema, savePaymentMethodSchema } = require("../../../schemas/subscription.schema");
const {
  getPlans,
  getMySubscription,
  subscribe,
  cancelSubscription,
  reactivateSubscription,
  getBillingHistory,
  getInvoice,
  generateInvoicePDF,
  savePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
} = require("../controllers/subscription.controller");

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription plans, billing history, invoices, and payment methods.
 */



/**
 * @swagger
 * /api/v1/subscriptions/plans:
 *   get:
 *     summary: Get available subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: List of subscription plans
 */
router.get("/plans", getPlans);


router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/subscriptions/me:
 *   get:
 *     summary: Get current user's subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current subscription details
 */
router.get("/me", getMySubscription);

/**
 * @swagger
 * /api/v1/subscriptions/subscribe:
 *   post:
 *     summary: Subscribe to a premium plan or upgrade
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tier
 *               - billingCycle
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [ADVANCE, PRO, ELITE]
 *               billingCycle:
 *                 type: string
 *                 enum: [MONTHLY, ANNUAL]
 *     responses:
 *       200:
 *         description: Successfully subscribed
 */
router.post("/subscribe", validateRequest(subscribeSchema), subscribe);

/**
 * @swagger
 * /api/v1/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription at period end
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription marked for cancellation
 */
router.post("/cancel", cancelSubscription);

/**
 * @swagger
 * /api/v1/subscriptions/reactivate:
 *   post:
 *     summary: Reactivate a pending cancellation
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription reactivated
 */
router.post("/reactivate", reactivateSubscription);

/**
 * @swagger
 * /api/v1/subscriptions/billing/history:
 *   get:
 *     summary: Get billing history (invoices)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Paginated invoices
 */
router.get("/billing/history", getBillingHistory);

/**
 * @swagger
 * /api/v1/subscriptions/billing/invoices/{id}:
 *   get:
 *     summary: Get invoice details
 *     tags: [Subscriptions]
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
 *         description: Invoice details
 */
router.get("/billing/invoices/:id", getInvoice);

/**
 * @swagger
 * /api/v1/subscriptions/billing/invoices/{id}/pdf:
 *   get:
 *     summary: Get invoice data formatted for PDF rendering
 *     tags: [Subscriptions]
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
 *         description: PDF rendering data
 */
router.get("/billing/invoices/:id/pdf", generateInvoicePDF);

/**
 * @swagger
 * /api/v1/subscriptions/payment-methods:
 *   get:
 *     summary: List saved payment methods
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved payment methods
 *   post:
 *     summary: Save a new payment method
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *               last4:
 *                 type: string
 *               brand:
 *                 type: string
 *               expMonth:
 *                 type: integer
 *               expYear:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [CARD, BANK_TRANSFER]
 *     responses:
 *       201:
 *         description: Saved successfully
 */
router.route("/payment-methods")
  .get(listPaymentMethods)
  .post(validateRequest(savePaymentMethodSchema), savePaymentMethod);

/**
 * @swagger
 * /api/v1/subscriptions/payment-methods/{id}/default:
 *   patch:
 *     summary: Set a payment method as default
 *     tags: [Subscriptions]
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
 *         description: Updated successfully
 */
router.patch("/payment-methods/:id/default", setDefaultPaymentMethod);

/**
 * @swagger
 * /api/v1/subscriptions/payment-methods/{id}:
 *   delete:
 *     summary: Remove a saved payment method
 *     tags: [Subscriptions]
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
 *         description: Removed successfully
 */
router.delete("/payment-methods/:id", removePaymentMethod);

module.exports = router;
