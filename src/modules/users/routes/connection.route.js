const { Router } = require("express");
const {
  sendRequest,
  respondRequest,
  listConnections,
  listPendingRequests,
} = require("../controllers/connection.controller");
const { authMiddleware } = require("../../../middleware/auth.middleware");

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/users/connections/request:
 *   post:
 *     summary: Send a connection request
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *             properties:
 *               receiverId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request sent
 */
router.post("/request", sendRequest);

/**
 * @swagger
 * /api/v1/users/connections/request/{id}:
 *   put:
 *     summary: Respond to a connection request
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, REJECTED]
 *     responses:
 *       200:
 *         description: Responded successfully
 */
router.put("/request/:id", respondRequest);

/**
 * @swagger
 * /api/v1/users/connections:
 *   get:
 *     summary: List all accepted connections
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of connections
 */
router.get("/", listConnections);

/**
 * @swagger
 * /api/v1/users/connections/pending:
 *   get:
 *     summary: List all pending connection requests
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
 */
router.get("/pending", listPendingRequests);

module.exports = router;
