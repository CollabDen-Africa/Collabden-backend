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
} = require("../controllers/projects.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");

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

module.exports = router;
