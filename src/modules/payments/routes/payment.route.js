const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  initializeFundingSchema,
  addBankAccountSchema,
  requestWithdrawalSchema,
} = require("../../../schemas/payment.schema");
const {
  getWallet,
  getTransactions,
  initializeFunding,
  verifyFunding,
  handleWebhook,
  addBankAccount,
  listBankAccounts,
  removeBankAccount,
  getSupportedBanks,
  requestWithdrawal,
  getWithdrawals,
} = require("../controllers/payment.controller");

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Wallet management, funding, withdrawals, and bank account operations. All amounts in NGN.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Wallet:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz123
 *         balance:
 *           type: number
 *           format: decimal
 *           example: 15000.00
 *         currency:
 *           type: string
 *           example: NGN
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: txn_abc123
 *         userId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [FUNDING, WITHDRAWAL, ESCROW_CREDIT, ESCROW_DEBIT]
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REVERSED]
 *         amount:
 *           type: number
 *           format: decimal
 *           example: 5000.00
 *         balanceBefore:
 *           type: number
 *           format: decimal
 *           example: 10000.00
 *         balanceAfter:
 *           type: number
 *           format: decimal
 *           example: 15000.00
 *         reference:
 *           type: string
 *           example: COLLAB-FUND-abc123
 *         description:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     BankAccount:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: ba_xyz789
 *         bankCode:
 *           type: string
 *           example: "044"
 *         bankName:
 *           type: string
 *           example: Access Bank
 *         accountNumber:
 *           type: string
 *           example: "0690000032"
 *         accountName:
 *           type: string
 *           example: John Doe
 *         isDefault:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     PaymentRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         txRef:
 *           type: string
 *           example: COLLAB-FUND-abc123
 *         flwRef:
 *           type: string
 *           nullable: true
 *         amount:
 *           type: number
 *           format: decimal
 *         currency:
 *           type: string
 *           example: NGN
 *         status:
 *           type: string
 *           example: COMPLETED
 *         type:
 *           type: string
 *           enum: [FUNDING, PAYOUT]
 *         createdAt:
 *           type: string
 *           format: date-time
 */

// ─── Webhook (No auth — uses hash verification) ────────────────────────────

/**
 * @swagger
 * /api/v1/payments/webhook/flutterwave:
 *   post:
 *     summary: Flutterwave webhook endpoint
 *     description: Receives payment and transfer notifications from Flutterwave. Validates via verif-hash header. No JWT authentication required.
 *     tags: [Payments]
 *     parameters:
 *       - in: header
 *         name: verif-hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Flutterwave webhook verification hash
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 example: charge.completed
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature or processing error
 */
router.post("/webhook/flutterwave", handleWebhook);

// ─── All routes below require authentication ────────────────────────────────
router.use(authMiddleware);

// ─── Wallet ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/payments/wallet:
 *   get:
 *     summary: Get wallet balance
 *     description: Returns the authenticated user's wallet balance. Creates a wallet automatically if one does not exist.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Wallet'
 *       401:
 *         description: Unauthorized
 */
router.get("/wallet", getWallet);

/**
 * @swagger
 * /api/v1/payments/transactions:
 *   get:
 *     summary: Get transaction history
 *     description: Returns paginated transaction history for the authenticated user. Supports filtering by type and status.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [FUNDING, WITHDRAWAL, ESCROW_CREDIT, ESCROW_DEBIT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REVERSED]
 *         description: Filter by transaction status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Transaction history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/transactions", getTransactions);

// ─── Funding ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/payments/fund/initialize:
 *   post:
 *     summary: Initialize wallet funding
 *     description: Creates a Flutterwave payment link for funding the user's wallet. The user should be redirected to the returned payment link.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentMethod
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 100
 *                 description: Amount to fund in NGN (minimum ₦100)
 *                 example: 5000
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, banktransfer, ussd]
 *                 description: Preferred payment method
 *                 example: card
 *     responses:
 *       200:
 *         description: Payment initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentLink:
 *                   type: string
 *                   description: Flutterwave checkout URL
 *                   example: https://checkout.flutterwave.com/v3/hosted/pay/xyz123
 *                 txRef:
 *                   type: string
 *                   description: Internal transaction reference
 *                   example: COLLAB-FUND-abc123
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/fund/initialize", validateRequest(initializeFundingSchema), initializeFunding);

/**
 * @swagger
 * /api/v1/payments/fund/verify:
 *   get:
 *     summary: Verify wallet funding payment
 *     description: Verifies a completed Flutterwave payment and credits the user's wallet. Called after Flutterwave redirects back to the application.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Flutterwave transaction ID from the redirect URL
 *     responses:
 *       200:
 *         description: Payment verified and wallet credited
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [SUCCESS, ALREADY_PROCESSED]
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *                 wallet:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                     currency:
 *                       type: string
 *       400:
 *         description: Verification failed
 *       401:
 *         description: Unauthorized
 */
router.get("/fund/verify", verifyFunding);

// ─── Bank Accounts ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/payments/banks:
 *   get:
 *     summary: Get supported banks
 *     description: Returns the list of Nigerian banks supported by Flutterwave for withdrawals.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of supported banks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   code:
 *                     type: string
 *                     example: "044"
 *                   name:
 *                     type: string
 *                     example: Access Bank
 *       401:
 *         description: Unauthorized
 */
router.get("/banks", getSupportedBanks);

/**
 * @swagger
 * /api/v1/payments/bank-accounts:
 *   post:
 *     summary: Add a bank account
 *     description: Registers a new bank account for withdrawals. The account is verified with Flutterwave before saving.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankCode
 *               - accountNumber
 *             properties:
 *               bankCode:
 *                 type: string
 *                 description: Bank code from the supported banks list
 *                 example: "044"
 *               accountNumber:
 *                 type: string
 *                 description: 10-digit bank account number
 *                 example: "0690000032"
 *     responses:
 *       201:
 *         description: Bank account added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BankAccount'
 *       400:
 *         description: Validation error or verification failed
 *       401:
 *         description: Unauthorized
 */
router.post("/bank-accounts", validateRequest(addBankAccountSchema), addBankAccount);

/**
 * @swagger
 * /api/v1/payments/bank-accounts:
 *   get:
 *     summary: List bank accounts
 *     description: Returns all active bank accounts registered by the authenticated user.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BankAccount'
 *       401:
 *         description: Unauthorized
 */
router.get("/bank-accounts", listBankAccounts);

/**
 * @swagger
 * /api/v1/payments/bank-accounts/{id}:
 *   delete:
 *     summary: Remove a bank account
 *     description: Soft-deletes a registered bank account. The account will no longer appear in the user's list.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank account ID
 *     responses:
 *       200:
 *         description: Bank account removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Bank account removed successfully.
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.delete("/bank-accounts/:id", removeBankAccount);

// ─── Withdrawals ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/payments/withdraw:
 *   post:
 *     summary: Request a withdrawal
 *     description: Initiates a withdrawal from the user's wallet to a registered bank account via Flutterwave payout. Minimum withdrawal is ₦1,000.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankAccountId
 *               - amount
 *             properties:
 *               bankAccountId:
 *                 type: string
 *                 description: ID of the registered bank account
 *                 example: ba_xyz789
 *               amount:
 *                 type: number
 *                 minimum: 1000
 *                 description: Amount to withdraw in NGN (minimum ₦1,000)
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Withdrawal request submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reference:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 bankAccount:
 *                   type: object
 *                   properties:
 *                     bankName:
 *                       type: string
 *                     accountNumber:
 *                       type: string
 *                     accountName:
 *                       type: string
 *       400:
 *         description: Insufficient balance or validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/withdraw", validateRequest(requestWithdrawalSchema), requestWithdrawal);

/**
 * @swagger
 * /api/v1/payments/withdrawals:
 *   get:
 *     summary: Get withdrawal history
 *     description: Returns paginated withdrawal history for the authenticated user.
 *     tags: [Payments]
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
 *         description: Withdrawal history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 withdrawals:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PaymentRecord'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/withdrawals", getWithdrawals);

module.exports = router;
