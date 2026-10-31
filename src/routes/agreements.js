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
  getAgreementPermissionsHandler,
  updateAgreementPermissionHandler,
} = require('../modules/projects/controllers/agreement.controller');

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected field for upload.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: 'An unknown error occurred during upload.' });
    }
    next();
  });
};


/**
 * @swagger
 * components:
 *   schemas:
 *     AgreementSignature:
 *       type: object
 *       description: A record of one signer's electronic or manual signature on an agreement.
 *       properties:
 *         id:
 *           type: string
 *           example: clx1abc000001
 *         agreementId:
 *           type: string
 *           example: clx1abc000002
 *         userId:
 *           type: string
 *           example: clx1abc000003
 *         legalName:
 *           type: string
 *           description: The signer's government-verified legal name at the time of signing.
 *           example: "Jane Adeyemi"
 *         signedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-10-23T14:00:00.000Z"
 *
 *     Agreement:
 *       type: object
 *       description: >
 *         A legal agreement document attached to a project. Lifecycle:
 *         DRAFT → PENDING_SIGNATURE → SIGNED. EXPIRED can be set on any
 *         non-locked agreement once its expiresAt date passes.
 *       properties:
 *         id:
 *           type: string
 *           example: clx1abc000002
 *         projectId:
 *           type: string
 *           example: clx1abc000004
 *         title:
 *           type: string
 *           example: "NDA — CollabDen Project Alpha"
 *         content:
 *           type: string
 *           nullable: true
 *           description: Optional plain-text content stored alongside the file.
 *         fileUrl:
 *           type: string
 *           nullable: true
 *           description: >
 *             A short-lived Supabase signed URL (1-hour TTL). Use the
 *             `/download` endpoint to get the actual file — do not cache this URL.
 *           example: "https://storage.supabase.co/..."
 *         filePath:
 *           type: string
 *           nullable: true
 *           description: Internal Supabase storage path. Not useful to the frontend.
 *         status:
 *           type: string
 *           enum: [DRAFT, PENDING_SIGNATURE, SIGNED, EXPIRED]
 *           example: PENDING_SIGNATURE
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Optional expiry date. Set via the edit endpoint.
 *           example: "2027-01-01T00:00:00.000Z"
 *         auditMetadata:
 *           type: object
 *           nullable: true
 *           description: >
 *             Populated when the agreement is signed. Contains lockedAt timestamp,
 *             actionType, signerName, signerId, projectId.
 *         signatures:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AgreementSignature'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     AgreementWithProject:
 *       allOf:
 *         - $ref: '#/components/schemas/Agreement'
 *         - type: object
 *           properties:
 *             awaitingMySignature:
 *               type: boolean
 *               description: >
 *                 True when the agreement is PENDING_SIGNATURE and the authenticated
 *                 user has not yet signed it. Use this to drive "Sign now" CTAs in
 *                 the user's Legal Agreements Overview.
 *               example: true
 *             project:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 collaborators:
 *                   type: array
 *                   description: Active collaborators on this project.
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           displayName:
 *                             type: string
 *                             nullable: true
 *                           legalName:
 *                             type: string
 *                             nullable: true
 *                           firstName:
 *                             type: string
 *                             nullable: true
 *                           lastName:
 *                             type: string
 *                             nullable: true
 *                           avatarUrl:
 *                             type: string
 *                             nullable: true
 *
 *     AgreementPermission:
 *       type: object
 *       description: >
 *         Per-collaborator permission override for a specific agreement.
 *         When a record does not exist for a user, defaults apply:
 *         canView=true, canSign=true, canEdit=false (edit is owner-only by default).
 *       properties:
 *         id:
 *           type: string
 *         agreementId:
 *           type: string
 *         userId:
 *           type: string
 *         canView:
 *           type: boolean
 *           description: Whether the user can see and download the agreement.
 *           example: true
 *         canSign:
 *           type: boolean
 *           description: Whether the user is permitted to sign the agreement.
 *           example: false
 *         canEdit:
 *           type: boolean
 *           description: Whether the user can edit the agreement while it is not yet signed.
 *           example: false
 *         user:
 *           type: object
 *           description: Basic profile of the collaborator this record applies to.
 *           properties:
 *             id:
 *               type: string
 *             displayName:
 *               type: string
 *               nullable: true
 *             legalName:
 *               type: string
 *               nullable: true
 *             avatarUrl:
 *               type: string
 *               nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: Total number of matching records.
 *           example: 42
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         totalPages:
 *           type: integer
 *           example: 5
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Agreement not found."
 */

// ─── POST /projects/:projectId/agreements ────────────────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements:
 *   post:
 *     summary: Upload a new agreement document
 *     description: >
 *       Uploads a PDF, DOC, or DOCX file and creates an agreement record in
 *       **DRAFT** status. Free-tier accounts are limited to 3 agreements per project.
 *
 *
 *       **Who can call this:** Any authenticated user with access to the project
 *       (owner or active collaborator).
 *
 *
 *       After a successful upload all project collaborators receive an in-app
 *       notification.
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the project to attach the agreement to.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: >
 *                   The agreement file. Accepted types: PDF, DOC, DOCX.
 *                   Maximum size: 10 MB. The original filename becomes the agreement title.
 *     responses:
 *       201:
 *         description: Agreement created successfully in DRAFT status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   $ref: '#/components/schemas/Agreement'
 *             example:
 *               agreement:
 *                 id: "clx1abc000002"
 *                 projectId: "clx1abc000004"
 *                 title: "NDA.pdf"
 *                 status: "DRAFT"
 *                 fileUrl: "https://storage.supabase.co/..."
 *                 filePath: "clx1abc000004/clx1abc000003-1729123456789.pdf"
 *                 expiresAt: null
 *                 auditMetadata: null
 *                 signatures: []
 *                 createdAt: "2026-10-23T10:00:00.000Z"
 *                 updatedAt: "2026-10-23T10:00:00.000Z"
 *       400:
 *         description: No file included in the request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "No file uploaded."
 *       403:
 *         description: Free-tier agreement limit reached (max 3 per project).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Free plan limit reached. Upgrade for unlimited uploads."
 *       401:
 *         description: Missing or invalid auth token.
 */
router.post(
  '/:projectId/agreements',
  authMiddleware,
  requireProjectAccess,
  handleUpload,
  uploadAgreementHandler
);

// ─── GET /projects/:projectId/agreements ─────────────────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements:
 *   get:
 *     summary: List all agreements for a project
 *     description: >
 *       Returns every agreement attached to the project, newest first.
 *       Each item includes its signatures array and a fresh signed `fileUrl`
 *       (1-hour TTL — do not cache it). To actually download the file use
 *       `GET /agreements/{id}/download`.
 *
 *
 *       **Who can call this:** Owner or any active collaborator of the project.
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agreements returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreements:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agreement'
 *       401:
 *         description: Missing or invalid auth token.
 *       403:
 *         description: Authenticated user is not a member of this project.
 *       404:
 *         description: Project not found.
 */
router.get(
  '/:projectId/agreements',
  authMiddleware,
  requireProjectAccess,
  getAgreementsHandler
);

// ─── PUT /projects/:projectId/agreements/:id ─────────────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}:
 *   put:
 *     summary: Edit an agreement (title, content, file, or expiry date)
 *     description: >
 *       Updates a DRAFT or PENDING_SIGNATURE agreement. Cannot be called on a
 *       SIGNED agreement — those are permanently locked.
 *
 *
 *       **Who can call this:** Project owner by default. A collaborator may edit if
 *       an `AgreementPermission` record with `canEdit: true` exists for them
 *       (set via `PUT /agreements/{id}/permissions`).
 *
 *
 *       All fields are optional — send only the ones you want to change.
 *       To replace the file, include a new `file` in the form data.
 *       To set an expiry date send `expiresAt` as an ISO 8601 string.
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
 *         description: ID of the agreement to edit.
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: New display title for the agreement.
 *                 example: "Revised NDA — Oct 2026"
 *               content:
 *                 type: string
 *                 description: Optional plain-text content to store alongside the file.
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 expiry date. Leave blank to keep the current value.
 *                 example: "2027-06-01T00:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PENDING_SIGNATURE]
 *                 description: >
 *                   You may move the agreement back to DRAFT or forward to
 *                   PENDING_SIGNATURE via this field. SIGNED cannot be set here —
 *                   use the `/sign` or `/esign` endpoints.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Replacement file (PDF, DOC, DOCX, max 10 MB).
 *     responses:
 *       200:
 *         description: Agreement updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Agreement updated successfully."
 *                 agreement:
 *                   $ref: '#/components/schemas/Agreement'
 *       400:
 *         description: >
 *           Agreement is already SIGNED and cannot be edited, or an attempt
 *           was made to set status to SIGNED through this endpoint.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Cannot edit a signed agreement."
 *       403:
 *         description: Caller does not have edit permission on this agreement.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Only the project owner or authorized users can edit agreements."
 *       404:
 *         description: Agreement not found.
 */
router.put(
  '/:projectId/agreements/:id',
  authMiddleware,
  requireProjectAccess,
  handleUpload,
  editAgreementHandler
);

// ─── PATCH /projects/:projectId/agreements/:id/status ────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/status:
 *   patch:
 *     summary: Advance an agreement's status (owner only)
 *     description: >
 *       Moves a DRAFT agreement to **PENDING_SIGNATURE**, signalling to
 *       collaborators that it is ready to be reviewed and signed.
 *
 *
 *       **Allowed transitions:**
 *       - `DRAFT` → `PENDING_SIGNATURE`
 *
 *       All other transitions are blocked here intentionally:
 *       - To reach `SIGNED` use `POST /agreements/{id}/sign` (upload signed copy)
 *         or `POST /agreements/{id}/esign` (electronic signature).
 *       - `PENDING_SIGNATURE` cannot be reversed through this endpoint.
 *
 *
 *       **Who can call this:** Project owner only. Collaborators will receive an
 *       in-app notification when the status changes to PENDING_SIGNATURE.
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
 *         description: ID of the agreement to advance.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING_SIGNATURE]
 *                 description: Target status. Only PENDING_SIGNATURE is accepted here.
 *                 example: "PENDING_SIGNATURE"
 *     responses:
 *       200:
 *         description: Status advanced successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   $ref: '#/components/schemas/Agreement'
 *       400:
 *         description: >
 *           Invalid transition (e.g. trying to set SIGNED, or agreement
 *           is already SIGNED or EXPIRED).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Invalid status transition from DRAFT to SIGNED."
 *       403:
 *         description: Only the project owner can update agreement status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Only the project owner can update agreement status."
 *       404:
 *         description: Agreement not found.
 */
router.patch(
  '/:projectId/agreements/:id/status',
  authMiddleware,
  requireProjectAccess,
  updateAgreementStatusHandler
);

// ─── POST /projects/:projectId/agreements/:id/sign ───────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/sign:
 *   post:
 *     summary: Upload a physically signed agreement copy (contributes one signature)
 *     description: >
 *       Use this when a collaborator has physically signed the document (e.g.
 *       printed, signed, and scanned it). Uploading the signed copy atomically:
 *       1. Replaces the stored file with the signed version.
 *       2. Creates an `AgreementSignature` record using the caller's verified legal name.
 *       3. Recomputes the required-signer set (project owner + every active, ACCEPTED
 *          collaborator) and compares it to signatures recorded so far.
 *       4. If every required signer has now signed, flips status to **SIGNED**
 *          (locked — no further edits or file replacements), emails a copy of the
 *          signed PDF to all collaborators, and fires the `AGREEMENT_SIGNED` event.
 *          Otherwise status stays **PENDING_SIGNATURE** and only an activity-log
 *          entry (`AGREEMENT_SIGNATURE_ADDED`) is written — no completion email.
 *
 *
 *       **Who can call this:** Any active project collaborator whose account has:
 *       - Identity verified (`identityVerified: true`) via government ID / NIN.
 *       - A `legalName` set on their profile.
 *       - Not already signed this agreement.
 *       - `canSign: true` on their `AgreementPermission` record for this agreement
 *         (if no record exists, signing is allowed by default).
 *
 *
 *       Once the agreement is SIGNED further calls return 400. The stored file is
 *       preserved across intermediate signatures — editing or replacing it is
 *       blocked by `editAgreement` as soon as any signature exists.
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
 *         description: ID of the agreement to lock as signed.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: >
 *                   The signed document. Accepted types: PDF, DOC, DOCX.
 *                   Max 10 MB. This replaces the previous file stored for this agreement.
 *     responses:
 *       200:
 *         description: >
 *           Signature recorded. If this was the final required signer, status is now
 *           SIGNED and collaborators have been notified; otherwise status remains
 *           PENDING_SIGNATURE until the remaining signers sign.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   $ref: '#/components/schemas/Agreement'
 *       400:
 *         description: Agreement already SIGNED or caller has already signed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alreadyLocked:
 *                 summary: Agreement already fully signed
 *                 value:
 *                   error: "Agreement is already signed and locked."
 *               userAlreadySigned:
 *                 summary: Caller already signed
 *                 value:
 *                   error: "You have already signed this agreement."
 *       403:
 *         description: >
 *           Caller has not completed identity verification or does not have
 *           sign permission on this agreement.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               identityNotVerified:
 *                 summary: Identity not verified
 *                 value:
 *                   error: "Identity verification (via government ID/NIN) and completed profile (full legal name) are required to sign agreements."
 *               permissionDenied:
 *                 summary: Permission denied
 *                 value:
 *                   error: "You do not have permission to sign this agreement."
 *       404:
 *         description: Agreement not found.
 */
router.post(
  '/:projectId/agreements/:id/sign',
  authMiddleware,
  requireProjectAccess,
  handleUpload,
  uploadSignedAgreementHandler
);

// ─── POST /projects/:projectId/agreements/:id/esign ──────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/esign:
 *   post:
 *     summary: Electronically sign an agreement in-platform
 *     description: >
 *       Records an electronic signature without requiring a file upload.
 *       The platform uses the caller's verified `legalName` as the signature.
 *       Signing atomically:
 *       1. Creates an `AgreementSignature` record.
 *       2. Recomputes the required-signer set (project owner + every active,
 *          ACCEPTED collaborator) against the signatures recorded so far.
 *       3. If every required signer has now signed, flips status to **SIGNED**
 *          (locked), emails a copy of the signed PDF to all collaborators, and
 *          fires the `AGREEMENT_SIGNED` event. Otherwise status stays
 *          **PENDING_SIGNATURE** and only an activity-log entry
 *          (`AGREEMENT_SIGNATURE_ADDED`) is written — no completion email.
 *
 *
 *       Adding a new collaborator to the project while status is
 *       PENDING_SIGNATURE automatically adds them to the required-signer set, so
 *       the agreement will not lock until they also sign. Collaborators added
 *       after the agreement is already SIGNED are not retroactively required —
 *       issue a new agreement for them.
 *
 *
 *       **UI note:** Show the caller's `legalName` in a preview before they
 *       submit so they can confirm it is correct. The `intentToSign` boolean
 *       represents the consent checkbox the user must tick before submitting.
 *
 *
 *       **Who can call this:** Any active project collaborator whose account has:
 *       - Identity verified (`identityVerified: true`) via government ID / NIN.
 *       - A `legalName` set on their profile.
 *       - Not already signed this agreement.
 *       - `canSign: true` on their `AgreementPermission` record (default: allowed).
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
 *         description: ID of the agreement to electronically sign.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [intentToSign]
 *             properties:
 *               intentToSign:
 *                 type: boolean
 *                 description: >
 *                   Must be `true`. Represents the user ticking the consent checkbox
 *                   confirming they intend to electronically sign. The request is
 *                   rejected if this is `false` or omitted.
 *                 example: true
 *     responses:
 *       200:
 *         description: >
 *           Signature recorded. If this was the final required signer, status is
 *           now SIGNED and collaborators have been notified via email and in-app
 *           notification; otherwise status remains PENDING_SIGNATURE until the
 *           remaining signers sign.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Agreement successfully e-signed."
 *                 agreement:
 *                   $ref: '#/components/schemas/Agreement'
 *       400:
 *         description: Consent checkbox not checked, agreement already SIGNED, or user already signed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               noConsent:
 *                 summary: Consent checkbox missing
 *                 value:
 *                   error: "You must check the box to indicate your intent to sign."
 *               alreadySigned:
 *                 summary: Agreement already fully signed
 *                 value:
 *                   error: "Agreement is already fully signed and locked."
 *               userAlreadySigned:
 *                 summary: User already signed
 *                 value:
 *                   error: "You have already signed this agreement."
 *       403:
 *         description: Identity not verified or sign permission denied.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               identityNotVerified:
 *                 summary: Identity not verified
 *                 value:
 *                   error: "Identity verification (via government ID/NIN) and completed profile (full legal name) are required to sign agreements."
 *               permissionDenied:
 *                 summary: Permission denied
 *                 value:
 *                   error: "You do not have permission to sign this agreement."
 *       404:
 *         description: Agreement or user not found.
 */
router.post(
  '/:projectId/agreements/:id/esign',
  authMiddleware,
  requireProjectAccess,
  esignAgreementHandler
);

// ─── GET /projects/:projectId/agreements/:id/download ────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/download:
 *   get:
 *     summary: Download the agreement file as a PDF
 *     description: >
 *       Proxies the agreement file from Supabase storage and streams it to the
 *       client as `application/pdf` with a `Content-Disposition: attachment` header.
 *       The raw Supabase URL is never exposed to the client.
 *
 *
 *       **Use this endpoint — not `fileUrl`** — whenever you need the actual
 *       file bytes (preview, download button). The `fileUrl` field on the
 *       agreement object is a short-lived signed URL suitable only for
 *       in-browser preview `<iframe>`/`<object>` tags, not for reliable downloads.
 *
 *
 *       **Who can call this:** Project owner or any active collaborator, subject
 *       to their `canView` permission (`true` by default).
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
 *         description: ID of the agreement to download.
 *     responses:
 *       200:
 *         description: PDF file bytes streamed to the client.
 *         headers:
 *           Content-Disposition:
 *             description: e.g. `attachment; filename="NDA.pdf"`
 *             schema:
 *               type: string
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: application/pdf
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: >
 *           Caller is not a member of the project, or their `canView`
 *           permission has been explicitly set to false.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notMember:
 *                 value:
 *                   error: "You do not have access to this agreement."
 *               viewBlocked:
 *                 value:
 *                   error: "You do not have permission to view this agreement."
 *       404:
 *         description: Agreement not found or no file attached yet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notFound:
 *                 value:
 *                   error: "Agreement not found."
 *               noFile:
 *                 value:
 *                   error: "No file attached to this agreement."
 *       502:
 *         description: Failed to retrieve the file from storage.
 */
router.get(
  '/:projectId/agreements/:id/download',
  authMiddleware,
  requireProjectAccess,
  downloadAgreementHandler
);

// ─── GET /projects/:projectId/agreements/:id/permissions ─────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/permissions:
 *   get:
 *     summary: Get per-collaborator permission overrides for an agreement
 *     description: >
 *       Returns all explicit `AgreementPermission` records for this agreement.
 *       Only collaborators who have been given a non-default permission appear here —
 *       the absence of a record means the collaborator has the defaults
 *       (`canView: true`, `canSign: true`, `canEdit: false`).
 *
 *
 *       Use this to build a permission management UI where the project owner
 *       can see and adjust who can view, sign, or edit each agreement.
 *
 *
 *       **Who can call this:** Project owner only.
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
 *         description: ID of the agreement.
 *     responses:
 *       200:
 *         description: Permission records returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AgreementPermission'
 *             example:
 *               permissions:
 *                 - id: "clxperm0001"
 *                   agreementId: "clx1abc000002"
 *                   userId: "clxuser0001"
 *                   canView: true
 *                   canSign: false
 *                   canEdit: false
 *                   user:
 *                     id: "clxuser0001"
 *                     displayName: "Emeka O."
 *                     legalName: "Emeka Okafor"
 *                     avatarUrl: null
 *       403:
 *         description: Only the project owner can view agreement permissions.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Only the project owner can manage agreement permissions."
 *       404:
 *         description: Agreement not found.
 */
router.get(
  '/:projectId/agreements/:id/permissions',
  authMiddleware,
  requireProjectAccess,
  getAgreementPermissionsHandler
);

// ─── PUT /projects/:projectId/agreements/:id/permissions ─────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/agreements/{id}/permissions:
 *   put:
 *     summary: Set or update a collaborator's permissions on an agreement
 *     description: >
 *       Creates or updates an `AgreementPermission` record for a single
 *       collaborator. This is an **upsert** — calling it again with the same
 *       `userId` updates the existing record rather than creating a duplicate.
 *
 *
 *       **Defaults when no record exists:**
 *       - `canView: true` — collaborator can see and download the agreement
 *       - `canSign: true` — collaborator may sign (still requires identity verification)
 *       - `canEdit: false` — only the project owner can edit by default
 *
 *
 *       Send only the boolean fields you want to change. Omitted fields are
 *       left at their current value (or the default on first creation).
 *
 *
 *       **Who can call this:** Project owner only. The `userId` must belong
 *       to an active collaborator on this project.
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
 *         description: ID of the agreement to update permissions on.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the collaborator whose permissions to set.
 *                 example: "clxuser0001"
 *               canView:
 *                 type: boolean
 *                 description: >
 *                   Set to `false` to hide this agreement from the collaborator
 *                   entirely (blocks download too).
 *                 example: true
 *               canSign:
 *                 type: boolean
 *                 description: >
 *                   Set to `false` to prevent this collaborator from signing.
 *                   Note: identity verification is still required for those who can sign.
 *                 example: false
 *               canEdit:
 *                 type: boolean
 *                 description: >
 *                   Set to `true` to allow this collaborator to edit the agreement
 *                   while it is in DRAFT or PENDING_SIGNATURE status.
 *                 example: false
 *           example:
 *             userId: "clxuser0001"
 *             canSign: false
 *     responses:
 *       200:
 *         description: Permission record created or updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Permission updated."
 *                 permission:
 *                   $ref: '#/components/schemas/AgreementPermission'
 *       400:
 *         description: >
 *           `userId` was not provided, or the target user is not an active
 *           collaborator on this project.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingUserId:
 *                 summary: userId not provided
 *                 value:
 *                   error: "userId of the target collaborator is required."
 *               notCollaborator:
 *                 summary: User is not a collaborator
 *                 value:
 *                   error: "Target user is not an active collaborator on this project."
 *       403:
 *         description: Only the project owner can manage agreement permissions.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Only the project owner can manage agreement permissions."
 *       404:
 *         description: Agreement not found.
 */
router.put(
  '/:projectId/agreements/:id/permissions',
  authMiddleware,
  requireProjectAccess,
  updateAgreementPermissionHandler
);

module.exports = router;
