const { Router } = require("express");
const multer = require("multer");
const {
  createProject,
  uploadProjectFile,
  sendProjectMessage,
  createProjectTask,
  updateProjectTaskStatus,
  getProjects,
  getProjectDetails,
  inviteCollaborator,
  respondToInvite,
  getMyInvites,
  updateProject,
  deleteProject,
  removeCollaborator,
  getProjectMetadata,
  getMarketplace,
  getMarketplaceSummary,
  reportProject,
  uploadProjectCover,
  getRoyaltySplits,
  updateRoyaltySplits,
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
  cancelApplication,
} = require("../controllers/applications.controller");

const router = Router();
const projectFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const coverImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for project cover images."), false);
    }
  },
});

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
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               coverImageUrl:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE]
 *               openToCollaborators:
 *                 type: boolean
 *         multipart/form-data:
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
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: Cover image file (JPEG, PNG, WebP)
 *               coverImageUrl:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE]
 *               openToCollaborators:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Missing required fields
 */
router.post("/", coverImageUpload.single("coverImage"), createProject);

/**
 * @swagger
 * /api/v1/projects/{id}/files:
 *   post:
 *     summary: Upload a project workspace file
 *     description: Uploads one file to a project. The authenticated user must be a project collaborator with upload access.
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
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       400:
 *         description: No file supplied or invalid upload
 *       401:
 *         description: Missing or invalid user bearer token
 *       403:
 *         description: User cannot upload files to this project
 */
router.post("/:id/files", projectFileUpload.single("file"), uploadProjectFile);

/**
 * @swagger
 * /api/v1/projects/{id}/messages:
 *   post:
 *     summary: Send a project workspace message
 *     description: Sends a message to the project workspace as the authenticated collaborator.
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Message content is required
 *       401:
 *         description: Missing or invalid user bearer token
 *       403:
 *         description: User cannot message this project
 */
router.post("/:id/messages", sendProjectMessage);

/**
 * @swagger
 * /api/v1/projects/{id}/tasks:
 *   post:
 *     summary: Create a project task
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
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 150
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, COMPLETED]
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Invalid task input
 *       401:
 *         description: Missing or invalid user bearer token
 *       403:
 *         description: User cannot create tasks in this project
 */
router.post("/:id/tasks", createProjectTask);

/**
 * @swagger
 * /api/v1/projects/{id}/tasks/{taskId}:
 *   patch:
 *     summary: Update a project task status
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
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       400:
 *         description: Invalid task status
 *       401:
 *         description: Missing or invalid user bearer token
 *       403:
 *         description: User cannot update this task
 */
router.patch("/:id/tasks/:taskId", updateProjectTaskStatus);

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
/**
 * @swagger
 * /api/v1/projects/invitations/my-invites:
 *   get:
 *     summary: List invitations for the authenticated user
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitations fetched successfully
 *       401:
 *         description: Missing or invalid user bearer token
 */
router.get("/invitations/my-invites", getMyInvites);
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
/**
 * @swagger
 * /api/v1/projects/{projectId}/applications:
 *   get:
 *     summary: List all applications for a specific project (Project Owner only)
 *     description: Returns applicant's profile data (display name, avatar, bio, location, skills, genres, portfolio links), application pitch, and application status so the owner can review them.
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: List of applications fetched successfully
 *       403:
 *         description: Access denied (only project owner)
 *       404:
 *         description: Project not found
 */
router.get("/:projectId/applications", getProjectApplications);
router.get("/:id/applications", getProjectApplications);

/**
 * @swagger
 * /api/v1/projects/{projectId}/applications/{applicationId}/status:
 *   patch:
 *     summary: Update application status (Accept / Decline)
 *     description: Accept or decline a project application. Accepting automatically adds the applicant as an active collaborator on the project workspace.
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
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
 *                 enum: [ACCEPTED, DECLINED, REJECTED]
 *                 example: ACCEPTED
 *     responses:
 *       200:
 *         description: Application status updated successfully and collaborator added if accepted
 *       400:
 *         description: Invalid status or application already processed
 *       403:
 *         description: Access denied (only project owner)
 *       404:
 *         description: Application or project not found
 */
router.patch("/:projectId/applications/:applicationId/status", reviewApplication);
router.patch("/:id/applications/:applicationId/status", reviewApplication);

/**
 * @swagger
 * /api/v1/projects/applications/{applicationId}/cancel:
 *   post:
 *     summary: Cancel a submitted project application
 *     description: Cancels an existing application. Can be invoked by the applicant or the project owner. If the application was previously accepted, the applicant is deactivated as a project collaborator.
 *     tags: [Project Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Application cancelled successfully
 *       400:
 *         description: Application already cancelled
 *       403:
 *         description: Access denied (only applicant or owner can cancel)
 *       404:
 *         description: Application not found
 */
router.post("/applications/:applicationId/cancel", cancelApplication);
router.post("/:projectId/applications/:applicationId/cancel", cancelApplication);
router.patch("/:projectId/applications/:applicationId/cancel", cancelApplication);

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
 * /api/v1/projects/{id}/invitations/respond:
 *   post:
 *     summary: Accept or decline a project invitation
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID from the invitation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [ACCEPT, DECLINE]
 *     responses:
 *       200:
 *         description: Invitation response saved successfully
 *       400:
 *         description: Invalid invitation action
 *       401:
 *         description: Missing or invalid user bearer token
 *       404:
 *         description: Invitation or project not found
 */
router.post("/:id/invitations/respond", respondToInvite);

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
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               coverImageUrl:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE]
 *         multipart/form-data:
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
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: Cover image file (JPEG, PNG, WebP)
 *               coverImageUrl:
 *                 type: string
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
router.put("/:id", coverImageUpload.single("coverImage"), updateProject);

/**
 * @swagger
 * /api/v1/projects/{id}/cover:
 *   post:
 *     summary: Upload a project cover image (multipart/form-data)
 *     description: Uploads and optimizes a cover image for the project workspace and marketplace card.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - coverImage
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: Project cover image file (JPEG, PNG, WebP)
 *     responses:
 *       200:
 *         description: Project cover image uploaded successfully
 *       400:
 *         description: No image file uploaded or invalid image format
 *       404:
 *         description: Project not found or insufficient permissions
 */
router.post("/:id/cover", coverImageUpload.single("coverImage"), uploadProjectCover);

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
 * /api/v1/projects/{id}/royalties:
 *   get:
 *     summary: Get project royalty splits
 *     description: Returns the configured master royalty share allocations for project collaborators.
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
 *         description: Royalty splits retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Project not found
 *   put:
 *     summary: Update project royalty splits
 *     description: Configures per-collaborator master royalty percentages. Only the project owner can update splits. Total splits cannot exceed 100%.
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
 *               - splits
 *             properties:
 *               splits:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - royaltyShare
 *                   properties:
 *                     userId:
 *                       type: string
 *                     royaltyShare:
 *                       type: number
 *                     role:
 *                       type: string
 *     responses:
 *       200:
 *         description: Royalty splits updated successfully
 *       400:
 *         description: Total percentage exceeds 100% or invalid payload
 *       403:
 *         description: Only the project owner can update royalty splits
 */
router.get("/:id/royalties", getRoyaltySplits);
router.put("/:id/royalties", updateRoyaltySplits);

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
