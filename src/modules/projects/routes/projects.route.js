const { Router } = require("express");
const multer = require("multer");
const {
  createProject,
  uploadProjectFile,
  listProjectFiles,
  getFileVersions,
  restoreFileVersion,
  streamProjectFile,
  downloadProjectFile,
  deleteFileVersion,
  deleteProjectFile,
  getProjectStorageUsage,
  sendProjectMessage,
  getProjectMessages,
  markProjectMessagesRead,
  reactToProjectMessage,
  uploadProjectMessageAttachment,
  createProjectTask,
  listProjectTasks,
  getProjectTaskDetails,
  updateProjectTask,
  deleteProjectTask,
  addProjectTaskComment,
  listProjectTaskComments,
  deleteProjectTaskComment,
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
  saveProjectFileToSpace,
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
const { MAX_FILE_UPLOAD_MB } = require("../../../config/constants");
const { MAX_ATTACHMENT_BYTES } = require("../services/projectMessageAttachments.service");
const projectFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_UPLOAD_MB * 1024 * 1024 },
});

const messageAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES },
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
 * /api/v1/projects/{id}/files:
 *   get:
 *     summary: List files in a project workspace (with current version metadata)
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
 *         description: Files returned
 */
router.get("/:id/files", listProjectFiles);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}/versions:
 *   get:
 *     summary: List all versions of a project file
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
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Versions returned (newest first)
 */
router.get("/:id/files/:fileId/versions", getFileVersions);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}/versions/{versionId}/restore:
 *   post:
 *     summary: Restore an older version as the current version of a file
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
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Version restored
 */
router.post("/:id/files/:fileId/versions/:versionId/restore", restoreFileVersion);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}/versions/{versionId}:
 *   delete:
 *     summary: Delete a specific older version of a file (current version cannot be deleted)
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
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Version deleted
 */
router.delete("/:id/files/:fileId/versions/:versionId", deleteFileVersion);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}/stream:
 *   get:
 *     summary: Issue a short-lived signed URL for streaming playback of a file (or specific version)
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
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: versionId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signed URL returned with TTL
 */
router.get("/:id/files/:fileId/stream", streamProjectFile);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}/download:
 *   get:
 *     summary: Issue a short-lived signed URL for downloading the file (or a specific version)
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
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: versionId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signed download URL returned
 */
router.get("/:id/files/:fileId/download", downloadProjectFile);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}/save-to-space:
 *   post:
 *     summary: Save a project file to the authenticated user's personal "My Space"
 *     description: >
 *       Creates a reference (no byte copy) from the user to this project file so it
 *       appears in `GET /api/v1/user/space`. Idempotent — re-posting the same file is a no-op.
 *       Requires the user to be project owner or an active collaborator.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: File saved to the user's space.
 */
router.post("/:id/files/:fileId/save-to-space", saveProjectFileToSpace);

/**
 * @swagger
 * /api/v1/projects/{id}/files/{fileId}:
 *   delete:
 *     summary: Delete a project file and every version (uploader or project owner only)
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
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted
 */
router.delete("/:id/files/:fileId", deleteProjectFile);

/**
 * @swagger
 * /api/v1/projects/{id}/storage:
 *   get:
 *     summary: Report storage usage for the project owner's tier
 *     description: |
 *       Returns bytes used across every project owned by this project's owner, the owner's tier
 *       limit, the per-file cap, and the current retention policy. Use this to render the
 *       "150 MB / 500 MB used" indicator in the UI and to prompt upgrades.
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
 *         description: Storage usage returned
 */
router.get("/:id/storage", getProjectStorageUsage);

/**
 * @swagger
 * /api/v1/projects/{id}/messages:
 *   post:
 *     summary: Send a project workspace message, voice note, or attachment-only message
 *     description: |
 *       Posts a new message in the project workspace conversation. A message must include at
 *       least one of: text content, a voice note (`voiceUrl` + `voiceDuration`), or one or more
 *       attachments. Use `parentId` to reply to an existing message.
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
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *               parentId:
 *                 type: string
 *                 description: ID of the project message being replied to
 *               voiceUrl:
 *                 type: string
 *                 description: URL to a previously uploaded voice note file
 *               voiceDuration:
 *                 type: integer
 *                 description: Voice note duration in seconds (max 180)
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [url]
 *                   properties:
 *                     url:
 *                       type: string
 *                     name:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *                     size:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid payload (no content/voice/attachment, bad reply target, voice too long, etc.)
 *       401:
 *         description: Missing or invalid user bearer token
 *       404:
 *         description: Project not found or no access
 *   get:
 *     summary: List project workspace messages (newest cursor pagination)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: beforeId
 *         schema:
 *           type: string
 *         description: Return messages older than this message id (cursor)
 *     responses:
 *       200:
 *         description: Messages returned in chronological order; messages visible to the caller are marked as read
 *       401:
 *         description: Missing or invalid user bearer token
 *       404:
 *         description: Project not found or no access
 */
router.post("/:id/messages", sendProjectMessage);
router.get("/:id/messages", getProjectMessages);

/**
 * @swagger
 * /api/v1/projects/{id}/messages/read:
 *   patch:
 *     summary: Mark all unread project messages as read for the caller
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
 *         description: Read receipts persisted
 */
router.patch("/:id/messages/read", markProjectMessagesRead);

/**
 * @swagger
 * /api/v1/projects/{id}/messages/{messageId}/reactions:
 *   post:
 *     summary: Toggle an emoji reaction on a project message
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
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emoji]
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction toggled
 */
router.post("/:id/messages/:messageId/reactions", reactToProjectMessage);

/**
 * @swagger
 * /api/v1/projects/{id}/messages/attachments:
 *   post:
 *     summary: Upload an attachment for a project workspace message
 *     description: |
 *       Accepts one file (max 50 MB) and stores it in the private `message-attachments` bucket.
 *       Returns the storage `path` and a short-lived signed URL for immediate preview.
 *       Submit the returned `path`, `name`, `mimeType`, and `size` inside the `attachments`
 *       array when calling `POST /projects/:id/messages` — read endpoints will re-sign the URL
 *       on fetch so recipients always get a fresh link.
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
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image, PDF, Office doc, audio file, or zip archive
 *     responses:
 *       201:
 *         description: Attachment uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   type: string
 *                   description: Storage key to submit as attachments[].url on message create
 *                 signedUrl:
 *                   type: string
 *                 name:
 *                   type: string
 *                 mimeType:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 expiresInSeconds:
 *                   type: integer
 *       400:
 *         description: Missing file or unsupported type
 *       413:
 *         description: File larger than 50 MB
 */
router.post(
  "/:id/messages/attachments",
  messageAttachmentUpload.single("file"),
  uploadProjectMessageAttachment,
);

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
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               assigneeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Must be active collaborators on this project
 *     responses:
 *       201:
 *         description: Task created successfully
 *   get:
 *     summary: List project tasks (filterable; optionally grouped by status for a Kanban board)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [status]
 *         description: If "status", returns a board object keyed by each status column.
 *     responses:
 *       200:
 *         description: Tasks returned
 */
router.post("/:id/tasks", createProjectTask);
router.get("/:id/tasks", listProjectTasks);

/**
 * @swagger
 * /api/v1/projects/{id}/tasks/{taskId}:
 *   get:
 *     summary: Get a project task with its comments
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
 *     responses:
 *       200:
 *         description: Task details returned
 *   patch:
 *     summary: Update any mutable field on a project task (title, description, status, priority, dueDate, assigneeIds)
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
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 150
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE]
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               assigneeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Task updated
 *   delete:
 *     summary: Delete a project task (creator or project owner only)
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
 *     responses:
 *       200:
 *         description: Task deleted
 */
router.get("/:id/tasks/:taskId", getProjectTaskDetails);
router.patch("/:id/tasks/:taskId", updateProjectTask);
router.delete("/:id/tasks/:taskId", deleteProjectTask);

/**
 * @swagger
 * /api/v1/projects/{id}/tasks/{taskId}/comments:
 *   get:
 *     summary: List all comments on a task
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
 *     responses:
 *       200:
 *         description: Comments returned (chronological)
 *   post:
 *     summary: Add a comment or threaded reply to a task
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *               parentId:
 *                 type: string
 *                 description: ID of the comment being replied to (optional)
 *     responses:
 *       201:
 *         description: Comment created
 */
router.get("/:id/tasks/:taskId/comments", listProjectTaskComments);
router.post("/:id/tasks/:taskId/comments", addProjectTaskComment);

/**
 * @swagger
 * /api/v1/projects/{id}/tasks/{taskId}/comments/{commentId}:
 *   delete:
 *     summary: Delete a task comment (author or project owner only)
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
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 */
router.delete("/:id/tasks/:taskId/comments/:commentId", deleteProjectTaskComment);

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
 *       404:
 *         description: Project not found
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
