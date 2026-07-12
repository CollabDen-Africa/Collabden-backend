const express = require('express');
const { handleWebhook } = require('../controllers/persona.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Persona
 *   description: Endpoints for Persona identity verification integrations
 */

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
