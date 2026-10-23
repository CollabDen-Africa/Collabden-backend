const express = require("express");
const { identifyUser } = require("../controllers/kyc.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: KYC
 *   description: Identity verification via Ninja KYC
 */

/**
 * @swagger
 * /api/v1/user/kyc/identify:
 *   post:
 *     summary: Verify user identity via Ninja KYC
 *     description: Submits the user's NIN and personal details to the Ninja KYC service for identity verification. Updates the user's identityVerified status on success.
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nin
 *               - firstName
 *               - lastName
 *               - dateOfBirth
 *             properties:
 *               nin:
 *                 type: string
 *                 example: "77777777777"
 *               firstName:
 *                 type: string
 *                 example: "Jane"
 *               lastName:
 *                 type: string
 *                 example: "Johnson"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1975-01-01"
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [verified, failed]
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Ninja KYC service error
 *       500:
 *         description: Internal server error
 */
router.post("/identify", authMiddleware, identifyUser);

module.exports = router;
