const { Router } = require("express");
const {
  getDisputesController,
  getDisputeByIdController,
  assignDisputeController,
  updateDisputeStatusController,
  addDisputeNoteController,
  getDisputeNotesController,
  sendDisputeMessageController,
  getDisputeMessagesController,
  requestDisputeEvidenceController,
  getDisputeEvidenceRequestsController,
  recordDisputeDecisionController,
  getDisputeAuditLogsController,
} = require("../controllers/adminDisputes.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  updateDisputeStatusSchema,
  assignDisputeSchema,
  createDisputeNoteSchema,
  createDisputeMessageSchema,
  requestEvidenceSchema,
  createDisputeDecisionSchema,
} = require("../../../schemas/adminDisputes.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/disputes:
 *   get:
 *     summary: Retrieve all disputes submitted on the platform with search, filter, sorting, pagination, and summary counts
 *     tags: [Admin Management - Payment & Platform Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by dispute ID, reason, description, user name/email, project name, or transaction ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, UNDER_REVIEW, AWAITING_RESPONSE, RESOLVED, CLOSED, All]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [PAYMENT, ESCROW_MILESTONE, AGREEMENT_RELATED, PROJECT_COLLABORATION, USER_CONDUCT, All]
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
 *         name: assignedAdminId
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
 *         description: Disputes and summary stats fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_VIEW),
  getDisputesController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}:
 *   get:
 *     summary: Retrieve comprehensive dispute details, involved users, project, payments, agreements, evidence, activity, and investigation notes
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *         description: Dispute details fetched successfully
 *       404:
 *         description: Dispute not found
 */
router.get(
  "/:id",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_VIEW),
  getDisputeByIdController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/assign:
 *   patch:
 *     summary: Assign or reassign a dispute to an administrator or team
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *             properties:
 *               adminId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Dispute assigned successfully
 *       404:
 *         description: Dispute or administrator not found
 */
router.patch(
  "/:id/assign",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(assignDisputeSchema),
  assignDisputeController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/status:
 *   patch:
 *     summary: Update dispute status and record timestamp and admin attribution
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *                 enum: [OPEN, UNDER_REVIEW, AWAITING_RESPONSE, RESOLVED, CLOSED]
 *     responses:
 *       200:
 *         description: Dispute status updated successfully
 *       400:
 *         description: Validation failed or dispute finalized
 *       404:
 *         description: Dispute not found
 */
router.patch(
  "/:id/status",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(updateDisputeStatusSchema),
  updateDisputeStatusController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/notes:
 *   get:
 *     summary: Retrieve internal administrative investigation notes for a dispute
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *         description: Internal notes fetched successfully
 */
router.get(
  "/:id/notes",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_VIEW),
  getDisputeNotesController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/notes:
 *   post:
 *     summary: Add an internal administrative note to a dispute
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Note added successfully
 */
router.post(
  "/:id/notes",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(createDisputeNoteSchema),
  addDisputeNoteController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/messages:
 *   get:
 *     summary: Retrieve communication history for a dispute
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *         description: Dispute messages fetched successfully
 */
router.get(
  "/:id/messages",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_VIEW),
  getDisputeMessagesController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/messages:
 *   post:
 *     summary: Send communication to users involved in dispute or internal dispute thread
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *               isInternal:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Dispute message sent successfully
 */
router.post(
  "/:id/messages",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(createDisputeMessageSchema),
  sendDisputeMessageController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/evidence-requests:
 *   get:
 *     summary: Retrieve evidence requests submitted for a dispute
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *         description: Evidence requests fetched successfully
 */
router.get(
  "/:id/evidence-requests",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_VIEW),
  getDisputeEvidenceRequestsController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/request-evidence:
 *   post:
 *     summary: Request additional information or evidence from an involved user
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *               - requestedFrom
 *               - requestDetails
 *             properties:
 *               requestedFrom:
 *                 type: string
 *               requestDetails:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Evidence requested successfully
 */
router.post(
  "/:id/request-evidence",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(requestEvidenceSchema),
  requestDisputeEvidenceController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/decision:
 *   post:
 *     summary: Record final dispute decision and finalize dispute as read-only record
 *     tags: [Admin Management - Payment & Platform Disputes]
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
 *               - resolutionSummary
 *               - outcome
 *             properties:
 *               resolutionSummary:
 *                 type: string
 *               outcome:
 *                 type: string
 *               supportingNotes:
 *                 type: string
 *               financialAdjustment:
 *                 type: object
 *     responses:
 *       201:
 *         description: Dispute decision recorded and finalized successfully
 *       400:
 *         description: Dispute already finalized or validation failed
 */
router.post(
  "/:id/decision",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(createDisputeDecisionSchema),
  recordDisputeDecisionController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/audit-logs:
 *   get:
 *     summary: Retrieve complete dispute activity and audit history in chronological order
 *     tags: [Admin Management - Payment & Platform Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
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
 *         description: Audit history fetched successfully
 */
router.get(
  "/:id/audit-logs",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_VIEW),
  getDisputeAuditLogsController
);

module.exports = router;
