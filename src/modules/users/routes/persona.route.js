const express = require('express');
const { handleWebhook, createInquiry } = require('../controllers/persona.controller');
const { authMiddleware } = require('../../../middleware/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Persona
 *   description: Endpoints for Persona identity verification integrations
 */

/**
 * @swagger
 * /api/v1/user/persona/create-inquiry:
 *   post:
 *     summary: Create a Persona identity verification inquiry
 *     description: Creates a new Persona inquiry for the authenticated user and returns the session token needed to launch the Persona embedded SDK on the frontend.
 *     tags: [Persona]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Inquiry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inquiryId:
 *                   type: string
 *                 sessionToken:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error or service misconfiguration
 *       502:
 *         description: Upstream Persona API error
 */
router.post('/create-inquiry', authMiddleware, createInquiry);

/**
 * @swagger
 * /api/v1/user/persona/webhook:
 *   post:
 *     summary: Persona Webhook Handler
 *     description: Receives webhook events from Persona (e.g., inquiry.completed, inquiry.failed) to update user identity verification status.
 *     tags: [Persona]
 *     parameters:
 *       - in: header
 *         name: persona-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptographic signature provided by Persona to verify payload authenticity.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The raw JSON payload event sent by the Persona webhook.
 *     responses:
 *       200:
 *         description: Webhook received and processed successfully.
 *       400:
 *         description: Bad request formatting (e.g. not a raw buffer).
 *       401:
 *         description: Invalid or missing webhook signature.
 *       500:
 *         description: Internal server error.
 */
router.post('/webhook', handleWebhook);

module.exports = router;
