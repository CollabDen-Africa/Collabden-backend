const { Router } = require("express");
const { authMiddleware } = require("../../../middleware/auth.middleware");
const {
  getUserAgreementsHandler,
  getUserAgreementActivityHandler,
} = require("../../projects/controllers/agreement.controller");

const router = Router();

/**
 * @swagger
 * /api/v1/user/agreements:
 *   get:
 *     summary: List all agreements for the authenticated user across all their projects
 *     description: >
 *       Returns every agreement from projects where the authenticated user is either
 *       the **owner** or an **active collaborator**. This is the primary data source
 *       for the "Legal Agreements Overview" page on the user dashboard.
 *
 *
 *       **Key response fields to note:**
 *       - `awaitingMySignature` — `true` when the agreement is `PENDING_SIGNATURE`
 *         and the authenticated user has not yet signed it. Use this to render
 *         "Sign now" badges or CTAs.
 *       - `project.collaborators` — list of all active collaborators on that project
 *         so you can show "involved collaborators" without an extra request.
 *       - `fileUrl` — a 1-hour Supabase signed URL for in-browser preview only.
 *         For a reliable download button use `GET /projects/{projectId}/agreements/{id}/download`.
 *
 *
 *       **Filtering (all optional, combinable):**
 *       - `status` — exact match on agreement status enum value.
 *       - `projectName` — case-insensitive partial match on the project name.
 *       - `dateFrom` / `dateTo` — filter by `createdAt` date range (ISO 8601).
 *       - `collaboratorName` — case-insensitive partial match on any collaborator's
 *         display name or legal name within the project.
 *
 *
 *       **Sorting (`sortBy`):**
 *       - `createdAt` (default) — sort by creation date, direction controlled by `sortOrder`.
 *       - `updatedAt` — sort by last-updated date, direction controlled by `sortOrder`.
 *       - `oldest` — always ascending by `createdAt` (ignores `sortOrder`).
 *       - `newest` — always descending by `createdAt` (ignores `sortOrder`).
 *       - `pendingSignature` — places agreements with status `PENDING_SIGNATURE` at
 *         the top of the page, then the rest in descending `createdAt` order.
 *         Ignores `sortOrder`.
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number (1-based).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of agreements per page.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING_SIGNATURE, SIGNED, EXPIRED]
 *         description: Filter to only agreements with this status.
 *         example: PENDING_SIGNATURE
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Case-insensitive partial match on the project name.
 *         example: "Alpha"
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Return agreements created on or after this date (YYYY-MM-DD).
 *         example: "2026-01-01"
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Return agreements created on or before this date (YYYY-MM-DD).
 *         example: "2026-12-31"
 *       - in: query
 *         name: collaboratorName
 *         schema:
 *           type: string
 *         description: >
 *           Filter to agreements in projects that have a collaborator whose
 *           display name or legal name partially matches this value
 *           (case-insensitive). Applied after the database query.
 *         example: "Emeka"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, oldest, newest, pendingSignature]
 *           default: createdAt
 *         description: Sort strategy. See endpoint description for per-value behaviour.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: >
 *           Direction for `createdAt` and `updatedAt` sorts.
 *           Ignored when `sortBy` is `oldest`, `newest`, or `pendingSignature`.
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
 *                     $ref: '#/components/schemas/AgreementWithProject'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *             example:
 *               agreements:
 *                 - id: "clx1abc000002"
 *                   projectId: "clx1abc000004"
 *                   title: "NDA — Project Alpha"
 *                   status: "PENDING_SIGNATURE"
 *                   fileUrl: "https://storage.supabase.co/..."
 *                   expiresAt: null
 *                   auditMetadata: null
 *                   awaitingMySignature: true
 *                   signatures: []
 *                   project:
 *                     id: "clx1abc000004"
 *                     name: "Project Alpha"
 *                     collaborators:
 *                       - user:
 *                           id: "clxuser0002"
 *                           displayName: "Emeka O."
 *                           legalName: "Emeka Okafor"
 *                           avatarUrl: null
 *                   createdAt: "2026-10-20T10:00:00.000Z"
 *                   updatedAt: "2026-10-21T08:00:00.000Z"
 *               pagination:
 *                 total: 3
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 1
 *       401:
 *         description: Missing or invalid auth token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authMiddleware, getUserAgreementsHandler);

/**
 * @swagger
 * /api/v1/user/agreements/activity:
 *   get:
 *     summary: Get the authenticated user's personal agreement activity history
 *     description: >
 *       Returns a paginated list of agreement-related activity log entries from all
 *       projects the authenticated user belongs to (owned or collaborated on).
 *
 *
 *       Tracked actions:
 *       - `AGREEMENT_UPLOADED` — a new agreement was added to a project.
 *       - `AGREEMENT_EDITED` — an existing agreement was edited or its file replaced.
 *       - `AGREEMENT_SIGNED` — an agreement was signed (electronically or by upload).
 *       - `AGREEMENT_STATUS_UPDATED` — status transitioned (e.g. DRAFT → PENDING_SIGNATURE).
 *       - `AGREEMENT_PERMISSION_UPDATED` — a collaborator's permissions were changed.
 *
 *
 *       Results are ordered newest-first. Use this to power the "Activity History"
 *       tab on the user's Legal Agreements Overview page.
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number (1-based).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of activity entries per page.
 *     responses:
 *       200:
 *         description: Activity log returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       projectId:
 *                         type: string
 *                       action:
 *                         type: string
 *                         enum:
 *                           - AGREEMENT_UPLOADED
 *                           - AGREEMENT_EDITED
 *                           - AGREEMENT_SIGNED
 *                           - AGREEMENT_STATUS_UPDATED
 *                           - AGREEMENT_PERMISSION_UPDATED
 *                       details:
 *                         type: string
 *                         description: Human-readable description of the action.
 *                         example: 'Agreement "NDA.pdf" was uploaded.'
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       project:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *             example:
 *               activity:
 *                 - id: "clxlog0001"
 *                   projectId: "clx1abc000004"
 *                   action: "AGREEMENT_SIGNED"
 *                   details: "Agreement \"NDA — Project Alpha\" was electronically signed by Jane Adeyemi."
 *                   createdAt: "2026-10-23T14:00:00.000Z"
 *                   project:
 *                     id: "clx1abc000004"
 *                     name: "Project Alpha"
 *                 - id: "clxlog0002"
 *                   projectId: "clx1abc000004"
 *                   action: "AGREEMENT_STATUS_UPDATED"
 *                   details: "Agreement \"NDA — Project Alpha\" status changed to PENDING_SIGNATURE."
 *                   createdAt: "2026-10-22T09:00:00.000Z"
 *                   project:
 *                     id: "clx1abc000004"
 *                     name: "Project Alpha"
 *               pagination:
 *                 total: 12
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 1
 *       401:
 *         description: Missing or invalid auth token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/activity", authMiddleware, getUserAgreementActivityHandler);

module.exports = router;
