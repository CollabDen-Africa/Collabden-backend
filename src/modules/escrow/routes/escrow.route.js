const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const { requireProjectAccess } = require("../../../middleware/projectAccess");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  configureEscrowSchema,
  approveEscrowSchema,
  submitMilestoneSchema,
  disputeMilestoneSchema,
  resolveDisputeSchema,
} = require("../../../schemas/escrow.schema");
const {
  configureEscrow,
  getProjectEscrow,
  getEscrowStatus,
  approveEscrowProposal,
  fundEscrow,
  submitMilestone,
  approveMilestone,
  getMilestone,
  disputeMilestone,
  resolveDispute,
  getProjectPaymentHistory,
  getPersonalEscrowPayments,
} = require("../controllers/escrow.controller");

/**
 * @swagger
 * tags:
 *   name: Escrow
 *   description: Escrow payment management — configuration, approvals, milestones, disputes, and payment releases for project collaborators.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Escrow:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz_escrow1
 *         projectId:
 *           type: string
 *         agreementId:
 *           type: string
 *         totalAmount:
 *           type: number
 *           format: decimal
 *           example: 500000.00
 *         fundedAmount:
 *           type: number
 *           format: decimal
 *           example: 500000.00
 *         releasedAmount:
 *           type: number
 *           format: decimal
 *           example: 150000.00
 *         status:
 *           type: string
 *           enum: [PENDING_FUNDING, FUNDED, LOCKED, COMPLETED]
 *         reviewPeriodDays:
 *           type: integer
 *           example: 7
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     EscrowMilestone:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: ms_abc123
 *         title:
 *           type: string
 *           example: Beat Production Complete
 *         amount:
 *           type: number
 *           format: decimal
 *           example: 75000.00
 *         status:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, SUBMITTED, AWAITING_REVIEW, APPROVED, PAYMENT_RELEASED, DISPUTED]
 *         dueDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         reviewDeadline:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         evidence:
 *           type: object
 *           properties:
 *             files:
 *               type: array
 *               items:
 *                 type: string
 *             links:
 *               type: array
 *               items:
 *                 type: string
 *             documents:
 *               type: array
 *               items:
 *                 type: string
 *             comment:
 *               type: string
 *         isAutoReleased:
 *           type: boolean
 *           example: false
 *         collaborators:
 *           type: array
 *           description: Collaborators assigned to this milestone, each receives the full amount
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               paymentReference:
 *                 type: string
 *                 nullable: true
 *               releasedAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *
 *     EscrowAllocation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         totalAmount:
 *           type: number
 *           format: decimal
 *         releasedAmount:
 *           type: number
 *           format: decimal
 *         approvalStatus:
 *           type: string
 *           enum: [PENDING, APPROVED, CHANGES_REQUESTED, REJECTED]
 */

// ─── All routes require authentication ──────────────────────────────────────
router.use(authMiddleware);

// ─── Personal Escrow Payments (not project-scoped) ──────────────────────────

/**
 * @swagger
 * /api/v1/projects/escrow/my-payments:
 *   get:
 *     summary: Get personal escrow payments received
 *     description: Returns paginated list of all escrow payments credited to the authenticated user's wallet across all projects.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Personal escrow payments retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/escrow/my-payments", getPersonalEscrowPayments);

// ─── Admin: Dispute Resolution ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/projects/escrow/disputes/{milestoneId}/resolve:
 *   patch:
 *     summary: Admin resolves an escrow milestone dispute
 *     description: Admin reviews a disputed milestone and either approves the payment release or rejects the submission. Uses project agreements, activity history, and submitted evidence for decision making.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *         description: The disputed milestone ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *               - adminComment
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [APPROVE_RELEASE, REJECT]
 *                 example: APPROVE_RELEASE
 *               adminComment:
 *                 type: string
 *                 example: Evidence reviewed. Deliverables meet the agreed milestone requirements.
 *     responses:
 *       200:
 *         description: Dispute resolved successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.patch(
  "/escrow/disputes/:milestoneId/resolve",
  adminMiddleware,
  validateRequest(resolveDisputeSchema),
  resolveDispute
);

// ─── Project-scoped Escrow Routes ───────────────────────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow:
 *   post:
 *     summary: Configure escrow payment structure for a project
 *     description: |
 *       Project owner defines the escrow payment terms including total amount and milestones with multi-collaborator assignments.
 *       Each milestone can be assigned to multiple collaborators. When a milestone is approved, EACH collaborator receives the full milestone amount.
 *       The totalAmount must equal the sum of (milestone.amount × number of collaborators per milestone).
 *       Allocations are automatically derived from milestone assignments. Requires a fully signed legal agreement.
 *       Review period is configurable per project.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               - totalAmount
 *               - agreementId
 *               - milestones
 *             properties:
 *               totalAmount:
 *                 type: number
 *                 minimum: 1000
 *                 description: "Total escrow amount in NGN. Must equal sum of (milestone.amount × collaborator count per milestone). Example: $10k milestone with 3 collaborators = $30k effective cost."
 *                 example: 500000
 *               agreementId:
 *                 type: string
 *                 description: ID of the signed legal agreement
 *                 example: agreement_123
 *               reviewPeriodDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 30
 *                 default: 7
 *                 description: Number of days the project owner has to review submitted milestones before auto-release
 *               milestones:
 *                 type: array
 *                 description: "Payment milestones. Each collaborator assigned to a milestone receives the FULL milestone amount. Allocations are computed automatically."
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - amount
 *                     - collaboratorIds
 *                   properties:
 *                     title:
 *                       type: string
 *                       example: Beat Production Complete
 *                     description:
 *                       type: string
 *                       example: Deliver the final beat mix
 *                     amount:
 *                       type: number
 *                       example: 125000
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                     collaboratorIds:
 *                       type: array
 *                       description: List of collaborator user IDs assigned to this milestone
 *                       items:
 *                         type: string
 *                       example: ["user_collab1", "user_collab2"]
 *     responses:
 *       201:
 *         description: Escrow configured successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escrow'
 *       400:
 *         description: Validation error or business rule violation
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:projectId/escrow",
  requireProjectAccess,
  validateRequest(configureEscrowSchema),
  configureEscrow
);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow:
 *   get:
 *     summary: Get escrow details for a project
 *     description: Returns the full escrow configuration including allocations, milestones, and activity history. Accessible to project owners and active collaborators.
 *     tags: [Escrow]
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
 *         description: Escrow details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escrow'
 *       404:
 *         description: No escrow found
 *       401:
 *         description: Unauthorized
 */
router.get("/:projectId/escrow", requireProjectAccess, getProjectEscrow);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/status:
 *   get:
 *     summary: Get escrow status dashboard
 *     description: Returns a summary of escrow funding status, milestone progress, released/remaining amounts, and allocation breakdowns.
 *     tags: [Escrow]
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
 *         description: Escrow status retrieved
 *       404:
 *         description: No escrow found
 *       401:
 *         description: Unauthorized
 */
router.get("/:projectId/escrow/status", requireProjectAccess, getEscrowStatus);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/approve:
 *   patch:
 *     summary: Approve, request changes, or reject escrow proposal
 *     description: Collaborators must review and approve the escrow terms before funding can proceed. All collaborators must approve before the project owner can fund the escrow.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *                 enum: [APPROVED, CHANGES_REQUESTED, REJECTED]
 *                 example: APPROVED
 *               comment:
 *                 type: string
 *                 example: Terms look fair. I'm ready to proceed.
 *     responses:
 *       200:
 *         description: Escrow proposal response recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EscrowAllocation'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/:projectId/escrow/approve",
  requireProjectAccess,
  validateRequest(approveEscrowSchema),
  approveEscrowProposal
);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/fund:
 *   post:
 *     summary: Fund the escrow from the project owner's wallet
 *     description: Debits the total escrow amount from the project owner's CollabDen wallet and locks the escrow. All collaborators must have approved the escrow proposal before funding can proceed.
 *     tags: [Escrow]
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
 *         description: Escrow funded and locked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escrow'
 *       400:
 *         description: Insufficient balance or pending approvals
 *       401:
 *         description: Unauthorized
 */
router.post("/:projectId/escrow/fund", requireProjectAccess, fundEscrow);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/payments:
 *   get:
 *     summary: Get project escrow payment history
 *     description: Returns all released escrow payments for the project including milestone details, amounts, dates, and recipients.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Payment history retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/:projectId/escrow/payments", requireProjectAccess, getProjectPaymentHistory);

// ─── Milestone Operations ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/milestones/{milestoneId}:
 *   get:
 *     summary: Get milestone details
 *     description: Returns detailed milestone information including evidence, status, and allocation details.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Milestone details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EscrowMilestone'
 *       404:
 *         description: Milestone not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:projectId/escrow/milestones/:milestoneId",
  requireProjectAccess,
  getMilestone
);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/milestones/{milestoneId}/submit:
 *   post:
 *     summary: Submit a milestone for review
 *     description: Collaborator submits the milestone with supporting evidence (files, links, documents, comments). Sets status to AWAITING_REVIEW and starts the review countdown. Prevents duplicate submissions.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
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
 *               - evidence
 *             properties:
 *               evidence:
 *                 type: object
 *                 properties:
 *                   files:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["https://storage.collabden.com/files/beat_v2.wav"]
 *                   links:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["https://soundcloud.com/user/track"]
 *                   documents:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["https://storage.collabden.com/docs/delivery_note.pdf"]
 *                   comment:
 *                     type: string
 *                     example: Final mix delivered as agreed. All stems included.
 *     responses:
 *       200:
 *         description: Milestone submitted for review
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EscrowMilestone'
 *       400:
 *         description: Bad request or duplicate submission
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:projectId/escrow/milestones/:milestoneId/submit",
  requireProjectAccess,
  validateRequest(submitMilestoneSchema),
  submitMilestone
);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/milestones/{milestoneId}/approve:
 *   patch:
 *     summary: Approve a submitted milestone and release payment to all collaborators
 *     description: Project owner approves the milestone, triggering escrow payment release to ALL collaborators linked to the milestone. Each collaborator receives the full milestone amount.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Milestone approved and payments released to all collaborators
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 milestone:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     amountPerCollaborator:
 *                       type: number
 *                     totalReleased:
 *                       type: number
 *                     collaboratorCount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       example: PAYMENT_RELEASED
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       collaboratorId:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       paymentReference:
 *                         type: string
 *                 totalReleased:
 *                   type: number
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/:projectId/escrow/milestones/:milestoneId/approve",
  requireProjectAccess,
  approveMilestone
);

/**
 * @swagger
 * /api/v1/projects/{projectId}/escrow/milestones/{milestoneId}/dispute:
 *   post:
 *     summary: Raise a dispute on a milestone
 *     description: Project owner or assigned collaborator raises a dispute regarding milestone completion. Disputed milestones are frozen until an admin resolves them.
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 example: The delivered beat does not match the agreed specifications. Missing vocals and wrong BPM.
 *     responses:
 *       200:
 *         description: Dispute raised successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:projectId/escrow/milestones/:milestoneId/dispute",
  requireProjectAccess,
  validateRequest(disputeMilestoneSchema),
  disputeMilestone
);

module.exports = router;
