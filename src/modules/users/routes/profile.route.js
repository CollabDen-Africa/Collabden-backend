const { Router } = require("express");
const { profileController } = require("../controllers");
const validateRequest = require("../../../middleware/validateRequest");
const {
  updateProfileSchema,
  updateEmailSchema,
  updatePhoneSchema,
  changePasswordSchema,
  updateAvatarSchema,
  addEndorsementSchema,
  updatePortfolioSchema,
  projectEndorsementSchema,
} = require("../../../schemas/profile.schema");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const router = Router();

/**
 * @swagger
 * /api/v1/user/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put("/", authMiddleware, validateRequest(updateProfileSchema), profileController.updateProfile);

/**
 * @swagger
 * /api/v1/user/profile/email:
 *   patch:
 *     summary: Change account email (requires current password)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail, currentPassword]
 *             properties:
 *               newEmail:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email updated, re-verification required
 *       401:
 *         description: Wrong password
 *       409:
 *         description: Email already taken
 */
router.patch("/email", authMiddleware, validateRequest(updateEmailSchema), profileController.updateEmail);

/**
 * @swagger
 * /api/v1/user/profile/phone:
 *   patch:
 *     summary: Update or remove phone number
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Phone updated
 */
router.patch("/phone", authMiddleware, validateRequest(updatePhoneSchema), profileController.updatePhone);

/**
 * @swagger
 * /api/v1/user/profile/password:
 *   patch:
 *     summary: Change account password
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Wrong current password
 */
router.patch("/password", authMiddleware, validateRequest(changePasswordSchema), profileController.changePassword);

/**
 * @swagger
 * /api/v1/user/profile/avatar:
 *   patch:
 *     summary: Update profile picture URL
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [avatarUrl]
 *             properties:
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Avatar updated
 */
router.patch("/avatar", authMiddleware, validateRequest(updateAvatarSchema), profileController.updateAvatar);

/**
 * @swagger
 * /api/v1/user/profile/completeness:
 *   get:
 *     summary: Get user profile completeness status
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/completeness", authMiddleware, profileController.getProfileCompleteness);

/**
 * @swagger
 * /api/v1/user/profile/browse:
 *   get:
 *     summary: Browse collaborators who are open to collaborate
 *     tags: [Profile]
 *     parameters:
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
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/browse", profileController.browseCollaborators);

/**
 * @swagger
 * /api/v1/user/profile/{userId}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/:userId", profileController.getProfile);

/**
 * @swagger
 * /api/v1/user/profile/{userId}/endorsements:
 *   post:
 *     summary: Add an endorsement to a user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: Endorsement added successfully
 */
router.post("/:userId/endorsements", authMiddleware, validateRequest(addEndorsementSchema), profileController.addEndorsement);

/**
 * @swagger
 * /api/v1/user/profile/portfolio/{userId}:
 *   get:
 *     summary: Get user portfolio
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/portfolio/:userId", profileController.getPortfolio);

/**
 * @swagger
 * /api/v1/user/profile/portfolio/{projectId}:
 *   put:
 *     summary: Update portfolio entry for a project
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Portfolio entry updated successfully
 */

router.put("/portfolio/:projectId", authMiddleware, validateRequest(updatePortfolioSchema), profileController.updatePortfolioEntry);

/**
 * @swagger
 * /api/v1/user/profile/portfolio/{projectId}/endorsements:
 *   post:
 *     summary: Add an endorsement to a collaborator for a specific project
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Endorsement added successfully
 */
router.post("/portfolio/:projectId/endorsements", authMiddleware, validateRequest(projectEndorsementSchema), profileController.addProjectEndorsement);

module.exports = router;
