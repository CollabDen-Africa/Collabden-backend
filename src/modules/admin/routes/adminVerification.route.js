const { Router } = require("express");
const {
  getVerificationRequestsController,
  getVerificationDetailsController,
  processVerificationDecisionController,
  getUserVerificationHistoryController,
  getVerificationAuditHistoryController,
} = require("../controllers/adminVerification.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  verificationDecisionSchema,
} = require("../../../schemas/adminVerification.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All admin verification routes require authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/verification:
 *   get:
 *     summary: Retrieve user verification requests with search, filtering, sorting, and pagination
 *     tags: [Admin Management - Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user name, user ID, or verification status
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [All, PENDING, APPROVED, REJECTED, EXPIRED, INCOMPLETE]
 *         description: Filter by verification status
 *       - in: query
 *         name: verificationType
 *         schema:
 *           type: string
 *         description: Filter by verification document type
 *       - in: query
 *         name: submissionDateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter requests submitted on or after date
 *       - in: query
 *         name: submissionDateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter requests submitted on or before date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
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
 *         description: Verification requests retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get(
  "/",
  checkPermission(ADMIN_PERMISSIONS.VERIFICATION_VIEW),
  getVerificationRequestsController
);

/**
 * @swagger
 * /api/v1/admin/verification/audit:
 *   get:
 *     summary: View verification-related administrative audit history (read-only)
 *     tags: [Admin Management - Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Verification audit history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/audit",
  checkPermission(ADMIN_PERMISSIONS.VERIFICATION_VIEW),
  getVerificationAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/verification/user/{userId}/history:
 *   get:
 *     summary: Retrieve complete verification history for a specific user
 *     tags: [Admin Management - Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
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
 *         description: User verification history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/user/:userId/history",
  checkPermission(ADMIN_PERMISSIONS.VERIFICATION_VIEW),
  getUserVerificationHistoryController
);

/**
 * @swagger
 * /api/v1/admin/verification/{id}:
 *   get:
 *     summary: Retrieve full verification details including identity documents, user profile, and previous attempts
 *     tags: [Admin Management - Verification]
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
 *         description: Verification details retrieved successfully
 *       404:
 *         description: Verification request not found
 */
router.get(
  "/:id",
  checkPermission(ADMIN_PERMISSIONS.VERIFICATION_VIEW),
  getVerificationDetailsController
);

/**
 * @swagger
 * /api/v1/admin/verification/{id}/decision:
 *   post:
 *     summary: Approve or reject a user verification request with rejection reason validation, user notification, and decision audit logging
 *     tags: [Admin Management - Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               rejectionReason:
 *                 type: string
 *                 description: Required when status is REJECTED
 *     responses:
 *       200:
 *         description: Verification decision processed successfully
 *       400:
 *         description: Validation failed (e.g. missing rejection reason on REJECTED)
 *       403:
 *         description: Forbidden - Requires VERIFICATION_MANAGE permission
 *       404:
 *         description: Verification request not found
 */
router.post(
  "/:id/decision",
  checkPermission(ADMIN_PERMISSIONS.VERIFICATION_MANAGE),
  validateRequest(verificationDecisionSchema),
  processVerificationDecisionController
);

module.exports = router;
