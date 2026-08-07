const { Router } = require("express");
const {
  getAgreementsController,
  getAgreementDetailsController,
  getAgreementActivityController,
  getAgreementReportsController,
  getAgreementReportByIdController,
  updateAgreementReportStatusController,
  addAgreementNoteController,
  getAgreementAuditHistoryController,
} = require("../controllers/adminAgreements.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  updateAgreementReportStatusSchema,
  createAgreementNoteSchema,
} = require("../../../schemas/adminAgreement.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All admin agreement routes require authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/agreements:
 *   get:
 *     summary: Retrieve all legal agreements across the platform with search, filtering, sorting, and pagination
 *     tags: [Admin Management - Legal Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by agreement ID, title, project name, project owner, or collaborator name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [All, DRAFT, PENDING_SIGNATURE, SIGNED]
 *         description: Filter by agreement status
 *       - in: query
 *         name: projectStatus
 *         schema:
 *           type: string
 *           enum: [All, ACTIVE, COMPLETED]
 *         description: Filter by project status
 *       - in: query
 *         name: dateCreatedFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter agreements created on or after this date
 *       - in: query
 *         name: dateCreatedTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter agreements created on or before this date
 *       - in: query
 *         name: dateSignedFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter agreements signed on or after this date
 *       - in: query
 *         name: dateSignedTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter agreements signed on or before this date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sort field (createdAt, title, status, updatedAt)
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
 *         description: Legal agreements retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get(
  "/",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_VIEW),
  getAgreementsController
);

/**
 * @swagger
 * /api/v1/admin/agreements/reports:
 *   get:
 *     summary: Retrieve reports submitted against legal agreements
 *     tags: [Admin Management - Legal Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [All, OPEN, REVIEWED, ACTION_TAKEN, DISMISSED]
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
 *         description: Agreement reports retrieved successfully
 */
router.get(
  "/reports",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_VIEW),
  getAgreementReportsController
);

/**
 * @swagger
 * /api/v1/admin/agreements/reports/{id}:
 *   get:
 *     summary: Retrieve details of a specific agreement report
 *     tags: [Admin Management - Legal Agreements]
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
 *         description: Agreement report details retrieved successfully
 *       404:
 *         description: Report not found
 */
router.get(
  "/reports/:id",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_VIEW),
  getAgreementReportByIdController
);

/**
 * @swagger
 * /api/v1/admin/agreements/reports/{id}/status:
 *   patch:
 *     summary: Update the status of an agreement report after investigation
 *     tags: [Admin Management - Legal Agreements]
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
 *                 enum: [OPEN, REVIEWED, ACTION_TAKEN, DISMISSED]
 *     responses:
 *       200:
 *         description: Report status updated successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Report not found
 */
router.patch(
  "/reports/:id/status",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_MANAGE),
  validateRequest(updateAgreementReportStatusSchema),
  updateAgreementReportStatusController
);

/**
 * @swagger
 * /api/v1/admin/agreements/notes:
 *   post:
 *     summary: Add an internal administrative note to a legal agreement
 *     tags: [Admin Management - Legal Agreements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - targetAgreementId
 *             properties:
 *               content:
 *                 type: string
 *               targetAgreementId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin note added to agreement successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Agreement not found
 */
router.post(
  "/notes",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_MANAGE),
  validateRequest(createAgreementNoteSchema),
  addAgreementNoteController
);

/**
 * @swagger
 * /api/v1/admin/agreements/audit:
 *   get:
 *     summary: View agreement-related administrative audit history (read-only)
 *     tags: [Admin Management - Legal Agreements]
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
 *         description: Agreement audit history retrieved successfully
 */
router.get(
  "/audit",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_VIEW),
  getAgreementAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/agreements/{id}:
 *   get:
 *     summary: Retrieve detailed agreement information including signatories, identity verification, and signed document access
 *     tags: [Admin Management - Legal Agreements]
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
 *         description: Agreement details retrieved successfully
 *       404:
 *         description: Agreement not found
 */
router.get(
  "/:id",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_VIEW),
  getAgreementDetailsController
);

/**
 * @swagger
 * /api/v1/admin/agreements/{id}/activity:
 *   get:
 *     summary: Retrieve agreement activity history (uploads, edits, signatures, status changes)
 *     tags: [Admin Management - Legal Agreements]
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
 *         description: Agreement activity history retrieved successfully
 *       404:
 *         description: Agreement not found
 */
router.get(
  "/:id/activity",
  checkPermission(ADMIN_PERMISSIONS.AGREEMENTS_VIEW),
  getAgreementActivityController
);

module.exports = router;
