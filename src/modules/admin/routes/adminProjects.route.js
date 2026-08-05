const { Router } = require("express");
const {
  getProjectsController,
  getProjectByIdController,
  getProjectActivityController,
  getAllProjectReportsController,
  getReportByIdController,
  getProjectReportsController,
  updateProjectReportStatusController,
  getProjectNotesController,
  addProjectNoteController,
  getProjectAuditHistoryController,
  moderateProjectController,
} = require("../controllers/adminProjects.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  moderateProjectSchema,
  createProjectNoteSchema,
  updateProjectReportStatusSchema,
} = require("../../../schemas/adminProject.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/projects/reports:
 *   get:
 *     summary: Retrieve all project reports globally
 *     tags: [Admin Management - Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (Pending, Under Review, Resolved, OPEN, REVIEWED, ACTION_TAKEN, DISMISSED)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by reason, description, project name, or reporter
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
 *         description: Global project reports fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/reports",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getAllProjectReportsController
);

/**
 * @swagger
 * /api/v1/admin/projects/reports/{reportId}:
 *   get:
 *     summary: Retrieve details of a specific project report by report ID
 *     tags: [Admin Management - Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report details fetched successfully
 *       404:
 *         description: Report not found
 */
router.get(
  "/reports/:reportId",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getReportByIdController
);

/**
 * @swagger
 * /api/v1/admin/projects/reports/{reportId}/status:
 *   patch:
 *     summary: Update status of a project report
 *     tags: [Admin Management - Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
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
  "/reports/:reportId/status",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
  validateRequest(updateProjectReportStatusSchema),
  updateProjectReportStatusController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects:
 *   get:
 *     summary: Retrieve all projects with search, filtering, sorting, and pagination
 *     tags: [Admin Management - Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by project name, description, ID, or owner name/email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (ACTIVE, COMPLETED, ARCHIVED, REMOVED)
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *         description: Filter by visibility (PUBLIC, PRIVATE)
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by (createdAt, name, status, visibility, updatedAt)
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
 *         description: Projects list fetched successfully
 */
router.get(
  "/all-projects",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getProjectsController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}:
 *   get:
 *     summary: Retrieve detailed information for a single project by ID
 *     tags: [Admin Management - Projects]
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
 *         description: Project details fetched successfully
 *       404:
 *         description: Project not found
 */
router.get(
  "/all-projects/:id",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getProjectByIdController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/activity:
 *   get:
 *     summary: Retrieve activity log history for a specific project
 *     tags: [Admin Management - Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
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
 *         description: Activity history fetched successfully
 */
router.get(
  "/all-projects/:id/activity",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getProjectActivityController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/reports:
 *   get:
 *     summary: Retrieve reports submitted against a specific project
 *     tags: [Admin Management - Projects]
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
 *         description: Project reports fetched successfully
 */
router.get(
  "/all-projects/:id/reports",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getProjectReportsController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/reports/{reportId}/status:
 *   patch:
 *     summary: Update status of a report submitted against a project
 *     tags: [Admin Management - Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: reportId
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
 *         description: Report status updated
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Report not found
 */
router.patch(
  "/all-projects/:id/reports/:reportId/status",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
  validateRequest(updateProjectReportStatusSchema),
  updateProjectReportStatusController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/notes:
 *   get:
 *     summary: Retrieve administrative internal notes for a project
 *     tags: [Admin Management - Projects]
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
 *         description: Admin notes fetched successfully
 */
router.get(
  "/all-projects/:id/notes",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getProjectNotesController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/notes:
 *   post:
 *     summary: Add an internal administrative note to a project
 *     tags: [Admin Management - Projects]
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
 *         description: Admin note added successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Project not found
 */
router.post(
  "/all-projects/:id/notes",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
  validateRequest(createProjectNoteSchema),
  addProjectNoteController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/audit:
 *   get:
 *     summary: Retrieve read-only administrative audit log history for a project
 *     tags: [Admin Management - Projects]
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
 *         description: Project audit history fetched successfully
 */
router.get(
  "/all-projects/:id/audit",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
  getProjectAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/moderate:
 *   post:
 *     summary: Moderate a project (Archive or Remove with audit logging and notifications)
 *     tags: [Admin Management - Projects]
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
 *               - actionType
 *               - reason
 *             properties:
 *               actionType:
 *                 type: string
 *                 enum: [ARCHIVE, REMOVE]
 *               reason:
 *                 type: string
 *               additionalNotes:
 *                 type: string
 *               notifyOwner:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Project moderated successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Project not found
 */
router.post(
  "/all-projects/:id/moderate",
  checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
  validateRequest(moderateProjectSchema),
  moderateProjectController
);

module.exports = router;
