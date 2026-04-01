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
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
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
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
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
 *               - verificationToken
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified
 */
router.post("/verify", authController.verifyEmail);

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
module.exports = router;