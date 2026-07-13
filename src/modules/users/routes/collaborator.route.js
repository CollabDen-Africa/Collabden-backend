const { Router } = require("express");
const {
  getCollaborators,
  getCollaboratorById,
  updateAvailability,
  listSkills,
  listGenres,
} = require("../controllers/collaborator.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const { updateAvailabilitySchema } = require("../../../schemas/collaborator.schema");

const router = Router();

/**
 * @swagger
 * /api/v1/user/collaborators:
 *   get:
 *     summary: Retrieve collaborator profiles for the marketplace with filters
 *     tags: [Collaborators]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Search by display name, legal name, first name, or last name
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: Comma-separated list of skills
 *       - in: query
 *         name: genres
 *         schema:
 *           type: string
 *         description: Comma-separated list of genres
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Search for specific role in experience or skills (e.g. producer)
 *       - in: query
 *         name: openToCollaborate
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *         description: Filter availability (defaults to true)
 *     responses:
 *       200:
 *         description: List of collaborators retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 */
router.get("/", getCollaborators);

/**
 * @swagger
 * /api/v1/user/collaborators/skills:
 *   get:
 *     summary: Get a list of all unique skills currently present in user profiles
 *     tags: [Collaborators]
 *     responses:
 *       200:
 *         description: Unique skills list retrieved successfully
 */
router.get("/skills", listSkills);

/**
 * @swagger
 * /api/v1/user/collaborators/genres:
 *   get:
 *     summary: Get a list of all unique genres currently present in user profiles
 *     tags: [Collaborators]
 *     responses:
 *       200:
 *         description: Unique genres list retrieved successfully
 */
router.get("/genres", listGenres);

/**
 * @swagger
 * /api/v1/user/collaborators/availability:
 *   patch:
 *     summary: Update collaborator availability status
 *     tags: [Collaborators]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - openToCollaborate
 *             properties:
 *               openToCollaborate:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Availability status updated successfully
 */
router.patch("/availability", authMiddleware, validateRequest(updateAvailabilitySchema), updateAvailability);

/**
 * @swagger
 * /api/v1/user/collaborators/{userId}:
 *   get:
 *     summary: Retrieve detailed collaborator profile including portfolio, history, and endorsements
 *     tags: [Collaborators]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to retrieve
 *     responses:
 *       200:
 *         description: Detailed profile information retrieved successfully
 *       404:
 *         description: Collaborator not found
 */
router.get("/:userId", getCollaboratorById);

module.exports = router;
