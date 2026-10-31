const { Router } = require("express");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const {
  getUserSpaceHandler,
  removeSavedFileHandler,
} = require("../controllers/userSpace.controller");

const router = Router();

/**
 * @swagger
 * /api/v1/user/space:
 *   get:
 *     summary: Unified "My Space" — agreements, saved project files, and DM attachments
 *     description: >
 *       Aggregates every file-like item the authenticated user has access to across
 *       the platform: legal agreements from their projects, project files they have
 *       explicitly saved to their space, and direct-message attachments from their chats.
 *       Each item is normalized to a common shape with a fresh 1-hour signed URL.
 *     tags: [User Space]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [agreement, saved-file, dm-attachment] }
 *         description: Filter to a single item type. Omit to return all three.
 *       - in: query
 *         name: projectName
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive substring match on the item title.
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Space items returned successfully.
 */
router.get("/", authMiddleware, getUserSpaceHandler);

/**
 * @swagger
 * /api/v1/user/space/saved-files/{projectFileId}:
 *   delete:
 *     summary: Remove a project file from the user's space (does not delete the file itself)
 *     tags: [User Space]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectFileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reference removed.
 */
router.delete("/saved-files/:projectFileId", authMiddleware, removeSavedFileHandler);

module.exports = router;
