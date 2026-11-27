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
  updateEndorsementSchema,
  endorsementVisibilitySchema,
  addBackupEmailSchema,
  verifyBackupEmailSchema,
  updatePreferencesSchema,
} = require("../../../schemas/profile.schema");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const { avatarUpload } = require("../../../middleware/avatarUpload.middleware");
const { checkStorageLimit } = require("../../../middleware/storageLimit.middleware");
const { rateLimitPerUser } = require("../../../middleware/rateLimit.middleware");
const router = Router();

// Shared budget across skill endorsements and testimonials.
const endorsementRateLimit = rateLimitPerUser({ name: "endorsements", max: 10, windowSeconds: 60 * 60 });

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
 * /api/v1/user/profile/avatar/upload:
 *   post:
 *     summary: Upload a profile picture directly (multipart/form-data)
 *     description: Uploads the file to Supabase Storage and saves the public URL to the user's profile. Max 5MB upload limit. Automatically cropped and optimized to 500x500 WebP. Allowed types JPEG, PNG, WebP, GIF.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded and saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 avatarUrl:
 *                   type: string
 *       400:
 *         description: No file provided or invalid file type/size
 *       500:
 *         description: Storage or server error
 */
router.post(
  "/avatar/upload",
  authMiddleware,
  checkStorageLimit,
  avatarUpload.single("avatar"),
  (err, req, res, next) => {
    // Handle multer errors (file too large, wrong type) inline
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  },
  profileController.uploadAvatar
);

/**
 * @swagger
 * /api/v1/user/profile/avatar:
 *   patch:
 *     summary: Update profile picture URL (manual URL, kept for backward compatibility)
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
 * /api/v1/user/profile/backup-email:
 *   post:
 *     summary: Add or replace backup email
 *     description: Saves the new backup email and sends a 6-digit OTP to it for verification. The address is not active until verified.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [backupEmail]
 *             properties:
 *               backupEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification code sent to backup email
 *       400:
 *         description: Invalid email or same as primary email
 *       409:
 *         description: Email already in use by another account
 */
router.post("/backup-email", authMiddleware, validateRequest(addBackupEmailSchema), profileController.addBackupEmail);

/**
 * @swagger
 * /api/v1/user/profile/backup-email/verify:
 *   post:
 *     summary: Verify backup email OTP
 *     description: Confirms the backup email using the 6-digit code that was sent to it.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit numeric OTP sent to the backup email
 *     responses:
 *       200:
 *         description: Backup email verified successfully
 *       400:
 *         description: Invalid or expired code
 *       409:
 *         description: Backup email already verified
 */
router.post("/backup-email/verify", authMiddleware, validateRequest(verifyBackupEmailSchema), profileController.verifyBackupEmail);

/**
 * @swagger
 * /api/v1/user/profile/backup-email:
 *   delete:
 *     summary: Remove backup email
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup email removed
 *       400:
 *         description: No backup email on this account
 */
router.delete("/backup-email", authMiddleware, profileController.removeBackupEmail);

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
 * /api/v1/user/profile/preferences:
 *   get:
 *     summary: Get account preferences (theme)
 *     description: >
 *       Returns the preferences saved on the account. The theme is stored server-side
 *       so it carries over to every device; it is also included as `theme` on the
 *       login response and on GET /api/v1/user/profile.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: object
 *                   properties:
 *                     theme:
 *                       type: string
 *                       enum: [LIGHT, DARK, SYSTEM]
 *                       example: DARK
 *   patch:
 *     summary: Update account preferences (theme)
 *     description: Saves the theme on the account so it applies on every device the user signs in from. Case-insensitive.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [theme]
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [LIGHT, DARK, SYSTEM]
 *                 example: DARK
 *     responses:
 *       200:
 *         description: Preferences updated
 *       400:
 *         description: Invalid theme value
 */
router.get("/preferences", authMiddleware, profileController.getPreferences);
router.patch("/preferences", authMiddleware, validateRequest(updatePreferencesSchema), profileController.updatePreferences);

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
 *     description: >
 *       Public profile. `receivedEndorsements` lists visible endorsements, newest first, each with
 *       `type` (SKILL or TESTIMONIAL), `skill`, `rating`, `content`, `project` ({ id, name }, or null
 *       for private projects) and `endorser` ({ id, displayName, firstName, lastName, avatarUrl, role }).
 *       `stats` holds { completedProjects, connections, endorsements }; completedProjects counts public
 *       completed projects the user owned or collaborated on.
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
 *     summary: Endorse a collaborator for a skill
 *     description: >
 *       Endorse a user for one of the skills on their profile. Both users must be active
 *       collaborators on `projectId` (the project does not need to be completed). One endorsement
 *       per endorser, recipient, project and skill. Errors include a stable `code`.
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
 *               - skill
 *               - projectId
 *             properties:
 *               skill:
 *                 type: string
 *                 description: Must match one of the recipient's profile skills (case-insensitive).
 *               projectId:
 *                 type: string
 *               content:
 *                 type: string
 *                 maxLength: 600
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Endorsement added successfully
 *       400:
 *         description: Validation failed, self-endorsement (SELF_ENDORSEMENT), skill not on profile (SKILL_NOT_ON_PROFILE)
 *       403:
 *         description: Not both active collaborators on the project (NOT_PROJECT_COLLABORATORS)
 *       404:
 *         description: User or project not found (USER_NOT_FOUND, PROJECT_NOT_FOUND)
 *       409:
 *         description: Duplicate endorsement (DUPLICATE_ENDORSEMENT)
 *       429:
 *         description: More than 10 endorsements in an hour (RATE_LIMITED)
 */
router.post(
  "/:userId/endorsements",
  authMiddleware,
  endorsementRateLimit,
  validateRequest(addEndorsementSchema),
  profileController.addEndorsement
);

/**
 * @swagger
 * /api/v1/user/profile/{userId}/shared-projects:
 *   get:
 *     summary: Projects you share with a user
 *     description: >
 *       Projects (not deleted) on which the caller and the user are both active collaborators.
 *       Use it to decide whether to show the Endorse and Testimonial buttons. Returns an empty
 *       array when viewing your own profile.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shared projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [ACTIVE, COMPLETED, INACTIVE]
 *                   completedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   canLeaveTestimonial:
 *                     type: boolean
 *                     description: True when the project is completed.
 */
router.get("/:userId/shared-projects", authMiddleware, profileController.getSharedProjects);

/**
 * @swagger
 * /api/v1/user/profile/endorsements/{endorsementId}:
 *   patch:
 *     summary: Edit your endorsement or testimonial
 *     description: >
 *       The endorser can change `content` and `rating`; the skill and project cannot change.
 *       Testimonials keep their 20–600 character limit; ratings are only allowed on testimonials.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: endorsementId
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
 *                 maxLength: 600
 *                 nullable: true
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Endorsement updated
 *       400:
 *         description: Validation failed (RATING_NOT_ALLOWED, CONTENT_TOO_SHORT)
 *       403:
 *         description: Not the endorser (NOT_ENDORSER)
 *       404:
 *         description: Endorsement not found (ENDORSEMENT_NOT_FOUND)
 *   delete:
 *     summary: Withdraw your endorsement or testimonial
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: endorsementId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Endorsement withdrawn
 *       403:
 *         description: Not the endorser (NOT_ENDORSER)
 *       404:
 *         description: Endorsement not found (ENDORSEMENT_NOT_FOUND)
 */
router.patch(
  "/endorsements/:endorsementId",
  authMiddleware,
  validateRequest(updateEndorsementSchema),
  profileController.updateEndorsement
);
router.delete("/endorsements/:endorsementId", authMiddleware, profileController.deleteEndorsement);

/**
 * @swagger
 * /api/v1/user/profile/endorsements/{endorsementId}/visibility:
 *   patch:
 *     summary: Hide or show an endorsement on your profile
 *     description: Only the recipient can change this. Hidden endorsements are left out of the public profile, portfolio and counts.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: endorsementId
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
 *               - hidden
 *             properties:
 *               hidden:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Visibility updated
 *       403:
 *         description: Not the recipient (NOT_RECIPIENT)
 *       404:
 *         description: Endorsement not found (ENDORSEMENT_NOT_FOUND)
 */
router.patch(
  "/endorsements/:endorsementId/visibility",
  authMiddleware,
  validateRequest(endorsementVisibilitySchema),
  profileController.setEndorsementVisibility
);

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
 *     summary: Leave a testimonial for a collaborator on a completed project
 *     description: >
 *       Both users must be active collaborators on the project and the project must be completed.
 *       One testimonial per endorser, recipient and project. Errors include a stable `code`.
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
 *             required:
 *               - recipientId
 *               - content
 *             properties:
 *               recipientId:
 *                 type: string
 *               content:
 *                 type: string
 *                 minLength: 20
 *                 maxLength: 600
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Testimonial added successfully
 *       400:
 *         description: Validation failed, self-endorsement (SELF_ENDORSEMENT)
 *       403:
 *         description: Not both active collaborators on the project (NOT_PROJECT_COLLABORATORS), or project not completed (PROJECT_NOT_COMPLETED)
 *       404:
 *         description: User or project not found (USER_NOT_FOUND, PROJECT_NOT_FOUND)
 *       409:
 *         description: Duplicate endorsement (DUPLICATE_ENDORSEMENT)
 *       429:
 *         description: More than 10 endorsements in an hour (RATE_LIMITED)
 */
router.post(
  "/portfolio/:projectId/endorsements",
  authMiddleware,
  endorsementRateLimit,
  validateRequest(projectEndorsementSchema),
  profileController.addProjectEndorsement
);

module.exports = router;
