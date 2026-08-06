const { Router } = require("express");
const {
  getListingsController,
  getCollaboratorDetailsController,
  getProjectPostingDetailsController,
  getReportsController,
  getReportByIdController,
  updateReportStatusController,
  addMarketplaceNoteController,
  moderateProfileController,
  moderateProjectController,
  getMarketplaceAuditHistoryController,
} = require("../controllers/adminMarketplace.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  moderateMarketplaceProfileSchema,
  moderateMarketplaceProjectSchema,
  updateMarketplaceReportStatusSchema,
  createMarketplaceNoteSchema,
} = require("../../../schemas/adminMarketplace.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All admin marketplace routes require authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/marketplace:
 *   get:
 *     summary: Retrieve collaborator profiles and public project postings with summary counts, search, filtering, and pagination
 *     tags: [Admin Management - Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, profiles, projects]
 *           default: all
 *         description: Filter listings by content type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user name, profile ID, project name, or project owner
 *       - in: query
 *         name: profileStatus
 *         schema:
 *           type: string
 *         description: Filter profiles by status (ACTIVE, RESTRICTED, SUSPENDED, BANNED, DEACTIVATED)
 *       - in: query
 *         name: openToCollaborate
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter profiles by Open to Collaborate status
 *       - in: query
 *         name: projectStatus
 *         schema:
 *           type: string
 *         description: Filter projects by status (ACTIVE, COMPLETED, ARCHIVED)
 *       - in: query
 *         name: reportStatus
 *         schema:
 *           type: string
 *         description: Filter by report status (HAS_REPORTS, NO_REPORTS, OPEN, REVIEWED, ACTION_TAKEN, DISMISSED)
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
 *         description: Marketplace listings and summary metrics fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get(
  "/",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_VIEW),
  getListingsController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/reports:
 *   get:
 *     summary: Retrieve reports submitted against collaborator profiles and project postings
 *     tags: [Admin Management - Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum: [all, profile, project]
 *           default: all
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
 *         description: Marketplace reports retrieved successfully
 */
router.get(
  "/reports",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_VIEW),
  getReportsController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/reports/{id}:
 *   get:
 *     summary: Retrieve details of a specific marketplace report
 *     tags: [Admin Management - Marketplace]
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
 *         description: Report details retrieved successfully
 *       404:
 *         description: Report not found
 */
router.get(
  "/reports/:id",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_VIEW),
  getReportByIdController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/reports/{id}/status:
 *   patch:
 *     summary: Update the status of a marketplace report after investigation
 *     tags: [Admin Management - Marketplace]
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
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_MODERATE),
  validateRequest(updateMarketplaceReportStatusSchema),
  updateReportStatusController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/notes:
 *   post:
 *     summary: Add an internal administrative note to a collaborator profile or project posting
 *     tags: [Admin Management - Marketplace]
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
 *             properties:
 *               content:
 *                 type: string
 *               targetUserId:
 *                 type: string
 *               targetProjectId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin note added successfully
 *       400:
 *         description: Validation failed
 */
router.post(
  "/notes",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_MODERATE),
  validateRequest(createMarketplaceNoteSchema),
  addMarketplaceNoteController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/audit:
 *   get:
 *     summary: View marketplace activity and moderation audit history (read-only)
 *     tags: [Admin Management - Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum: [all, profile, project]
 *           default: all
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
 *         description: Marketplace audit history retrieved successfully
 */
router.get(
  "/audit",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_VIEW),
  getMarketplaceAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/collaborators/{id}:
 *   get:
 *     summary: Retrieve detailed collaborator profile information, portfolio, and collaboration history (read-only)
 *     tags: [Admin Management - Marketplace]
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
 *         description: Collaborator profile details retrieved successfully
 *       404:
 *         description: Profile not found
 */
router.get(
  "/collaborators/:id",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_VIEW),
  getCollaboratorDetailsController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/collaborators/{id}/moderate:
 *   post:
 *     summary: Moderate a marketplace collaborator profile (Restrict, Remove/Suspend, or Restore)
 *     tags: [Admin Management - Marketplace]
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
 *               - action
 *               - reason
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [RESTRICT, REMOVE, RESTORE, SUSPEND]
 *               reason:
 *                 type: string
 *               notifyUser:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Profile moderated successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Profile not found
 */
router.post(
  "/collaborators/:id/moderate",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_MODERATE),
  validateRequest(moderateMarketplaceProfileSchema),
  moderateProfileController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/projects/{id}:
 *   get:
 *     summary: Retrieve detailed project posting information, owner info, required roles, timeline, and application activity
 *     tags: [Admin Management - Marketplace]
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
 *         description: Project posting details retrieved successfully
 *       404:
 *         description: Project posting not found
 */
router.get(
  "/projects/:id",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_VIEW),
  getProjectPostingDetailsController
);

/**
 * @swagger
 * /api/v1/admin/marketplace/projects/{id}/moderate:
 *   post:
 *     summary: Moderate a marketplace project posting (Restrict, Remove, or Restore)
 *     tags: [Admin Management - Marketplace]
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
 *               - action
 *               - reason
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [RESTRICT, REMOVE, RESTORE]
 *               reason:
 *                 type: string
 *               notifyOwner:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Project posting moderated successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Project posting not found
 */
router.post(
  "/projects/:id/moderate",
  checkPermission(ADMIN_PERMISSIONS.MARKETPLACE_MODERATE),
  validateRequest(moderateMarketplaceProjectSchema),
  moderateProjectController
);

module.exports = router;
