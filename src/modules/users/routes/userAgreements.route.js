const { Router } = require("express");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const { getUserAgreementsHandler } = require("../../projects/controllers/agreement.controller");

const router = Router();

/**
 * @swagger
 * /api/v1/user/agreements:
 *   get:
 *     summary: Get all agreements for the authenticated user across their projects with pagination
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: User's agreements fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", authMiddleware, getUserAgreementsHandler);

module.exports = router;
