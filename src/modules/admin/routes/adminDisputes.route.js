const { Router } = require("express");
const {
  getDisputesController,
  getDisputeByIdController,
  addDisputeNoteController,
  getDisputeNotesController,
  updateDisputeStatusController,
} = require("../controllers/adminDisputes.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  updateDisputeStatusSchema,
  createDisputeNoteSchema,
} = require("../../../schemas/adminDisputes.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/disputes:
 *   get:
 *     summary: Retrieve all payment-related disputes submitted by users
 *     tags: [Admin Management - Payment Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by dispute ID, reason, description, user name/email, or project name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (OPEN, UNDER_REVIEW, AWAITING_RESPONSE, RESOLVED, CLOSED)
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
 *         description: Disputes fetched successfully
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
 *     summary: Retrieve comprehensive dispute details, including payment records, escrow details, legal agreements, and project activity history
 *     tags: [Admin Management - Payment Disputes]
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
 * /api/v1/admin/disputes/{id}/notes:
 *   get:
 *     summary: Retrieve internal administrative notes for a dispute
 *     tags: [Admin Management - Payment Disputes]
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
 *     tags: [Admin Management - Payment Disputes]
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
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Dispute not found
 */
router.post(
  "/:id/notes",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(createDisputeNoteSchema),
  addDisputeNoteController
);

/**
 * @swagger
 * /api/v1/admin/disputes/{id}/status:
 *   patch:
 *     summary: Update dispute status after administrative review
 *     tags: [Admin Management - Payment Disputes]
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
 *         description: Validation failed
 *       404:
 *         description: Dispute not found
 */
router.patch(
  "/:id/status",
  checkPermission(ADMIN_PERMISSIONS.DISPUTES_MANAGE),
  validateRequest(updateDisputeStatusSchema),
  updateDisputeStatusController
);

module.exports = router;
