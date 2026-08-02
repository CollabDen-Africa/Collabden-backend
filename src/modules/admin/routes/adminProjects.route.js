const { Router } = require("express");
const {
  getProjectsController,
  getProjectByIdController,
  getProjectActivityController,
  getProjectReportsController,
  getAllProjectReportsController,
  updateProjectReportStatusController,
  getProjectNotesController,
  addProjectNoteController,
  getProjectAuditHistoryController,
  moderateProjectController
} = require("../controllers/adminProjects.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require authentication
router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/projects/reports:
 *   get:
 *     summary: Retrieve all project reports globally
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (Pending, Under Review, Resolved, All)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by reason, description, or project name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Global reports fetched
 */
router.get("/reports",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getAllProjectReportsController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects:
 *   get:
 *     summary: Retrieve all projects
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-projects",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getProjectsController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}:
 *   get:
 *     summary: Retrieve a single project by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-projects/:id",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getProjectByIdController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/activity:
 *   get:
 *     summary: Retrieve a project's activity log by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-projects/:id/activity",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getProjectActivityController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/reports:
 *   get:
 *     summary: Retrieve reports against a project by ID
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-projects/:id/reports",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getProjectReportsController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/reports/{reportId}/status:
 *   patch:
 *     summary: Update a report status
 *     tags: [Admin Management]
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
 */
router.patch("/all-projects/:id/reports/:reportId/status",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
    updateProjectReportStatusController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/notes:
 *   get:
 *     summary: Retrieve admin notes for a project
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-projects/:id/notes",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getProjectNotesController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/notes:
 *   post:
 *     summary: Add an admin note to a project
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/all-projects/:id/notes",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
    addProjectNoteController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/audit:
 *   get:
 *     summary: Retrieve audit history for a project
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/all-projects/:id/audit",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_VIEW),
    getProjectAuditHistoryController);

/**
 * @swagger
 * /api/v1/admin/projects/all-projects/{id}/moderate:
 *   post:
 *     summary: Moderate a project (Archive or Remove)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/all-projects/:id/moderate",
    checkPermission(ADMIN_PERMISSIONS.PROJECTS_MANAGE),
    moderateProjectController);

module.exports = router;
