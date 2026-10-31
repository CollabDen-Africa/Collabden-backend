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
 *     description: >
 *       Verifies the authenticated user's NIN against NIMC (via Ninja).
 *       Enforces: one NIN per account (hashed + unique), max 3 attempts per 24h,
 *       and rejects duplicate-NIN or already-verified callers BEFORE charging a
 *       NIMC lookup. First and last name are read from the user's profile — not
 *       accepted in the body — so profile edits are the only way to correct them.
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nin, dateOfBirth]
 *             properties:
 *               nin:
 *                 type: string
 *                 description: 11-digit NIN (non-digit characters are stripped).
 *                 example: "77777777777"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1995-01-01"
 *     responses:
 *       200:
 *         description: Verification processed. `verified` reflects whether NIMC accepted the details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified: { type: boolean }
 *                 code:
 *                   type: string
 *                   description: Present when verified is false (e.g. DETAILS_MISMATCH).
 *                 attemptsRemaining:
 *                   type: integer
 *                   description: Remaining attempts in the current 24h window.
 *       400:
 *         description: INVALID_INPUT or PROFILE_INCOMPLETE
 *       401:
 *         description: UNAUTHORIZED
 *       409:
 *         description: ALREADY_VERIFIED or NIN_ALREADY_LINKED
 *       429:
 *         description: RATE_LIMITED — includes `attemptsRemaining` (0) and `retryAfter` (seconds).
 *       502:
 *         description: SERVICE_UNAVAILABLE — upstream NIMC/Ninja error.
 *       500:
 *         description: SERVICE_UNAVAILABLE — unexpected server error.
 */
router.post("/identify", authMiddleware, identifyUser);

module.exports = router;
