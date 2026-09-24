const { Router } = require("express");
const { authController } = require("../controllers/index");

const validateRequest = require("../../../middleware/validateRequest");
const { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require("../../../schemas/auth.schema");
const { authMiddleware } = require("../../../middleware/auth.middleware");

const router = Router();

/**
 * @swagger
 * /api/v1/user/signup:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Creates an unverified account and sends an email verification code.
 *       `phone`, `dob`, `stageName`, `agreedToTerms`, and `dobVerified` may be
 *       required depending on the current platform registration settings. The
 *       selected `intent` is checked against buyer and seller registration availability.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Must contain at least one uppercase letter and one number.
 *               phone:
 *                 type: string
 *                 description: Phone number. Required when phone registration is enabled in platform settings.
 *               dob:
 *                 type: string
 *                 format: date
 *                 description: Date of birth. Required when date-of-birth collection is enabled in platform settings.
 *               stageName:
 *                 type: string
 *                 description: Public or professional name. Required when stage-name collection is enabled in platform settings.
 *               agreedToTerms:
 *                 type: boolean
 *                 description: Must be true when acceptance of the Terms of Service is required in platform settings.
 *               dobVerified:
 *                 type: boolean
 *                 description: Must be true when age verification is required in platform settings.
 *               intent:
 *                 type: string
 *                 enum: [buyer, seller, both]
 *                 description: Intended marketplace role. Its availability is controlled by platform settings.
 *             example:
 *               firstName: Jane
 *               lastName: Doe
 *               email: jane@example.com
 *               password: SecurePass1
 *               phone: "+2348012345678"
 *               dob: "1995-06-15"
 *               stageName: Jane D
 *               agreedToTerms: true
 *               dobVerified: true
 *               intent: both
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Bad request
 */
router.post("/signup", validateRequest(signupSchema), authController.SignUp);

/**
 * @swagger
 * /api/v1/user/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Unauthorized
 */
router.post("/login", validateRequest(loginSchema), authController.Login);

/**
 * @swagger
 * /api/v1/user/profile:
 *   get:
 *     summary: Get user profile
 *     description: Returns the authenticated normal-user profile. Send the application JWT received after login or Google OAuth in the Authorization header. Admin tokens are not accepted.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Missing, expired, future-issued, invalid, admin, or revoked user token
 */
router.get("/profile", authMiddleware, authController.profile);

/**
 * @swagger
 * /api/v1/user/verify:
 *   post:
 *     summary: Verify user email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - verificationToken
 *             properties:
 *               email:
 *                 type: string
 *               verificationToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified
 */
router.post("/verify", authController.verifyEmail);

/**
 * @swagger
 * /api/v1/user/resend-verify:
 *   post:
 *     summary: Resend verification code to user email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification code resent successfully
 *       400:
 *         description: Bad request
 */
router.post("/resend-verify", authController.resendVerificationEmail);

/**
 * @swagger
 * /api/v1/user/forgot-password:
 *   post:
 *     summary: Forgot password request
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Recovery email sent
 */
router.post("/forgot-password", validateRequest(forgotPasswordSchema), authController.forgotPassword);

/**
 * @swagger
 * /api/v1/user/reset-password:
 *   post:
 *     summary: Reset password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - token
 *             properties:
 *               password:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post("/reset-password", validateRequest(resetPasswordSchema), authController.resetPassword);
/**
 * @swagger
 * /api/v1/user/auth/google:
 *   get:
 *     summary: Redirects to Google Auth Consent Screen
 *     description: Starts the Google OAuth authorization-code flow. The browser is redirected to Google and then back to the configured callback route.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth consent screen
 */
router.get("/auth/google", authController.googleLogin);

/**
 * @swagger
 * /api/v1/user/auth/google/callback:
 *   get:
 *     summary: Google Auth Callback URL
 *     description: Verifies the Google ID token, creates or links the local user, signs a normal-user application JWT, and redirects to the configured frontend callback. Do not call this endpoint from the frontend.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code returned by Google
 *     responses:
 *       302:
 *         description: Redirect to the frontend OAuth callback with a URL-encoded application token
 *         headers:
 *           Location:
 *             description: Frontend OAuth callback URL. The token query parameter is a browser handoff and must not be logged.
 *             schema:
 *               type: string
 *       400:
 *         description: Missing authorization code, failed Google verification, or missing frontend configuration
 */
router.get("/auth/google/callback", authController.googleCallback);

/**
 * @swagger
 * /api/v1/user/onboarding:
 *   patch:
 *     summary: Update user onboarding status
 *     description: Updates onboarding for the user identified by the normal-user bearer token.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - completed
 *             properties:
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Onboarding status updated successfully
 *       401:
 *         description: Missing, expired, invalid, or non-user bearer token
 */
router.patch(
  "/onboarding",
  authMiddleware,
  authController.updateOnboardingStatus
);

module.exports = router;
