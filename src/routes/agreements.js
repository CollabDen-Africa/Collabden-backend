const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth.middleware');
const { requireProjectAccess } = require('../middleware/projectAccess');
const {
  uploadAgreementHandler,
  getAgreementsHandler,
  updateAgreementStatusHandler,
  uploadSignedAgreementHandler,
  esignAgreementHandler,
  editAgreementHandler,
  downloadAgreementHandler,
} = require('../modules/projects/controllers/agreement.controller');

const router = express.Router({ mergeParams: true });

// Configure Multer (memory storage, 10MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Middleware for Multer error handling
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: "Unexpected field for upload." });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: "An unknown error occurred during upload." });
    }
    next();
  });
};

// POST route to upload initial draft agreement
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements:
 *   post:
 *     summary: Upload a new draft agreement document (PDF)
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to upload to
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The PDF agreement file to upload
 *     responses:
 *       201:
 *         description: Agreement uploaded successfully
 *       400:
 *         description: Missing required file
 *       403:
 *         description: Plan limit reached (free tier)
 */
router.post(
  '/:projectId/agreements',
  authMiddleware,
  requireProjectAccess,
  handleUpload,
  uploadAgreementHandler
);

// GET route to list all agreements in a project
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements:
 *   get:
 *     summary: Get all agreement documents for a project
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *     responses:
 *       200:
 *         description: List of agreements fetched successfully
 */
router.get(
  '/:projectId/agreements',
  authMiddleware,
  requireProjectAccess,
  getAgreementsHandler
);

// PUT route to edit/replace an agreement
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}:
 *   put:
 *     summary: Edit or replace an agreement document before it is signed
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Agreement updated successfully
 *       400:
 *         description: Cannot edit a signed agreement
 *       403:
 *         description: Only owner can edit
 */
router.put(
  '/:projectId/agreements/:id',
  authMiddleware,
  requireProjectAccess,
  handleUpload,
  editAgreementHandler
);

// PATCH route to manually update status (e.g., from DRAFT to PENDING_SIGNATURE)
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/status:
 *   patch:
 *     summary: Update an agreement's status manually
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
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
 *                 enum: [PENDING_SIGNATURE, SIGNED]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status transition
 */
router.patch(
  '/:projectId/agreements/:id/status',
  authMiddleware,
  requireProjectAccess,
  updateAgreementStatusHandler
);

// POST route to upload a signed agreement document and lock it
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/sign:
 *   post:
 *     summary: Upload a signed agreement document copy manually
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Signed agreement uploaded and locked
 *       400:
 *         description: Agreement already signed
 *       403:
 *         description: Unverified identity block
 */
router.post(
  '/:projectId/agreements/:id/sign',
  authMiddleware,
  requireProjectAccess,
  handleUpload,
  uploadSignedAgreementHandler
);

// POST route to electronically sign agreement inside the platform
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/esign:
 *   post:
 *     summary: Electronically sign an agreement directly on the platform
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
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
 *               - intentToSign
 *             properties:
 *               intentToSign:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agreement e-signed successfully
 *       400:
 *         description: Missing checkbox intent
 *       403:
 *         description: Identity verification or legal name required
 */
router.post(
  '/:projectId/agreements/:id/esign',
  authMiddleware,
  requireProjectAccess,
  esignAgreementHandler
);

// GET route to proxy-download an agreement file (keeps Supabase URL hidden)
/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{agreementId}/download:
 *   get:
 *     summary: Download an agreement file through the server (Supabase URL not exposed to client)
 *     description: >
 *       Proxies the agreement PDF through the server so the raw Supabase URL is never
 *       exposed to the client. The authenticated user's identity is resolved from the
 *       Bearer token — no user ID is needed in the URL.
 *       Access is granted only if the user is the project owner or an active collaborator.
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project this agreement belongs to
 *       - in: path
 *         name: agreementId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the agreement to download (NOT the user ID — user is identified via auth token)
 *     responses:
 *       200:
 *         description: PDF file stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: No access to this agreement
 *       404:
 *         description: Agreement or file not found
 */
router.get(
  '/:projectId/agreements/:id/download',
  authMiddleware,
  requireProjectAccess,
  downloadAgreementHandler
);

module.exports = router;
