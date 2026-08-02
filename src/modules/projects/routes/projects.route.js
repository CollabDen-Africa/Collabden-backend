const { Router } = require("express");
const {
  createProject,
  getProjects,
  getProjectDetails,
  inviteCollaborator,
  updateProject,
  deleteProject,
  removeCollaborator,
  getProjectMetadata,
  getMarketplace,
  getMarketplaceSummary,
  reportProject,
} = require("../controllers/projects.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const {
  applyToProject,
  getProjectApplications,
  getMyApplications,
  getApplicationDetails,
  sendApplicationMessage,
  getApplicationMessages,
  reviewApplication,
} = require("../controllers/applications.controller");

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - genre
 *               - startDate
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               genre:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE]
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Missing required fields
 */
router.post("/", createProject);

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: List all active projects for the user
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [PUBLIC, PRIVATE]
 *         description: Filter projects by visibility
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter projects by status
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter projects by genre
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search projects by name or description (case-insensitive)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, startDate]
 *           default: createdAt
 *         description: Field to sort the projects by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sorting direction (ascending or descending)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of projects fetched successfully
 */
router.get("/", getProjects);

/**
 * @swagger
 * /api/v1/projects/marketplace:
 *   get:
 *     summary: Retrieve public projects open to collaboration with filters and search
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by required collaborator role
 *       - in: query
 *         name: requirements
 *         schema:
 *           type: string
 *         description: Filter by required skills
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by project name or description
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Filter projects starting on or after this date (ISO date)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: Filter projects ending on or before this date (ISO date)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *         description: Sort direction
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
 *         description: List of marketplace projects retrieved successfully
 */
router.get("/marketplace", getMarketplace);

/**
 * @swagger
 * /api/v1/projects/marketplace/{id}/summary:
 *   get:
 *     summary: Retrieve public summary information of a marketplace project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project summary retrieved successfully
 *       404:
 *         description: Project not found or is private
 */
router.get("/marketplace/:id/summary", getMarketplaceSummary);

/**
 * @swagger
 * /api/v1/projects/applications/my-applications:
 *   get:
 *     summary: List all applications submitted by the current user
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of applications fetched successfully
 */
router.get("/applications/my-applications", getMyApplications);

/**
 * @swagger
 * /api/v1/projects/applications/{applicationId}:
 *   get:
 *     summary: Retrieve details of a specific application (Applicant or Owner only)
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details fetched successfully
 *       403:
 *         description: Access denied
 */
router.get("/applications/:applicationId", getApplicationDetails);

/**
 * @swagger
 * /api/v1/projects/applications/{applicationId}/review:
 *   post:
 *     summary: Review (Accept or Reject) a project application
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
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
 *                 enum: [ACCEPTED, REJECTED]
 *     responses:
 *       200:
 *         description: Application reviewed successfully
 */
router.post("/applications/:applicationId/review", reviewApplication);

/**
 * @swagger
 * /api/v1/projects/applications/{applicationId}/messages:
 *   post:
 *     summary: Send a communication message on an application
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
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
 *     responses:
 *       201:
 *         description: Message sent successfully
 *   get:
 *     summary: Retrieve message history for an application
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages fetched successfully
 */
router.post("/applications/:applicationId/messages", sendApplicationMessage);
router.get("/applications/:applicationId/messages", getApplicationMessages);

/**
 * @swagger
 * /api/v1/projects/{id}/apply:
 *   post:
 *     summary: Apply to join a project
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: A short introduction or motivation statement
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *       400:
 *         description: Bad request (e.g., owner applying, already applied, project not open)
 */
router.post("/:id/apply", applyToProject);

/**
 * @swagger
 * /api/v1/projects/{id}/applications:
 *   get:
 *     summary: List all applications for a specific project (Project Owner only)
 *     tags: [Project Applications]
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
 *         description: List of applications fetched successfully
 */
router.get("/:id/applications", getProjectApplications);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get project workspace details
 *     tags: [Projects]
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
router.get("/:id", getProjectDetails);

/**
 * @swagger
 * /api/v1/projects/{id}/invite:
 *   post:
 *     summary: Invite a collaborator to a project
 *     tags: [Projects]
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
 *               - collaboratorId
 *             properties:
 *               collaboratorId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Collaborator invited successfully
 *       404:
 *         description: Project or User not found
 */
router.post("/:id/invite", inviteCollaborator);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: Update project details
 *     tags: [Projects]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               genre:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE]
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       403:
 *         description: Only the owner can update project settings
 *       404:
 *         description: Project not found
 */
router.put("/:id", updateProject);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Soft delete a project
 *     tags: [Projects]
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
 *         description: Project deleted successfully
 *       403:
 *         description: Only the owner can delete the project
 */
router.delete("/:id", deleteProject);

/**
 * @swagger
 * /api/v1/projects/{id}/collaborators/{collaboratorId}:
 *   delete:
 *     summary: Remove a collaborator from a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: collaboratorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Collaborator removed successfully
 *       403:
 *         description: Permission denied
 */
router.delete("/:id/collaborators/:collaboratorId", removeCollaborator);

/**
 * @swagger
 * /api/v1/projects/{id}/metadata:
 *   get:
 *     summary: Get project metadata and statistics
 *     tags: [Projects]
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
 *         description: Project metadata fetched successfully
 */
router.get("/:id/metadata", getProjectMetadata);

/**
 * @swagger
 * /api/v1/projects/{id}/report:
 *   post:
 *     summary: Report a project
 *     tags: [Projects]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project reported successfully
 *       404:
 *         description: Project not found
 */
router.post("/:id/report", reportProject);

module.exports = router;
